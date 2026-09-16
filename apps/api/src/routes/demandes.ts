import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { supabaseAdmin } from '@maideres/db'
import { CreateDemandeSchema, UpdateDemandeStatutSchema, DEMANDE_STAFF_TRANSITIONS } from '@maideres/contracts'
import type { HonoVariables } from '../types'
import { isStaff, ownClientId, ownPrestataireId } from '../services/identity.service'

export const demandesRouter = new Hono<{ Variables: HonoVariables }>()

if (!supabaseAdmin) {
  demandesRouter.all('*', (c) => c.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 503))
}
const db = supabaseAdmin!

const DEMANDE_FIELDS = 'id, client_id, categorie_id, description, localisation, canal, statut, created_at, niveau_urgence, date_souhaitee, delai_cible'

// ── GET /api/demandes — liste, filtrée par rôle ───────────────────────────────
demandesRouter.get('/', async (c) => {
  const user = c.get('user')
  const { statut, categorie, canal, urgence } = c.req.query()

  let query = db.from('demandes').select(DEMANDE_FIELDS)

  if (isStaff(user.role)) {
    // pas de restriction supplémentaire
  } else {
    const clientId = await ownClientId(user.id)
    if (clientId) {
      query = query.eq('client_id', clientId)
    } else {
      const prestataireId = await ownPrestataireId(user.id)
      if (!prestataireId) return c.json({ data: [] })

      const { data: matchings } = await db
        .from('matchings')
        .select('demande_id')
        .eq('prestataire_id', prestataireId)
      const demandeIds = [...new Set((matchings ?? []).map((m) => (m as { demande_id: string }).demande_id))]
      if (!demandeIds.length) return c.json({ data: [] })
      query = query.in('id', demandeIds)
    }
  }

  if (statut)    query = query.eq('statut', statut)
  if (categorie) query = query.eq('categorie_id', categorie)
  if (canal)     query = query.eq('canal', canal)
  if (urgence)   query = query.eq('niveau_urgence', urgence)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── GET /api/demandes/:id ──────────────────────────────────────────────────
demandesRouter.get('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { data, error } = await db.from('demandes').select(DEMANDE_FIELDS).eq('id', id).maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) throw new HTTPException(404, { message: 'Demande introuvable' })

  if (await canAccessDemande(user, data as { client_id: string; id: string })) {
    return c.json({ data })
  }
  throw new HTTPException(403, { message: 'Accès refusé' })
})

async function canAccessDemande(user: { id: string; role: string }, demande: { client_id: string; id: string }): Promise<boolean> {
  if (isStaff(user.role)) return true

  const clientId = await ownClientId(user.id)
  if (clientId && demande.client_id === clientId) return true

  const prestataireId = await ownPrestataireId(user.id)
  if (!prestataireId) return false

  const { data: matching } = await db
    .from('matchings')
    .select('id')
    .eq('demande_id', demande.id)
    .eq('prestataire_id', prestataireId)
    .maybeSingle()
  return Boolean(matching)
}

// ── POST /api/demandes — création multi-canal ─────────────────────────────────
// delai_cible n'est jamais accepté ici : calculé par trigger DB à partir de
// niveau_urgence/date_souhaitee (cf. packages/db/drizzle/0015_demandes_delai_cible_trigger.sql).
demandesRouter.post('/', zValidator('json', CreateDemandeSchema), async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')

  let clientId: string | null
  if (isStaff(user.role)) {
    if (!body.client_id) throw new HTTPException(422, { message: 'client_id requis pour une création par le staff' })
    clientId = body.client_id
  } else {
    if (body.client_id) throw new HTTPException(403, { message: 'client_id ne peut être fourni que par le staff' })
    clientId = await ownClientId(user.id)
    if (!clientId) throw new HTTPException(403, { message: "Aucune fiche client associée à ce compte" })
  }

  const { data, error } = await db
    .from('demandes')
    .insert({
      client_id:    clientId,
      categorie_id: body.categorie_id,
      description:  body.description,
      localisation: body.localisation ?? null,
      canal:        body.canal,
      statut:       'nouvelle',
      niveau_urgence: body.niveau_urgence,
      date_souhaitee: body.date_souhaitee ?? null,
    })
    .select(DEMANDE_FIELDS)
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data }, 201)
})

// ── PATCH /api/demandes/:id/statut ────────────────────────────────────────────
// staff : toute transition. client : uniquement annuler sa propre demande 'nouvelle'.
demandesRouter.patch('/:id/statut', zValidator('json', UpdateDemandeStatutSchema), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const { statut } = c.req.valid('json')

  const { data: row, error: findError } = await db.from('demandes').select('client_id, statut').eq('id', id).maybeSingle()
  if (findError) return c.json({ error: findError.message }, 500)
  if (!row) throw new HTTPException(404, { message: 'Demande introuvable' })
  const current = row as { client_id: string; statut: string }

  if (isStaff(user.role)) {
    if (!DEMANDE_STAFF_TRANSITIONS[current.statut]?.includes(statut)) {
      throw new HTTPException(422, { message: `Transition ${current.statut} → ${statut} non autorisée` })
    }
  } else {
    const clientId = await ownClientId(user.id)
    if (clientId !== current.client_id) throw new HTTPException(403, { message: 'Accès refusé' })
    if (statut !== 'annulee' || current.statut !== 'nouvelle') {
      throw new HTTPException(403, { message: "Un client ne peut qu'annuler sa propre demande tant qu'elle est 'nouvelle'" })
    }
  }

  const { data, error } = await db.from('demandes').update({ statut }).eq('id', id).select(DEMANDE_FIELDS).single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})
