import { Hono } from 'hono'
import { supabaseAdmin } from '@maideres/db'
import type { HonoVariables } from '../types'

/**
 * Routes PUBLIQUES — montées sur `app` directement (jamais sur le sous-app
 * `api` qui porte authMiddleware, cf. app.ts) : aucun token requis. Portée
 * volontairement étroite et strictement en lecture, réservée à la vitrine
 * maidere-connect (recherche de prestataires, fiche publique, promotions
 * actives) — cf. docs/integration/04-API-MAPPING.md, gap "accès public".
 *
 * Chaque requête ré-applique explicitement `statut = 'actif'`
 * (prestataires) / `publie = true` (offres) / `active = true` (promotions)
 * — le même filtre que les policies RLS *_select_public de
 * packages/db/drizzle/0028_offres_promotions_realisations_rls.sql, qui
 * protégeraient un futur accès Supabase direct si cette route venait à
 * disparaître. Toujours en lecture seule : aucune route ici n'insère,
 * ne met à jour ni ne supprime quoi que ce soit.
 *
 * Les avis exposés ici (note/commentaire/reponse/created_at) omettent
 * volontairement toute information identifiant le client auteur — aucune
 * colonne client_id/nom n'est sélectionnée, cf. docs/integration/
 * 06-BUSINESS-LOGIC-MAPPING.md pour le rappel du modèle (avis.matching_id,
 * jamais avis.prestataire_id).
 */
export const publicRouter = new Hono<{ Variables: HonoVariables }>()

if (!supabaseAdmin) {
  publicRouter.all('*', (c) => c.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 503))
}
const db = supabaseAdmin!

const PRESTATAIRE_PUBLIC_FIELDS =
  'id, nom, telephone, quartier, ville, metier, bio, disponible, zones_couverture, note_moyenne, statut'
const OFFRE_PUBLIC_FIELDS =
  'id, prestataire_id, categorie, titre, description, prestations, prix, unite_prix, delai_heures'
const PROMOTION_PUBLIC_FIELDS =
  'id, prestataire_id, offre_id, titre, description, remise_pct, debut, fin'
const REALISATION_PUBLIC_FIELDS = 'id, prestataire_id, titre, description, image_url'
const AVIS_PUBLIC_FIELDS = 'id, note, commentaire, reponse, created_at'

// ── GET /api/public/prestataires — annuaire public, filtres ville/quartier/métier/nom ──
publicRouter.get('/prestataires', async (c) => {
  const { ville, quartier, categorie, recherche } = c.req.query()

  let query = db.from('prestataires').select(PRESTATAIRE_PUBLIC_FIELDS).eq('statut', 'actif')
  if (ville) query = query.eq('ville', ville)
  if (quartier) query = query.eq('quartier', quartier)
  if (categorie) query = query.eq('metier', categorie)
  if (recherche) query = query.ilike('nom', `%${recherche}%`)

  const { data, error } = await query.order('note_moyenne', { ascending: false }).order('nom').limit(60)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ── GET /api/public/prestataires/:id — fiche publique complète ───────────────
publicRouter.get('/prestataires/:id', async (c) => {
  const id = c.req.param('id')

  const { data: prestataire, error } = await db
    .from('prestataires')
    .select(PRESTATAIRE_PUBLIC_FIELDS)
    .eq('id', id)
    .eq('statut', 'actif')
    .maybeSingle()

  if (error) return c.json({ error: error.message }, 500)
  if (!prestataire) return c.json({ data: null })

  const [offres, promotions, realisations, matchingsRealises] = await Promise.all([
    db.from('offres').select(OFFRE_PUBLIC_FIELDS).eq('prestataire_id', id).eq('publie', true),
    db.from('promotions').select(PROMOTION_PUBLIC_FIELDS).eq('prestataire_id', id).eq('active', true),
    db.from('realisations').select(REALISATION_PUBLIC_FIELDS).eq('prestataire_id', id).order('created_at', { ascending: false }),
    db.from('matchings').select('id').eq('prestataire_id', id).eq('statut', 'realise'),
  ])

  const matchingIds = (matchingsRealises.data ?? []).map((m) => (m as { id: string }).id)
  const avis = matchingIds.length
    ? (
        await db.from('avis').select(AVIS_PUBLIC_FIELDS).in('matching_id', matchingIds).order('created_at', { ascending: false })
      ).data ?? []
    : []

  return c.json({
    data: {
      prestataire,
      offres: offres.data ?? [],
      promotions: promotions.data ?? [],
      realisations: realisations.data ?? [],
      avis,
    },
  })
})

// ── GET /api/public/promotions — promotions actives, tous prestataires actifs confondus ──
publicRouter.get('/promotions', async (c) => {
  const { limit } = c.req.query()
  const max = Math.min(Number(limit) || 20, 60)

  // `active=true` seul ne suffit pas : il faut aussi que le prestataire
  // porteur soit `actif` (une promo créée avant une suspension ne doit pas
  // rester visible publiquement) — cf. promotions_select_public (0028).
  const { data: actifs, error: errActifs } = await db.from('prestataires').select('id').eq('statut', 'actif')
  if (errActifs) return c.json({ error: errActifs.message }, 500)
  const ids = (actifs ?? []).map((p) => (p as { id: string }).id)
  if (ids.length === 0) return c.json({ data: [] })

  const { data, error } = await db
    .from('promotions')
    .select(PROMOTION_PUBLIC_FIELDS)
    .eq('active', true)
    .in('prestataire_id', ids)
    .order('remise_pct', { ascending: false })
    .limit(max)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})
