import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { supabaseAdmin } from '@maideres/db'
import { CreateCommissionConfigSchema, UpdateCommissionConfigSchema } from '@maideres/contracts'
import type { HonoVariables } from '../types'
import { requireRole } from '../middleware/rbac'

export const commissionConfigRouter = new Hono<{ Variables: HonoVariables }>()

if (!supabaseAdmin) {
  commissionConfigRouter.all('*', (c) => c.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 503))
}
const db = supabaseAdmin!

const COMMISSION_FIELDS = 'id, categorie_id, type, valeur, actif, created_at'

// ── GET /api/commission_config — staff uniquement (cf. RLS commission_config_select_staff) ──
commissionConfigRouter.get('/', requireRole(['admin', 'superviseur', 'operateur']), async (c) => {
  const { categorie_id } = c.req.query()

  let query = db.from('commission_config').select(COMMISSION_FIELDS).order('created_at', { ascending: false })
  if (categorie_id === 'null') query = query.is('categorie_id', null)
  else if (categorie_id)       query = query.eq('categorie_id', categorie_id)

  const { data, error } = await query
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── POST /api/commission_config — admin uniquement (cf. RLS commission_config_write_admin) ──
// categorie_id absent/null = règle globale (fallback quand aucune règle de
// catégorie active n'existe) — jamais deux notions distinctes en base.
commissionConfigRouter.post('/', requireRole(['admin']), zValidator('json', CreateCommissionConfigSchema), async (c) => {
  const body = c.req.valid('json')

  const { data, error } = await db
    .from('commission_config')
    .insert({
      categorie_id: body.categorie_id ?? null,
      type:         body.type,
      valeur:       body.valeur,
      actif:        body.actif,
    })
    .select(COMMISSION_FIELDS)
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data }, 201)
})

// ── PATCH /api/commission_config/:id — admin uniquement ───────────────────────
commissionConfigRouter.patch('/:id', requireRole(['admin']), zValidator('json', UpdateCommissionConfigSchema), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const { data: current, error: findError } = await db
    .from('commission_config').select('type, valeur').eq('id', id).maybeSingle()
  if (findError) return c.json({ error: findError.message }, 500)
  if (!current) throw new HTTPException(404, { message: 'Règle de commission introuvable' })
  const row = current as { type: string; valeur: string }

  const finalType   = body.type ?? row.type
  const finalValeur = body.valeur ?? Number(row.valeur)
  if (finalType === 'pourcentage' && finalValeur > 100) {
    throw new HTTPException(422, { message: 'Un taux en pourcentage ne peut pas dépasser 100' })
  }

  const update: Record<string, unknown> = {}
  if (body.type   !== undefined) update.type   = body.type
  if (body.valeur !== undefined) update.valeur = body.valeur
  if (body.actif  !== undefined) update.actif  = body.actif
  if (!Object.keys(update).length) return c.json({ success: true })

  const { data, error } = await db
    .from('commission_config')
    .update(update)
    .eq('id', id)
    .select(COMMISSION_FIELDS)
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── DELETE /api/commission_config/:id — admin uniquement ─────────────────────
commissionConfigRouter.delete('/:id', requireRole(['admin']), async (c) => {
  const id = c.req.param('id')
  const { error } = await db.from('commission_config').delete().eq('id', id)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
})
