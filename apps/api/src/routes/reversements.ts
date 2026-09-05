import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { supabaseAdmin } from '@maideres/db'
import type { HonoVariables } from '../types'
import { requireRole } from '../middleware/rbac'
import { isStaff, ownPrestataireId } from '../services/identity.service'

export const reversementsRouter = new Hono<{ Variables: HonoVariables }>()

if (!supabaseAdmin) {
  reversementsRouter.all('*', (c) => c.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 503))
}
const db = supabaseAdmin!

const REVERSEMENT_FIELDS = 'id, prestataire_id, montant, statut, ref, date_paiement, created_at'

// ── GET /api/reversements — liste, filtrée par rôle (staff : tout ; prestataire : le sien) ──
reversementsRouter.get('/', async (c) => {
  const user = c.get('user')
  const { statut } = c.req.query()

  let query = db.from('reversements').select(REVERSEMENT_FIELDS)

  if (!isStaff(user.role)) {
    const prestataireId = await ownPrestataireId(user.id)
    if (!prestataireId) return c.json({ data: [] })
    query = query.eq('prestataire_id', prestataireId)
  }

  if (statut) query = query.eq('statut', statut)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── PATCH /api/reversements/:id/marquer-paye — staff uniquement ──────────────
//
// Le trigger sync_intervention_statut() (0009) amorce chaque reversement à
// montant=0 / ref='intervention:<id>' dès qu'une intervention passe 'realisee'
// ("calculé plus tard en Phase 5" — cette route est cette phase). Le montant
// net n'est donc jamais transmis par le client : il est recalculé ici à partir
// de la transaction liée au matching de l'intervention d'origine — même
// commission_montant que celui posé par le trigger trg_transactions_commission
// (public.calculer_commission, 0011), jamais une seconde fois en dur. `ref`
// n'est pas réécrit : il reste le pointeur vers l'intervention d'origine, seul
// lien permettant de retrouver la transaction (donc le net) même après paiement.
const REF_INTERVENTION = /^intervention:(.+)$/

async function resoudreMontantNet(ref: string | null): Promise<number | null> {
  const match = ref?.match(REF_INTERVENTION)
  if (!match) return null
  const interventionId = match[1]

  const { data: intervention } = await db
    .from('interventions').select('matching_id').eq('id', interventionId).maybeSingle()
  const matchingId = (intervention as { matching_id: string } | null)?.matching_id
  if (!matchingId) return null

  const { data: transaction } = await db
    .from('transactions').select('montant_service, commission_montant').eq('matching_id', matchingId).maybeSingle()
  if (!transaction) return null

  const t = transaction as { montant_service: number; commission_montant: number }
  return t.montant_service - t.commission_montant
}

reversementsRouter.patch(
  '/:id/marquer-paye',
  requireRole(['admin', 'superviseur', 'operateur']),
  async (c) => {
    const id = c.req.param('id')

    const { data: row, error: findError } = await db.from('reversements').select('statut, ref').eq('id', id).maybeSingle()
    if (findError) return c.json({ error: findError.message }, 500)
    if (!row) throw new HTTPException(404, { message: 'Reversement introuvable' })
    const current = row as { statut: string; ref: string | null }

    if (current.statut !== 'en_attente') {
      throw new HTTPException(422, { message: `Impossible de marquer payé un reversement au statut '${current.statut}'` })
    }

    const montantNet = await resoudreMontantNet(current.ref)
    if (montantNet === null) {
      throw new HTTPException(422, {
        message: "Aucune transaction enregistrée pour l'intervention liée — montant net impossible à calculer",
      })
    }

    const { data, error } = await db
      .from('reversements')
      .update({ statut: 'traite', montant: montantNet, date_paiement: new Date().toISOString() })
      .eq('id', id)
      .select(REVERSEMENT_FIELDS)
      .single()
    if (error) return c.json({ error: error.message }, 500)
    return c.json({ data })
  },
)
