import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { supabaseAdmin } from '@maideres/db'
import { PreviewCommissionQuerySchema, CreateTransactionSchema } from '@maideres/contracts'
import type { HonoVariables } from '../types'
import { requireRole } from '../middleware/rbac'
import { isStaff, ownClientId, ownPrestataireId } from '../services/identity.service'
import { calculerCommission } from '../services/commission.service'

export const transactionsRouter = new Hono<{ Variables: HonoVariables }>()

if (!supabaseAdmin) {
  transactionsRouter.all('*', (c) => c.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 503))
}
const db = supabaseAdmin!

const TRANSACTION_FIELDS =
  'id, matching_id, montant_service, commission_taux, commission_montant, statut_paiement, ref_notchpay, created_at'

// ── GET /api/transactions/preview-commission — estimation avant création ─────
// Staff uniquement. Appelle le même calcul (calculer_commission, via RPC) que
// le trigger qui alimentera la transaction — jamais de logique dupliquée.
transactionsRouter.get(
  '/preview-commission',
  requireRole(['admin', 'superviseur', 'operateur']),
  zValidator('query', PreviewCommissionQuerySchema),
  async (c) => {
    const { montant_service, categorie_id, prestataire_id } = c.req.valid('query')

    const commissionMontant = await calculerCommission(db, {
      montantService: montant_service,
      categorieId:    categorie_id ?? null,
      prestataireId:  prestataire_id ?? null,
    })

    const commissionTaux = montant_service > 0
      ? Math.round((commissionMontant / montant_service) * 100 * 100) / 100
      : 0

    return c.json({ data: { commission_montant: commissionMontant, commission_taux: commissionTaux } })
  },
)

// ── GET /api/transactions — liste, filtrée par rôle ───────────────────────────
transactionsRouter.get('/', async (c) => {
  const user = c.get('user')
  const { statut_paiement } = c.req.query()

  let query = db.from('transactions').select(TRANSACTION_FIELDS)

  if (isStaff(user.role)) {
    // pas de restriction supplémentaire
  } else {
    const prestataireId = await ownPrestataireId(user.id)
    const clientId = prestataireId ? null : await ownClientId(user.id)

    const matchingIds = await matchingIdsForUser(prestataireId, clientId)
    if (!matchingIds) return c.json({ data: [] })
    query = query.in('matching_id', matchingIds)
  }

  if (statut_paiement) query = query.eq('statut_paiement', statut_paiement)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

async function matchingIdsForUser(prestataireId: string | null, clientId: string | null): Promise<string[] | null> {
  if (prestataireId) {
    const { data } = await db.from('matchings').select('id').eq('prestataire_id', prestataireId)
    return (data ?? []).map((m) => (m as { id: string }).id)
  }
  if (clientId) {
    const { data: demandes } = await db.from('demandes').select('id').eq('client_id', clientId)
    const demandeIds = (demandes ?? []).map((d) => (d as { id: string }).id)
    if (!demandeIds.length) return null
    const { data: matchings } = await db.from('matchings').select('id').in('demande_id', demandeIds)
    return (matchings ?? []).map((m) => (m as { id: string }).id)
  }
  return null
}

// ── GET /api/transactions/:id ──────────────────────────────────────────────
transactionsRouter.get('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { data, error } = await db.from('transactions').select(TRANSACTION_FIELDS).eq('id', id).maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) throw new HTTPException(404, { message: 'Transaction introuvable' })

  if (await canAccessTransaction(user, data as { matching_id: string })) {
    return c.json({ data })
  }
  throw new HTTPException(403, { message: 'Accès refusé' })
})

async function canAccessTransaction(
  user: { id: string; role: string },
  transaction: { matching_id: string },
): Promise<boolean> {
  if (isStaff(user.role)) return true

  const prestataireId = await ownPrestataireId(user.id)
  if (prestataireId) {
    const { data: matching } = await db
      .from('matchings').select('id').eq('id', transaction.matching_id).eq('prestataire_id', prestataireId).maybeSingle()
    if (matching) return true
  }

  const clientId = await ownClientId(user.id)
  if (!clientId) return false
  const { data: matching } = await db
    .from('matchings').select('demande_id').eq('id', transaction.matching_id).maybeSingle()
  if (!matching) return false
  const { data: demande } = await db
    .from('demandes').select('client_id').eq('id', (matching as { demande_id: string }).demande_id).maybeSingle()
  return (demande as { client_id: string } | null)?.client_id === clientId
}

// ── POST /api/transactions — enregistrement d'un montant pour un matching
//    réalisé (staff). commission_taux/commission_montant ne sont jamais
//    acceptés en entrée : ils viennent exclusivement du trigger
//    trg_transactions_commission (public.calculer_commission), voir 0011. ──
transactionsRouter.post(
  '/',
  requireRole(['admin', 'superviseur', 'operateur']),
  zValidator('json', CreateTransactionSchema),
  async (c) => {
    const body = c.req.valid('json')

    const { data: matching, error: matchingError } = await db
      .from('matchings').select('id, statut').eq('id', body.matching_id).maybeSingle()
    if (matchingError) return c.json({ error: matchingError.message }, 500)
    if (!matching) throw new HTTPException(404, { message: 'Matching introuvable' })
    if ((matching as { statut: string }).statut !== 'realise') {
      throw new HTTPException(422, { message: "Une transaction ne peut être créée que pour un matching au statut 'realise'" })
    }

    const { data, error } = await db
      .from('transactions')
      .insert({ matching_id: body.matching_id, montant_service: body.montant_service })
      .select(TRANSACTION_FIELDS)
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new HTTPException(409, { message: 'Une transaction existe déjà pour ce matching' })
      }
      return c.json({ error: error.message }, 500)
    }
    return c.json({ data }, 201)
  },
)
