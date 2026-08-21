import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { supabaseAdmin } from '@forge/db'
import type { HonoVariables } from '../types'
import { requireRole } from '../middleware/rbac'
import { isStaff, ownClientId, ownPrestataireId } from '../services/identity.service'

export const matchingsRouter = new Hono<{ Variables: HonoVariables }>()

if (!supabaseAdmin) {
  matchingsRouter.all('*', (c) => c.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 503))
}
const db = supabaseAdmin!

const MATCHING_FIELDS = 'id, demande_id, prestataire_id, operateur_id, statut, motif_echec, proposed_at, closed_at'

// ── GET /api/matchings — liste, filtrée par rôle ──────────────────────────────
matchingsRouter.get('/', async (c) => {
  const user = c.get('user')
  const { statut, demande_id } = c.req.query()

  let query = db.from('matchings').select(MATCHING_FIELDS)

  if (isStaff(user.role)) {
    // pas de restriction supplémentaire
  } else {
    const prestataireId = await ownPrestataireId(user.id)
    if (prestataireId) {
      query = query.eq('prestataire_id', prestataireId)
    } else {
      const clientId = await ownClientId(user.id)
      if (!clientId) return c.json({ data: [] })
      const { data: demandes } = await db.from('demandes').select('id').eq('client_id', clientId)
      const demandeIds = (demandes ?? []).map((d) => (d as { id: string }).id)
      if (!demandeIds.length) return c.json({ data: [] })
      query = query.in('demande_id', demandeIds)
    }
  }

  if (statut)     query = query.eq('statut', statut)
  if (demande_id) query = query.eq('demande_id', demande_id)

  const { data, error } = await query.order('proposed_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── GET /api/matchings/:id ─────────────────────────────────────────────────
matchingsRouter.get('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { data, error } = await db.from('matchings').select(MATCHING_FIELDS).eq('id', id).maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) throw new HTTPException(404, { message: 'Matching introuvable' })

  if (await canAccessMatching(user, data as { demande_id: string; prestataire_id: string })) {
    return c.json({ data })
  }
  throw new HTTPException(403, { message: 'Accès refusé' })
})

async function canAccessMatching(
  user: { id: string; role: string },
  matching: { demande_id: string; prestataire_id: string },
): Promise<boolean> {
  if (isStaff(user.role)) return true

  const prestataireId = await ownPrestataireId(user.id)
  if (prestataireId && matching.prestataire_id === prestataireId) return true

  const clientId = await ownClientId(user.id)
  if (!clientId) return false
  const { data: demande } = await db.from('demandes').select('client_id').eq('id', matching.demande_id).maybeSingle()
  return (demande as { client_id: string } | null)?.client_id === clientId
}

// ── POST /api/matchings — proposer un prestataire pour une demande (staff) ───
const proposeSchema = z.object({
  demande_id:     z.string().uuid(),
  prestataire_id: z.string().uuid(),
})

matchingsRouter.post(
  '/',
  requireRole(['admin', 'superviseur', 'operateur']),
  zValidator('json', proposeSchema),
  async (c) => {
    const user = c.get('user')
    const body = c.req.valid('json')

    const { data: demande, error: demandeError } = await db
      .from('demandes').select('id, statut').eq('id', body.demande_id).maybeSingle()
    if (demandeError) return c.json({ error: demandeError.message }, 500)
    if (!demande) throw new HTTPException(404, { message: 'Demande introuvable' })
    const demandeStatut = (demande as { statut: string }).statut
    if (!['nouvelle', 'en_traitement'].includes(demandeStatut)) {
      throw new HTTPException(422, { message: `Impossible de proposer un prestataire pour une demande au statut '${demandeStatut}'` })
    }

    const { data: prestataire, error: prestataireError } = await db
      .from('prestataires').select('id, statut').eq('id', body.prestataire_id).maybeSingle()
    if (prestataireError) return c.json({ error: prestataireError.message }, 500)
    if (!prestataire) throw new HTTPException(404, { message: 'Prestataire introuvable' })
    if ((prestataire as { statut: string }).statut !== 'actif') {
      throw new HTTPException(422, { message: 'Le prestataire doit être actif pour recevoir une proposition' })
    }

    const { data, error } = await db
      .from('matchings')
      .insert({
        demande_id:     body.demande_id,
        prestataire_id: body.prestataire_id,
        operateur_id:   user.id,
        statut:         'propose',
        proposed_at:    new Date().toISOString(),
      })
      .select(MATCHING_FIELDS)
      .single()
    if (error) return c.json({ error: error.message }, 500)

    if (demandeStatut === 'nouvelle') {
      await db.from('demandes').update({ statut: 'en_traitement' }).eq('id', body.demande_id)
    }

    return c.json({ data }, 201)
  },
)

// ── PATCH /api/matchings/:id/accepter — prestataire uniquement, son propre matching ──
matchingsRouter.patch('/:id/accepter', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const prestataireId = await ownPrestataireId(user.id)
  if (!prestataireId) throw new HTTPException(403, { message: 'Réservé aux prestataires' })

  const { data: row, error: findError } = await db.from('matchings').select('prestataire_id, demande_id, statut').eq('id', id).maybeSingle()
  if (findError) return c.json({ error: findError.message }, 500)
  if (!row) throw new HTTPException(404, { message: 'Matching introuvable' })
  const matching = row as { prestataire_id: string; demande_id: string; statut: string }

  if (matching.prestataire_id !== prestataireId) throw new HTTPException(403, { message: 'Accès refusé' })
  if (matching.statut !== 'propose') throw new HTTPException(422, { message: `Impossible d'accepter un matching au statut '${matching.statut}'` })

  const { data, error } = await db.from('matchings').update({ statut: 'accepte' }).eq('id', id).select(MATCHING_FIELDS).single()
  if (error) return c.json({ error: error.message }, 500)

  await db.from('demandes').update({ statut: 'matchee' }).eq('id', matching.demande_id)

  return c.json({ data })
})

// ── PATCH /api/matchings/:id/refuser — prestataire uniquement, son propre matching ──
const refuserSchema = z.object({ motif_echec: z.string().trim().max(500).nullable().optional() })

matchingsRouter.patch('/:id/refuser', zValidator('json', refuserSchema), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const { motif_echec } = c.req.valid('json')

  const prestataireId = await ownPrestataireId(user.id)
  if (!prestataireId) throw new HTTPException(403, { message: 'Réservé aux prestataires' })

  const { data: row, error: findError } = await db.from('matchings').select('prestataire_id, statut').eq('id', id).maybeSingle()
  if (findError) return c.json({ error: findError.message }, 500)
  if (!row) throw new HTTPException(404, { message: 'Matching introuvable' })
  const matching = row as { prestataire_id: string; statut: string }

  if (matching.prestataire_id !== prestataireId) throw new HTTPException(403, { message: 'Accès refusé' })
  if (matching.statut !== 'propose') throw new HTTPException(422, { message: `Impossible de refuser un matching au statut '${matching.statut}'` })

  const { data, error } = await db
    .from('matchings')
    .update({ statut: 'refuse', motif_echec: motif_echec ?? null, closed_at: new Date().toISOString() })
    .eq('id', id)
    .select(MATCHING_FIELDS)
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── PATCH /api/matchings/:id/cloturer — staff OU le prestataire assigné ──────
// Jamais le client (RBAC vérifié en test d'intégration).
const cloturerSchema = z.object({
  issue:       z.enum(['realise', 'echoue']),
  motif_echec: z.string().trim().max(500).nullable().optional(),
})

matchingsRouter.patch('/:id/cloturer', zValidator('json', cloturerSchema), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const { issue, motif_echec } = c.req.valid('json')

  if (issue === 'echoue' && !motif_echec) {
    throw new HTTPException(422, { message: 'motif_echec requis pour clôturer en échec' })
  }

  const { data: row, error: findError } = await db.from('matchings').select('prestataire_id, demande_id, statut').eq('id', id).maybeSingle()
  if (findError) return c.json({ error: findError.message }, 500)
  if (!row) throw new HTTPException(404, { message: 'Matching introuvable' })
  const matching = row as { prestataire_id: string; demande_id: string; statut: string }

  const staff = isStaff(user.role)
  if (!staff) {
    const prestataireId = await ownPrestataireId(user.id)
    if (!prestataireId || prestataireId !== matching.prestataire_id) {
      throw new HTTPException(403, { message: 'Accès refusé' })
    }
  }

  if (matching.statut !== 'accepte') {
    throw new HTTPException(422, { message: `Impossible de clôturer un matching au statut '${matching.statut}'` })
  }

  const { data, error } = await db
    .from('matchings')
    .update({ statut: issue, motif_echec: motif_echec ?? null, closed_at: new Date().toISOString() })
    .eq('id', id)
    .select(MATCHING_FIELDS)
    .single()
  if (error) return c.json({ error: error.message }, 500)

  await db
    .from('demandes')
    .update({ statut: issue === 'realise' ? 'realisee' : 'en_traitement' })
    .eq('id', matching.demande_id)

  return c.json({ data })
})
