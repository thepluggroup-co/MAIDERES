import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { supabaseAdmin } from '@maideres/db'
import {
  CheckinInterventionSchema, UpdateInterventionStatutSchema, ReporterInterventionSchema,
  INTERVENTION_TRANSITIONS, INTERVENTION_TERMINAL_STATUTS,
} from '@maideres/contracts'
import type { HonoVariables } from '../types'
import { isStaff, ownClientId, ownPrestataireId } from '../services/identity.service'

export const interventionsRouter = new Hono<{ Variables: HonoVariables }>()

if (!supabaseAdmin) {
  interventionsRouter.all('*', (c) => c.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 503))
}
const db = supabaseAdmin!

const INTERVENTION_FIELDS = 'id, matching_id, statut, date_planifiee, creneau_fin, date_debut, date_fin, checkin_at, checkout_at, localisation_checkin, preuve, created_at, updated_at'

// ── Accès : staff (tout) ; prestataire/client (via matching, lecture seule) ──
async function contexteMatching(matchingId: string): Promise<{ demande_id: string; prestataire_id: string } | null> {
  const { data } = await db.from('matchings').select('demande_id, prestataire_id').eq('id', matchingId).maybeSingle()
  return data as { demande_id: string; prestataire_id: string } | null
}

async function canAccessIntervention(user: { id: string; role: string }, matchingId: string): Promise<{ read: boolean; write: boolean }> {
  if (isStaff(user.role)) return { read: true, write: true }

  const ctx = await contexteMatching(matchingId)
  if (!ctx) return { read: false, write: false }

  const prestataireId = await ownPrestataireId(user.id)
  if (prestataireId && prestataireId === ctx.prestataire_id) return { read: true, write: true }

  const clientId = await ownClientId(user.id)
  if (clientId) {
    const { data: demande } = await db.from('demandes').select('client_id').eq('id', ctx.demande_id).maybeSingle()
    if ((demande as { client_id: string } | null)?.client_id === clientId) return { read: true, write: false }
  }
  return { read: false, write: false }
}

