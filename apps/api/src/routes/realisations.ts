import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { supabaseAdmin } from '@maideres/db'
import { CreateRealisationSchema } from '@maideres/contracts'
import type { HonoVariables } from '../types'
import { isStaff, ownPrestataireId } from '../services/identity.service'

/**
 * Galerie de réalisations self-service (0027). `image_url` pointe vers un
 * objet du bucket Storage "maideres" (voir packages/db/drizzle/
 * 0028_offres_promotions_realisations_rls.sql) — l'upload lui-même se fait
 * directement contre Supabase Storage depuis le frontend (comme avant),
 * cette route ne gère que la ligne de métadonnées.
 */
export const realisationsRouter = new Hono<{ Variables: HonoVariables }>()

if (!supabaseAdmin) {
  realisationsRouter.all('*', (c) => c.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 503))
}
const db = supabaseAdmin!

const REALISATION_FIELDS = 'id, prestataire_id, titre, description, image_url, created_at'

// ── GET /api/realisations — staff : tout (filtrable) ; prestataire : les siennes ──
realisationsRouter.get('/', async (c) => {
  const user = c.get('user')
  const { prestataire_id } = c.req.query()

  if (isStaff(user.role)) {
    let query = db.from('realisations').select(REALISATION_FIELDS).order('created_at', { ascending: false })
    if (prestataire_id) query = query.eq('prestataire_id', prestataire_id)
    const { data, error } = await query
    if (error) return c.json({ error: error.message }, 500)
    return c.json({ data })
  }

  const own = await ownPrestataireId(user.id)
  if (!own) return c.json({ data: [] })

  const { data, error } = await db
    .from('realisations')
    .select(REALISATION_FIELDS)
    .eq('prestataire_id', own)
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── POST /api/realisations — le prestataire ajoute une photo à sa fiche (ou staff) ──
realisationsRouter.post('/', zValidator('json', CreateRealisationSchema), async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')

  const prestataireId = isStaff(user.role) && body.prestataire_id
    ? body.prestataire_id
    : await ownPrestataireId(user.id)

  if (!prestataireId) {
    throw new HTTPException(422, { message: 'Aucune fiche prestataire associée à ce compte' })
  }

  const { data, error } = await db
    .from('realisations')
    .insert({
      prestataire_id: prestataireId,
      titre:          body.titre ?? 'Réalisation',
      description:    body.description ?? null,
      image_url:      body.image_url,
    })
    .select(REALISATION_FIELDS)
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data }, 201)
})

// ── DELETE /api/realisations/:id — staff ou propriétaire ──────────────────────
realisationsRouter.delete('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { data: row, error: findError } = await db.from('realisations').select('prestataire_id').eq('id', id).maybeSingle()
  if (findError) return c.json({ error: findError.message }, 500)
  if (!row) throw new HTTPException(404, { message: 'Réalisation introuvable' })

  if (!isStaff(user.role) && (row as { prestataire_id: string }).prestataire_id !== (await ownPrestataireId(user.id))) {
    throw new HTTPException(403, { message: 'Accès refusé' })
  }

  const { error } = await db.from('realisations').delete().eq('id', id)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
})
