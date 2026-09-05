import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { supabaseAdmin } from '@maideres/db'
import type { HonoVariables } from '../types'
import { isStaff } from '../services/identity.service'
import { requireRole } from '../middleware/rbac'

export const categoriesRouter = new Hono<{ Variables: HonoVariables }>()

if (!supabaseAdmin) {
  categoriesRouter.all('*', (c) => c.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 503))
}
const db = supabaseAdmin!

const CATEGORIE_FIELDS = 'id, libelle, actif'

// ── GET /api/categories_services — staff : toutes ; sinon : actives seulement ──
categoriesRouter.get('/', async (c) => {
  const user = c.get('user')

  let query = db.from('categories_services').select(CATEGORIE_FIELDS).order('libelle')
  if (!isStaff(user.role)) query = query.eq('actif', true)

  const { data, error } = await query
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── POST /api/categories_services — admin uniquement (cf. RLS categories_write_admin) ──
const createSchema = z.object({
  libelle: z.string().trim().min(1).max(100),
  actif:   z.boolean().default(true),
})

categoriesRouter.post('/', requireRole(['admin']), zValidator('json', createSchema), async (c) => {
  const body = c.req.valid('json')

  const { data, error } = await db
    .from('categories_services')
    .insert({ libelle: body.libelle, actif: body.actif })
    .select(CATEGORIE_FIELDS)
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data }, 201)
})

// ── PATCH /api/categories_services/:id — admin uniquement ────────────────────
const updateSchema = z.object({
  libelle: z.string().trim().min(1).max(100).optional(),
  actif:   z.boolean().optional(),
})

categoriesRouter.patch('/:id', requireRole(['admin']), zValidator('json', updateSchema), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const update: Record<string, unknown> = {}
  if (body.libelle !== undefined) update.libelle = body.libelle
  if (body.actif   !== undefined) update.actif   = body.actif
  if (!Object.keys(update).length) return c.json({ success: true })

  const { data, error } = await db
    .from('categories_services')
    .update(update)
    .eq('id', id)
    .select(CATEGORIE_FIELDS)
    .maybeSingle()

  if (error) return c.json({ error: error.message }, 500)
  if (!data) throw new HTTPException(404, { message: 'Catégorie introuvable' })
  return c.json({ data })
})

// ── DELETE /api/categories_services/:id — admin uniquement ───────────────────
// Bloqué si des demandes référencent encore cette catégorie (FK RESTRICT en
// base) : mieux vaut désactiver (actif=false) via PATCH que supprimer.
categoriesRouter.delete('/:id', requireRole(['admin']), async (c) => {
  const id = c.req.param('id')

  const { error } = await db.from('categories_services').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') {
      throw new HTTPException(409, { message: 'Catégorie utilisée par des demandes existantes — désactivez-la plutôt que de la supprimer' })
    }
    return c.json({ error: error.message }, 500)
  }
  return c.json({ success: true })
})
