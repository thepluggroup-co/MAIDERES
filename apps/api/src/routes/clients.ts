import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { supabaseAdmin } from '@maideres/db'
import { CreateClientSchema, UpdateClientSchema } from '@maideres/contracts'
import type { HonoVariables } from '../types'
import { requireRole } from '../middleware/rbac'
import { isStaff } from '../services/identity.service'

export const clientsRouter = new Hono<{ Variables: HonoVariables }>()

if (!supabaseAdmin) {
  clientsRouter.all('*', (c) => c.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 503))
}
const db = supabaseAdmin!

const CLIENT_FIELDS = 'id, profile_id, nom, telephone, quartier, type_client, niu, whatsapp, email, source'

// niu est logiquement requis pour une entité (entreprise/organisation), sans
// contrainte au niveau base (cf. packages/db/src/schema.pg.ts, colonne niu) —
// la règle métier vit ici, côté validation d'entrée.
function requiresNiu(typeClient: string | undefined): boolean {
  return typeClient === 'entreprise' || typeClient === 'organisation'
}

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
clientsRouter.post('/', zValidator('json', CreateClientSchema), async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')
  const profileId = isStaff(user.role) && body.profile_id ? body.profile_id : user.id

  const { data: existing } = await db.from('clients').select('id').eq('profile_id', profileId).maybeSingle()
  if (existing) throw new HTTPException(409, { message: 'Ce profil a déjà une fiche client' })

  const { data, error } = await db
    .from('clients')
    .insert({
      profile_id:  profileId,
      nom:         body.nom,
      telephone:   body.telephone,
      quartier:    body.quartier ?? null,
      type_client: body.type_client,
      niu:         body.niu ?? null,
      whatsapp:    body.whatsapp ?? null,
      email:       body.email ?? null,
      source:      body.source,
    })
    .select(CLIENT_FIELDS)
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data }, 201)
})

// ── PATCH /api/clients/:id — staff ou soi-même ────────────────────────────────
clientsRouter.patch('/:id', zValidator('json', UpdateClientSchema), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const { data: row, error: findError } = await db.from('clients').select('profile_id, type_client, niu').eq('id', id).maybeSingle()
  if (findError) return c.json({ error: findError.message }, 500)
  if (!row) throw new HTTPException(404, { message: 'Client introuvable' })
  const current = row as { profile_id: string; type_client: string; niu: string | null }

  if (!isStaff(user.role) && current.profile_id !== user.id) {
    throw new HTTPException(403, { message: 'Accès refusé' })
  }

  const finalTypeClient = body.type_client ?? current.type_client
  const finalNiu        = body.niu !== undefined ? body.niu : current.niu
  if (requiresNiu(finalTypeClient) && !finalNiu?.trim()) {
    throw new HTTPException(422, { message: 'Le NIU est requis pour une entreprise ou une organisation' })
  }

  const update: Record<string, unknown> = {}
  if (body.nom         !== undefined) update.nom = body.nom
  if (body.telephone   !== undefined) update.telephone = body.telephone
  if (body.quartier    !== undefined) update.quartier = body.quartier
  if (body.type_client !== undefined) update.type_client = body.type_client
  if (body.niu         !== undefined) update.niu = body.niu
  if (body.whatsapp    !== undefined) update.whatsapp = body.whatsapp
  if (body.email       !== undefined) update.email = body.email
  if (body.source      !== undefined) update.source = body.source
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
