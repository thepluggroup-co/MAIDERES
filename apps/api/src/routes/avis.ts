import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { supabaseAdmin } from '@forge/db'
import type { HonoVariables } from '../types'
import { isStaff, ownClientId, ownPrestataireId } from '../services/identity.service'

export const avisRouter = new Hono<{ Variables: HonoVariables }>()

if (!supabaseAdmin) {
  avisRouter.all('*', (c) => c.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 503))
}
const db = supabaseAdmin!

const AVIS_FIELDS = 'id, matching_id, note, commentaire, created_at'

// ── GET /api/avis — liste, filtrée par rôle ───────────────────────────────────
avisRouter.get('/', async (c) => {
  const user = c.get('user')
  const { matching_id } = c.req.query()

  let query = db.from('avis').select(AVIS_FIELDS)

  if (isStaff(user.role)) {
    // pas de restriction
  } else {
    const prestataireId = await ownPrestataireId(user.id)
    const clientId = prestataireId ? null : await ownClientId(user.id)

    let matchingIds: string[]
    if (prestataireId) {
      const { data } = await db.from('matchings').select('id').eq('prestataire_id', prestataireId)
      matchingIds = (data ?? []).map((m) => (m as { id: string }).id)
    } else if (clientId) {
      const { data: demandes } = await db.from('demandes').select('id').eq('client_id', clientId)
      const demandeIds = (demandes ?? []).map((d) => (d as { id: string }).id)
      if (!demandeIds.length) return c.json({ data: [] })
      const { data: matchings } = await db.from('matchings').select('id').in('demande_id', demandeIds)
      matchingIds = (matchings ?? []).map((m) => (m as { id: string }).id)
    } else {
      return c.json({ data: [] })
    }

    if (!matchingIds.length) return c.json({ data: [] })
    query = query.in('matching_id', matchingIds)
  }

  if (matching_id) query = query.eq('matching_id', matching_id)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── POST /api/avis — le client laisse un avis sur un matching réalisé ────────
const createSchema = z.object({
  matching_id: z.string().uuid(),
  note:        z.number().int().min(1).max(5),
  commentaire: z.string().trim().max(1000).nullable().optional(),
})

avisRouter.post('/', zValidator('json', createSchema), async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')

  const { data: matching, error: matchingError } = await db
    .from('matchings').select('id, demande_id, statut').eq('id', body.matching_id).maybeSingle()
  if (matchingError) return c.json({ error: matchingError.message }, 500)
  if (!matching) throw new HTTPException(404, { message: 'Matching introuvable' })
  const m = matching as { id: string; demande_id: string; statut: string }

  if (m.statut !== 'realise') {
    throw new HTTPException(422, { message: "Un avis ne peut être laissé que sur un matching 'realise'" })
  }

  if (!isStaff(user.role)) {
    const clientId = await ownClientId(user.id)
    if (!clientId) throw new HTTPException(403, { message: 'Réservé aux clients' })
    const { data: demande } = await db.from('demandes').select('client_id').eq('id', m.demande_id).maybeSingle()
    if ((demande as { client_id: string } | null)?.client_id !== clientId) {
      throw new HTTPException(403, { message: 'Accès refusé' })
    }
  }

  const { data, error } = await db
    .from('avis')
    .insert({ matching_id: body.matching_id, note: body.note, commentaire: body.commentaire ?? null })
    .select(AVIS_FIELDS)
    .single()

  if (error) {
    if (error.code === '23505') throw new HTTPException(409, { message: 'Un avis existe déjà pour ce matching' })
    return c.json({ error: error.message }, 500)
  }
  return c.json({ data }, 201)
})
