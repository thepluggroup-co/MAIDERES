import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { supabaseAdmin } from '@maideres/db'
import { CreatePromotionSchema, UpdatePromotionSchema } from '@maideres/contracts'
import type { HonoVariables } from '../types'
import { isStaff, ownPrestataireId } from '../services/identity.service'

export const promotionsRouter = new Hono<{ Variables: HonoVariables }>()

if (!supabaseAdmin) {
  promotionsRouter.all('*', (c) => c.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 503))
}
const db = supabaseAdmin!

const PROMOTION_FIELDS =
  'id, prestataire_id, offre_id, titre, description, remise_pct, debut, fin, active, created_at'

// ── GET /api/promotions — staff : tout (filtrable) ; prestataire : les siennes ──
promotionsRouter.get('/', async (c) => {
  const user = c.get('user')
  const { prestataire_id } = c.req.query()

  if (isStaff(user.role)) {
    let query = db.from('promotions').select(PROMOTION_FIELDS).order('created_at', { ascending: false })
    if (prestataire_id) query = query.eq('prestataire_id', prestataire_id)
    const { data, error } = await query
    if (error) return c.json({ error: error.message }, 500)
    return c.json({ data })
  }

  const own = await ownPrestataireId(user.id)
  if (!own) return c.json({ data: [] })

  const { data, error } = await db
    .from('promotions')
    .select(PROMOTION_FIELDS)
    .eq('prestataire_id', own)
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── POST /api/promotions — le prestataire crée pour sa propre fiche (ou staff) ──
promotionsRouter.post('/', zValidator('json', CreatePromotionSchema), async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')

  const prestataireId = isStaff(user.role) && body.prestataire_id
    ? body.prestataire_id
    : await ownPrestataireId(user.id)

  if (!prestataireId) {
    throw new HTTPException(422, { message: 'Aucune fiche prestataire associée à ce compte' })
  }

  // Une offre liée doit appartenir à la même fiche prestataire — évite
  // qu'une promotion affiche une remise sur l'offre d'un autre prestataire.
  if (body.offre_id) {
    const { data: offre } = await db.from('offres').select('prestataire_id').eq('id', body.offre_id).maybeSingle()
    if (!offre || (offre as { prestataire_id: string }).prestataire_id !== prestataireId) {
      throw new HTTPException(422, { message: "L'offre indiquée n'appartient pas à cette fiche prestataire" })
    }
  }

  const { data, error } = await db
    .from('promotions')
    .insert({
      prestataire_id: prestataireId,
      offre_id:       body.offre_id ?? null,
      titre:          body.titre,
      description:    body.description ?? null,
      remise_pct:     body.remise_pct,
      fin:            body.fin ?? null,
    })
    .select(PROMOTION_FIELDS)
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data }, 201)
})

// ── PATCH /api/promotions/:id — staff ou propriétaire ─────────────────────────
promotionsRouter.patch('/:id', zValidator('json', UpdatePromotionSchema), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const { data: row, error: findError } = await db.from('promotions').select('prestataire_id').eq('id', id).maybeSingle()
  if (findError) return c.json({ error: findError.message }, 500)
  if (!row) throw new HTTPException(404, { message: 'Promotion introuvable' })

  const staff = isStaff(user.role)
  if (!staff && (row as { prestataire_id: string }).prestataire_id !== (await ownPrestataireId(user.id))) {
    throw new HTTPException(403, { message: 'Accès refusé' })
  }

  const update: Record<string, unknown> = {}
  if (body.titre       !== undefined) update.titre = body.titre
  if (body.description !== undefined) update.description = body.description
  if (body.remise_pct  !== undefined) update.remise_pct = body.remise_pct
  if (body.fin         !== undefined) update.fin = body.fin
  if (body.active      !== undefined) update.active = body.active
  if (!Object.keys(update).length) return c.json({ success: true })

  const { data, error } = await db.from('promotions').update(update).eq('id', id).select(PROMOTION_FIELDS).single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── DELETE /api/promotions/:id — staff ou propriétaire ────────────────────────
promotionsRouter.delete('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { data: row, error: findError } = await db.from('promotions').select('prestataire_id').eq('id', id).maybeSingle()
  if (findError) return c.json({ error: findError.message }, 500)
  if (!row) throw new HTTPException(404, { message: 'Promotion introuvable' })

  if (!isStaff(user.role) && (row as { prestataire_id: string }).prestataire_id !== (await ownPrestataireId(user.id))) {
    throw new HTTPException(403, { message: 'Accès refusé' })
  }

  const { error } = await db.from('promotions').delete().eq('id', id)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
})
