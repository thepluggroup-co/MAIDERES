import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { supabaseAdmin } from '@maideres/db'
import type { HonoVariables } from '../types'
import { requireRole } from '../middleware/rbac'
import { isStaff, ownPrestataireId } from '../services/identity.service'

export const prestatairesRouter = new Hono<{ Variables: HonoVariables }>()

if (!supabaseAdmin) {
  prestatairesRouter.all('*', (c) => c.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 503))
}
const db = supabaseAdmin!

const PRESTATAIRE_FIELDS =
  'id, profile_id, nom, telephone, categories, quartier, geoloc_lat, geoloc_lng, statut, note_moyenne, taux_commission, date_recrutement'

// ── GET /api/prestataires — liste, filtrée par rôle ───────────────────────────
// staff : tout. prestataire : sa propre ligne (tout statut). client : uniquement statut=actif.
prestatairesRouter.get('/', async (c) => {
  const user = c.get('user')
  const { categorie, quartier, statut } = c.req.query()

  let query = db.from('prestataires').select(PRESTATAIRE_FIELDS)

  if (isStaff(user.role)) {
    if (statut) query = query.eq('statut', statut)
  } else {
    const own = await ownPrestataireId(user.id)
    if (own) {
      query = query.eq('id', own)
    } else {
      // Pas de fiche prestataire → identité "client" : uniquement les actifs.
      query = query.eq('statut', 'actif')
    }
  }

  if (categorie) query = query.contains('categories', [categorie])
  if (quartier) query = query.eq('quartier', quartier)

  const { data, error } = await query.order('nom')
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── GET /api/prestataires/:id ──────────────────────────────────────────────
prestatairesRouter.get('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { data, error } = await db.from('prestataires').select(PRESTATAIRE_FIELDS).eq('id', id).maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) throw new HTTPException(404, { message: 'Prestataire introuvable' })

  const row = data as { profile_id: string; statut: string }
  if (isStaff(user.role) || row.profile_id === user.id || row.statut === 'actif') {
    return c.json({ data })
  }
  throw new HTTPException(403, { message: 'Accès refusé' })
})

// ── POST /api/prestataires — inscription (statut toujours en_attente) ────────
const createSchema = z.object({
  nom:         z.string().trim().min(1).max(100),
  telephone:   z.string().trim().min(6).max(30),
  categories:  z.array(z.string().uuid()).default([]),
  quartier:    z.string().trim().max(100).nullable().optional(),
  geoloc_lat:  z.number().min(-90).max(90).nullable().optional(),
  geoloc_lng:  z.number().min(-180).max(180).nullable().optional(),
  profile_id:  z.string().uuid().optional(), // staff seulement : créer pour un autre profil
})

prestatairesRouter.post('/', zValidator('json', createSchema), async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')

  const profileId = isStaff(user.role) && body.profile_id ? body.profile_id : user.id

  const existing = await ownPrestataireIdFor(profileId)
  if (existing) throw new HTTPException(409, { message: 'Ce profil a déjà une fiche prestataire' })

  const { data, error } = await db
    .from('prestataires')
    .insert({
      profile_id:       profileId,
      nom:              body.nom,
      telephone:        body.telephone,
      categories:       body.categories,
      quartier:         body.quartier ?? null,
      geoloc_lat:       body.geoloc_lat ?? null,
      geoloc_lng:       body.geoloc_lng ?? null,
      statut:           'en_attente',
      date_recrutement: new Date().toISOString(),
    })
    .select(PRESTATAIRE_FIELDS)
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data }, 201)
})

async function ownPrestataireIdFor(profileId: string): Promise<string | null> {
  const { data } = await db.from('prestataires').select('id').eq('profile_id', profileId).maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

// ── PATCH /api/prestataires/:id — staff : tout ; soi-même : champs non sensibles ──
const updateSchema = z.object({
  nom:         z.string().trim().min(1).max(100).optional(),
  telephone:   z.string().trim().min(6).max(30).optional(),
  categories:  z.array(z.string().uuid()).optional(),
  quartier:    z.string().trim().max(100).nullable().optional(),
  geoloc_lat:  z.number().min(-90).max(90).nullable().optional(),
  geoloc_lng:  z.number().min(-180).max(180).nullable().optional(),
  // staff seulement. null = retirer l'override (revenir à commission_config).
  taux_commission: z.number().min(0).max(100).nullable().optional(),
})

prestatairesRouter.patch('/:id', zValidator('json', updateSchema), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const { data: row, error: findError } = await db.from('prestataires').select('profile_id').eq('id', id).maybeSingle()
  if (findError) return c.json({ error: findError.message }, 500)
  if (!row) throw new HTTPException(404, { message: 'Prestataire introuvable' })

  const staff = isStaff(user.role)
  const isOwner = (row as { profile_id: string }).profile_id === user.id
  if (!staff && !isOwner) throw new HTTPException(403, { message: 'Accès refusé' })

  if (!staff && body.taux_commission !== undefined) {
    throw new HTTPException(403, { message: 'Seul le staff peut modifier taux_commission' })
  }

  const update: Record<string, unknown> = {}
  if (body.nom             !== undefined) update.nom = body.nom
  if (body.telephone       !== undefined) update.telephone = body.telephone
  if (body.categories      !== undefined) update.categories = body.categories
  if (body.quartier        !== undefined) update.quartier = body.quartier
  if (body.geoloc_lat      !== undefined) update.geoloc_lat = body.geoloc_lat
  if (body.geoloc_lng      !== undefined) update.geoloc_lng = body.geoloc_lng
  if (staff && body.taux_commission !== undefined) {
    update.taux_commission = body.taux_commission === null ? null : String(body.taux_commission)
  }

  if (!Object.keys(update).length) return c.json({ success: true })

  const { data, error } = await db.from('prestataires').update(update).eq('id', id).select(PRESTATAIRE_FIELDS).single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── PATCH /api/prestataires/:id/statut — validation de statut (staff) ────────
const STATUT_TRANSITIONS: Record<string, string[]> = {
  en_attente: ['actif', 'suspendu'],
  actif:      ['suspendu'],
  suspendu:   ['actif'],
}

const statutSchema = z.object({ statut: z.enum(['en_attente', 'actif', 'suspendu']) })

prestatairesRouter.patch(
  '/:id/statut',
  requireRole(['admin', 'superviseur', 'operateur']),
  zValidator('json', statutSchema),
  async (c) => {
    const id = c.req.param('id')
    const { statut } = c.req.valid('json')

    const { data: row, error: findError } = await db.from('prestataires').select('statut').eq('id', id).maybeSingle()
    if (findError) return c.json({ error: findError.message }, 500)
    if (!row) throw new HTTPException(404, { message: 'Prestataire introuvable' })

    const current = (row as { statut: string }).statut
    if (current !== statut && !STATUT_TRANSITIONS[current]?.includes(statut)) {
      throw new HTTPException(422, { message: `Transition ${current} → ${statut} non autorisée` })
    }

    const { data, error } = await db.from('prestataires').update({ statut }).eq('id', id).select(PRESTATAIRE_FIELDS).single()
    if (error) return c.json({ error: error.message }, 500)
    return c.json({ data })
  },
)

// ── DELETE /api/prestataires/:id — staff seulement ────────────────────────────
prestatairesRouter.delete('/:id', requireRole(['admin', 'superviseur', 'operateur']), async (c) => {
  const id = c.req.param('id')
  const { error } = await db.from('prestataires').delete().eq('id', id)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
})
