import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { supabaseAdmin } from '@forge/db'
import type { HonoVariables } from '../types'
import { requireRole } from '../middleware/rbac'
import { isStaff } from '../services/identity.service'

export const clientsRouter = new Hono<{ Variables: HonoVariables }>()

if (!supabaseAdmin) {
  clientsRouter.all('*', (c) => c.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 503))
}
const db = supabaseAdmin!

const CLIENT_FIELDS = 'id, profile_id, nom, telephone, quartier'

// ── GET /api/clients — staff : tout ; sinon : sa propre fiche ────────────────
clientsRouter.get('/', async (c) => {
  const user = c.get('user')
  let query = db.from('clients').select(CLIENT_FIELDS)
  if (!isStaff(user.role)) query = query.eq('profile_id', user.id)

  const { quartier } = c.req.query()
  if (quartier) query = query.eq('quartier', quartier)

  const { data, error } = await query.order('nom')
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── GET /api/clients/:id ───────────────────────────────────────────────────
clientsRouter.get('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { data, error } = await db.from('clients').select(CLIENT_FIELDS).eq('id', id).maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) throw new HTTPException(404, { message: 'Client introuvable' })

  const row = data as { profile_id: string }
  if (!isStaff(user.role) && row.profile_id !== user.id) {
    throw new HTTPException(403, { message: 'Accès refusé' })
  }
  return c.json({ data })
})

// ── POST /api/clients — inscription ───────────────────────────────────────────
const createSchema = z.object({
  nom:        z.string().trim().min(1).max(100),
  telephone:  z.string().trim().min(6).max(30),
  quartier:   z.string().trim().max(100).nullable().optional(),
  profile_id: z.string().uuid().optional(), // staff seulement : créer pour un autre profil
})

clientsRouter.post('/', zValidator('json', createSchema), async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')
  const profileId = isStaff(user.role) && body.profile_id ? body.profile_id : user.id

  const { data: existing } = await db.from('clients').select('id').eq('profile_id', profileId).maybeSingle()
  if (existing) throw new HTTPException(409, { message: 'Ce profil a déjà une fiche client' })

  const { data, error } = await db
    .from('clients')
    .insert({ profile_id: profileId, nom: body.nom, telephone: body.telephone, quartier: body.quartier ?? null })
    .select(CLIENT_FIELDS)
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data }, 201)
})

// ── PATCH /api/clients/:id — staff ou soi-même ────────────────────────────────
const updateSchema = z.object({
  nom:       z.string().trim().min(1).max(100).optional(),
  telephone: z.string().trim().min(6).max(30).optional(),
  quartier:  z.string().trim().max(100).nullable().optional(),
})

clientsRouter.patch('/:id', zValidator('json', updateSchema), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const { data: row, error: findError } = await db.from('clients').select('profile_id').eq('id', id).maybeSingle()
  if (findError) return c.json({ error: findError.message }, 500)
  if (!row) throw new HTTPException(404, { message: 'Client introuvable' })

  if (!isStaff(user.role) && (row as { profile_id: string }).profile_id !== user.id) {
    throw new HTTPException(403, { message: 'Accès refusé' })
  }

  const update: Record<string, unknown> = {}
  if (body.nom       !== undefined) update.nom = body.nom
  if (body.telephone !== undefined) update.telephone = body.telephone
  if (body.quartier  !== undefined) update.quartier = body.quartier
  if (!Object.keys(update).length) return c.json({ success: true })

  const { data, error } = await db.from('clients').update(update).eq('id', id).select(CLIENT_FIELDS).single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── DELETE /api/clients/:id — staff seulement ─────────────────────────────────
clientsRouter.delete('/:id', requireRole(['admin', 'superviseur', 'operateur']), async (c) => {
  const id = c.req.param('id')
  const { error } = await db.from('clients').delete().eq('id', id)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
})