// ── GET /api/interventions — liste, filtrée par rôle ──────────────────────────
interventionsRouter.get('/', async (c) => {
  const user = c.get('user')
  const { statut } = c.req.query()

  let query = db.from('interventions').select(INTERVENTION_FIELDS)

  if (!isStaff(user.role)) {
    const prestataireId = await ownPrestataireId(user.id)
    if (prestataireId) {
      const { data: matchings } = await db.from('matchings').select('id').eq('prestataire_id', prestataireId)
      const matchingIds = (matchings ?? []).map((m) => (m as { id: string }).id)
      if (!matchingIds.length) return c.json({ data: [] })
      query = query.in('matching_id', matchingIds)
    } else {
      const clientId = await ownClientId(user.id)
      if (!clientId) return c.json({ data: [] })
      const { data: demandes } = await db.from('demandes').select('id').eq('client_id', clientId)
      const demandeIds = (demandes ?? []).map((d) => (d as { id: string }).id)
      if (!demandeIds.length) return c.json({ data: [] })
      const { data: matchings } = await db.from('matchings').select('id').in('demande_id', demandeIds)
      const matchingIds = (matchings ?? []).map((m) => (m as { id: string }).id)
      if (!matchingIds.length) return c.json({ data: [] })
      query = query.in('matching_id', matchingIds)
    }
  }

  if (statut) query = query.eq('statut', statut)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── GET /api/interventions/:id ─────────────────────────────────────────────
interventionsRouter.get('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { data, error } = await db.from('interventions').select(INTERVENTION_FIELDS).eq('id', id).maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) throw new HTTPException(404, { message: 'Intervention introuvable' })

  const { read } = await canAccessIntervention(user, (data as { matching_id: string }).matching_id)
  if (!read) throw new HTTPException(403, { message: 'Accès refusé' })
  return c.json({ data })
})

// ── GET /api/interventions/:id/evenements — timeline append-only ─────────────
interventionsRouter.get('/:id/evenements', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { data: intervention, error: findError } = await db.from('interventions').select('matching_id').eq('id', id).maybeSingle()
  if (findError) return c.json({ error: findError.message }, 500)
  if (!intervention) throw new HTTPException(404, { message: 'Intervention introuvable' })

  const { read } = await canAccessIntervention(user, (intervention as { matching_id: string }).matching_id)
  if (!read) throw new HTTPException(403, { message: 'Accès refusé' })

  const { data, error } = await db
    .from('intervention_evenements')
    .select('id, intervention_id, type, ancien_statut, nouveau_statut, commentaire, localisation, operateur_id, created_at')
    .eq('intervention_id', id)
    .order('created_at', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── PATCH /api/interventions/:id/checkin ──────────────────────────────────────
// Le trigger DB (0009_intervention_sync.sql) force statut='sur_site' et journalise
// l'événement 'checkin' automatiquement — l'API se contente d'écrire checkin_at.
interventionsRouter.patch('/:id/checkin', zValidator('json', CheckinInterventionSchema), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const { data: row, error: findError } = await db.from('interventions').select('matching_id, checkin_at').eq('id', id).maybeSingle()
  if (findError) return c.json({ error: findError.message }, 500)
  if (!row) throw new HTTPException(404, { message: 'Intervention introuvable' })
  const current = row as { matching_id: string; checkin_at: string | null }

  const { write } = await canAccessIntervention(user, current.matching_id)
  if (!write) throw new HTTPException(403, { message: 'Accès refusé' })
  if (current.checkin_at) throw new HTTPException(422, { message: 'Check-in déjà enregistré' })

  const { data, error } = await db
    .from('interventions')
    .update({ checkin_at: new Date().toISOString(), localisation_checkin: body.localisation_checkin ?? null })
    .eq('id', id)
    .select(INTERVENTION_FIELDS)
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── PATCH /api/interventions/:id/checkout ─────────────────────────────────────
interventionsRouter.patch('/:id/checkout', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { data: row, error: findError } = await db.from('interventions').select('matching_id, checkin_at, checkout_at').eq('id', id).maybeSingle()
  if (findError) return c.json({ error: findError.message }, 500)
  if (!row) throw new HTTPException(404, { message: 'Intervention introuvable' })
  const current = row as { matching_id: string; checkin_at: string | null; checkout_at: string | null }

  const { write } = await canAccessIntervention(user, current.matching_id)
  if (!write) throw new HTTPException(403, { message: 'Accès refusé' })
  if (!current.checkin_at) throw new HTTPException(422, { message: 'Check-in requis avant le check-out' })
  if (current.checkout_at) throw new HTTPException(422, { message: 'Check-out déjà enregistré' })

  const { data, error } = await db
    .from('interventions')
    .update({ checkout_at: new Date().toISOString() })
    .eq('id', id)
    .select(INTERVENTION_FIELDS)
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── PATCH /api/interventions/:id/statut ────────────────────────────────────────
// Le trigger journalise le changement + synchronise demandes/reversements ;
// l'API valide la transition et tient date_debut/date_fin (non gérées par trigger).
interventionsRouter.patch('/:id/statut', zValidator('json', UpdateInterventionStatutSchema), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const { statut } = c.req.valid('json')

  const { data: row, error: findError } = await db.from('interventions').select('matching_id, statut, date_debut').eq('id', id).maybeSingle()
  if (findError) return c.json({ error: findError.message }, 500)
  if (!row) throw new HTTPException(404, { message: 'Intervention introuvable' })
  const current = row as { matching_id: string; statut: string; date_debut: string | null }

  const { write } = await canAccessIntervention(user, current.matching_id)
  if (!write) throw new HTTPException(403, { message: 'Accès refusé' })
  if (!INTERVENTION_TRANSITIONS[current.statut]?.includes(statut)) {
    throw new HTTPException(422, { message: `Transition ${current.statut} → ${statut} non autorisée` })
  }

  const update: Record<string, unknown> = { statut }
  if (statut === 'en_cours' && !current.date_debut) update.date_debut = new Date().toISOString()
  if (INTERVENTION_TERMINAL_STATUTS.includes(statut)) update.date_fin = new Date().toISOString()

  const { data, error } = await db.from('interventions').update(update).eq('id', id).select(INTERVENTION_FIELDS).single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── PATCH /api/interventions/:id/reporter — reporte à une nouvelle date ───────
interventionsRouter.patch('/:id/reporter', zValidator('json', ReporterInterventionSchema), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const { data: row, error: findError } = await db.from('interventions').select('matching_id, statut').eq('id', id).maybeSingle()
  if (findError) return c.json({ error: findError.message }, 500)
  if (!row) throw new HTTPException(404, { message: 'Intervention introuvable' })
  const current = row as { matching_id: string; statut: string }

  const { write } = await canAccessIntervention(user, current.matching_id)
  if (!write) throw new HTTPException(403, { message: 'Accès refusé' })
  if (INTERVENTION_TERMINAL_STATUTS.includes(current.statut)) {
    throw new HTTPException(422, { message: 'Impossible de reporter une intervention déjà clôturée' })
  }

  const { data, error } = await db
    .from('interventions')
    .update({ statut: 'reportee', date_planifiee: body.date_planifiee })
    .eq('id', id)
    .select(INTERVENTION_FIELDS)
    .single()
  if (error) return c.json({ error: error.message }, 500)

  // Le trigger journalise déjà le changement de statut (type 'changement_statut',
  // sans commentaire) — on ajoute une ligne 'note' distincte pour le motif du report.
  if (body.commentaire) {
    await db.from('intervention_evenements').insert({
      intervention_id: id,
      type: 'note',
      commentaire: body.commentaire,
      operateur_id: user.id,
    })
  }

  return c.json({ data })
})
