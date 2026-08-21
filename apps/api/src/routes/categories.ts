import { Hono } from 'hono'
import { supabaseAdmin } from '@forge/db'
import type { HonoVariables } from '../types'
import { isStaff } from '../services/identity.service'

export const categoriesRouter = new Hono<{ Variables: HonoVariables }>()

if (!supabaseAdmin) {
  categoriesRouter.all('*', (c) => c.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 503))
}
const db = supabaseAdmin!

// ── GET /api/categories_services — lecture (Phase 2 : pas d'écriture) ────────
categoriesRouter.get('/', async (c) => {
  const user = c.get('user')

  let query = db.from('categories_services').select('id, libelle, actif').order('libelle')
  if (!isStaff(user.role)) query = query.eq('actif', true)

  const { data, error } = await query
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})
