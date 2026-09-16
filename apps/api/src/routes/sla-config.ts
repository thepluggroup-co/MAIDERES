import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { supabaseAdmin } from '@maideres/db'
import { UpdateSlaConfigSchema } from '@maideres/contracts'
import type { HonoVariables } from '../types'
import { requireRole } from '../middleware/rbac'

export const slaConfigRouter = new Hono<{ Variables: HonoVariables }>()

if (!supabaseAdmin) {
  slaConfigRouter.all('*', (c) => c.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 503))
}
const db = supabaseAdmin!

const SLA_FIELDS = 'id, niveau_urgence, delai_heures, seuil_alerte_heures, created_at'
const STAFF = ['admin', 'superviseur', 'operateur'] as const

// ── GET /api/sla_config — staff uniquement (cf. RLS sla_config_all_staff) ────
// Pas de valeur "planifie" filtrée : les 3 niveaux (immediate/urgent/planifie)
// sont un ensemble fermé, seedé en base (0011/0017) — jamais créés/supprimés
// depuis l'API, seul delai_heures/seuil_alerte_heures se met à jour.
slaConfigRouter.get('/', requireRole([...STAFF]), async (c) => {
  const { data, error } = await db.from('sla_config').select(SLA_FIELDS).order('niveau_urgence')
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── PATCH /api/sla_config/:id — staff uniquement ──────────────────────────────
slaConfigRouter.patch('/:id', requireRole([...STAFF]), zValidator('json', UpdateSlaConfigSchema), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const { data: current, error: findError } = await db
    .from('sla_config').select('delai_heures, seuil_alerte_heures').eq('id', id).maybeSingle()
  if (findError) return c.json({ error: findError.message }, 500)
  if (!current) throw new HTTPException(404, { message: 'Configuration SLA introuvable' })
  const row = current as { delai_heures: number; seuil_alerte_heures: number }

  const delaiHeures  = body.delai_heures ?? row.delai_heures
  const seuilAlerte  = body.seuil_alerte_heures ?? row.seuil_alerte_heures
  if (seuilAlerte >= delaiHeures) {
    throw new HTTPException(422, { message: 'seuil_alerte_heures doit être inférieur à delai_heures' })
  }

  const update: Record<string, unknown> = {}
  if (body.delai_heures        !== undefined) update.delai_heures = body.delai_heures
  if (body.seuil_alerte_heures !== undefined) update.seuil_alerte_heures = body.seuil_alerte_heures
  if (!Object.keys(update).length) return c.json({ success: true })

  const { data, error } = await db
    .from('sla_config')
    .update(update)
    .eq('id', id)
    .select(SLA_FIELDS)
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})
