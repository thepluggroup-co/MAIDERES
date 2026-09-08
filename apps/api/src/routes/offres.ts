import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { supabaseAdmin } from '@maideres/db'
import { CreateOffreSchema, UpdateOffreSchema } from '@maideres/contracts'
import type { HonoVariables } from '../types'
import { isStaff, ownPrestataireId } from '../services/identity.service'

/**
 * Listing de service self-service (0027, portage maidere-connect). `categorie`
 * est un libellé libre choisi par le prestataire pour sa fiche publique —
 * distinct de `prestataires.categories` (uuid[] utilisé par le matching/
 * dispatch staff), jamais consommé par cette logique-là.
 *
 * `publie` est un interrupteur d'item géré librement par le prestataire :
 * il n'a AUCUN effet sur la visibilité tant que prestataires.statut != 'actif'
 * (appliqué par /api/public/prestataires/:id, jamais ici). Cette route
 * authentifiée sert la gestion de ses propres offres (ou, pour le staff,
 * n'importe lesquelles) — la lecture publique passe par /api/public/*.
 */
export const offresRouter = new Hono<{ Variables: HonoVariables }>()

if (!supabaseAdmin) {
  offresRouter.all('*', (c) => c.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 503))
}
const db = supabaseAdmin!

const OFFRE_FIELDS =
  'id, prestataire_id, categorie, titre, description, prestations, prix, unite_prix, delai_heures, publie, created_at'

// ── GET /api/offres — staff : tout (filtrable par prestataire_id) ; prestataire : les siennes ──
offresRouter.get('/', async (c) => {
  const user = c.get('user')
  const { prestataire_id } = c.req.query()

  if (isStaff(user.role)) {
    let query = db.from('offres').select(OFFRE_FIELDS).order('created_at', { ascending: false })
    if (prestataire_id) query = query.eq('prestataire_id', prestataire_id)
    const { data, error } = await query
    if (error) return c.json({ error: error.message }, 500)
    return c.json({ data })
  }

  const own = await ownPrestataireId(user.id)
  if (!own) return c.json({ data: [] })

  const { data, error } = await db
    .from('offres')
    .select(OFFRE_FIELDS)
    .eq('prestataire_id', own)
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── GET /api/offres/:id — staff ou propriétaire uniquement (lecture publique : /api/public/*) ──
offresRouter.get('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { data, error } = await db.from('offres').select(OFFRE_FIELDS).eq('id', id).maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) throw new HTTPException(404, { message: 'Offre introuvable' })

  const row = data as { prestataire_id: string }
  if (!isStaff(user.role) && row.prestataire_id !== (await ownPrestataireId(user.id))) {
    throw new HTTPException(403, { message: 'Accès refusé' })
  }
  return c.json({ data })
})

// ── POST /api/offres — le prestataire crée pour sa propre fiche (ou staff pour n'importe laquelle) ──
offresRouter.post('/', zValidator('json', CreateOffreSchema), async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')

  const prestataireId = isStaff(user.role) && body.prestataire_id
    ? body.prestataire_id
    : await ownPrestataireId(user.id)

  if (!prestataireId) {
    throw new HTTPException(422, { message: 'Aucune fiche prestataire associée à ce compte' })
  }

  const { data, error } = await db
    .from('offres')
    .insert({
      prestataire_id: prestataireId,
      categorie:      body.categorie,
      titre:          body.titre,
      description:    body.description ?? null,
      prestations:    body.prestations,
      prix:           body.prix,
      unite_prix:     body.unite_prix,
      delai_heures:   body.delai_heures ?? null,
    })
    .select(OFFRE_FIELDS)
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data }, 201)
})

// ── PATCH /api/offres/:id — staff ou propriétaire ─────────────────────────────
offresRouter.patch('/:id', zValidator('json', UpdateOffreSchema), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const { data: row, error: findError } = await db.from('offres').select('prestataire_id').eq('id', id).maybeSingle()
  if (findError) return c.json({ error: findError.message }, 500)
  if (!row) throw new HTTPException(404, { message: 'Offre introuvable' })

  const staff = isStaff(user.role)
  if (!staff && (row as { prestataire_id: string }).prestataire_id !== (await ownPrestataireId(user.id))) {
    throw new HTTPException(403, { message: 'Accès refusé' })
  }

  const update: Record<string, unknown> = {}
  if (body.categorie    !== undefined) update.categorie = body.categorie
  if (body.titre        !== undefined) update.titre = body.titre
  if (body.description  !== undefined) update.description = body.description
  if (body.prestations  !== undefined) update.prestations = body.prestations
  if (body.prix         !== undefined) update.prix = body.prix
  if (body.unite_prix   !== undefined) update.unite_prix = body.unite_prix
  if (body.delai_heures !== undefined) update.delai_heures = body.delai_heures
  if (body.publie       !== undefined) update.publie = body.publie
  if (!Object.keys(update).length) return c.json({ success: true })

  const { data, error } = await db.from('offres').update(update).eq('id', id).select(OFFRE_FIELDS).single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── DELETE /api/offres/:id — staff ou propriétaire ────────────────────────────
offresRouter.delete('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { data: row, error: findError } = await db.from('offres').select('prestataire_id').eq('id', id).maybeSingle()
  if (findError) return c.json({ error: findError.message }, 500)
  if (!row) throw new HTTPException(404, { message: 'Offre introuvable' })

  if (!isStaff(user.role) && (row as { prestataire_id: string }).prestataire_id !== (await ownPrestataireId(user.id))) {
    throw new HTTPException(403, { message: 'Accès refusé' })
  }

  const { error } = await db.from('offres').delete().eq('id', id)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
})
