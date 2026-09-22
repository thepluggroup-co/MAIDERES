import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { supabaseAdmin } from '@maideres/db'
import { CreatePrestataireSchema, UpdatePrestataireSchema, UpdatePrestataireStatutSchema, UpdatePrestatairePiloteSchema, UpdatePrestatairePaliersSchema, DocumentTypeSchema, DOCUMENT_MAX_BYTES, calculerPaliers } from '@maideres/contracts'
import type { PrestatairePaliersDossier, DocumentType } from '@maideres/contracts'
import type { HonoVariables } from '../types'
import { requireRole } from '../middleware/rbac'
import { isStaff, ownPrestataireId } from '../services/identity.service'

export const prestatairesRouter = new Hono<{ Variables: HonoVariables }>()

if (!supabaseAdmin) {
  prestatairesRouter.all('*', (c) => c.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 503))
}
const db = supabaseAdmin!

const PRESTATAIRE_FIELDS =
  'id, profile_id, nom, telephone, categories, quartier, geoloc_lat, geoloc_lng, statut, note_moyenne, taux_commission, date_recrutement, ville, metier_id, metier_categorie:categories_services(libelle), bio, disponible, zones_couverture, pilote'

// Même aplatissement que côté public (cf. apps/api/src/routes/public.ts) :
// l'embed Supabase `metier_categorie:categories_services(libelle)` devient
// un champ scalaire `metier_libelle`, pour rester simple à consommer.
// Le typage supabase-js générique (aucun type de schéma généré) laisse
// deviner à TS un tableau pour l'embed alors qu'une FK vers une PK renvoie
// un objet unique à l'exécution (comportement standard PostgREST) — on
// accepte donc les deux formes possibles par sécurité.
type MetierCategorieEmbed = { libelle: string } | { libelle: string }[] | null | undefined
function aplatirMetier<T extends { metier_categorie?: MetierCategorieEmbed }>(
  row: T,
): Omit<T, 'metier_categorie'> & { metier_libelle: string | null } {
  const { metier_categorie, ...reste } = row
  const embed = Array.isArray(metier_categorie) ? metier_categorie[0] : metier_categorie
  return { ...reste, metier_libelle: embed?.libelle ?? null }
}

// ── GET /api/prestataires — liste, filtrée par rôle ───────────────────────────
// staff : tout. prestataire : sa propre ligne (tout statut). client : uniquement statut=actif.
prestatairesRouter.get('/', async (c) => {
  const user = c.get('user')
  const { categorie, quartier, statut, pilote } = c.req.query()

  let query = db.from('prestataires').select(PRESTATAIRE_FIELDS)

  if (isStaff(user.role)) {
    if (statut) query = query.eq('statut', statut)
    if (pilote !== undefined) query = query.eq('pilote', pilote === 'true')
  } else {
    const own = await ownPrestataireId(user.id)
    if (own) {
      query = query.eq('id', own)
    } else {
      // Pas de fiche prestataire → identité "client" : uniquement les actifs.
      query = query.eq('statut', 'actif')
    }
  }

  if (categorie) query = query.contains('categories', [categorie])
  if (quartier) query = query.eq('quartier', quartier)

  const { data, error } = await query.order('nom')
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data: (data ?? []).map(aplatirMetier) })
})

// ── GET /api/prestataires/:id ──────────────────────────────────────────────
prestatairesRouter.get('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { data, error } = await db.from('prestataires').select(PRESTATAIRE_FIELDS).eq('id', id).maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) throw new HTTPException(404, { message: 'Prestataire introuvable' })

  const row = data as { profile_id: string; statut: string }
  if (isStaff(user.role) || row.profile_id === user.id || row.statut === 'actif') {
    return c.json({ data: aplatirMetier(data) })
  }
  throw new HTTPException(403, { message: 'Accès refusé' })
})

// ── POST /api/prestataires — inscription (statut toujours en_attente) ────────
prestatairesRouter.post('/', zValidator('json', CreatePrestataireSchema), async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')

  const profileId = isStaff(user.role) && body.profile_id ? body.profile_id : user.id

  const existing = await ownPrestataireIdFor(profileId)
  if (existing) throw new HTTPException(409, { message: 'Ce profil a déjà une fiche prestataire' })

  const { data, error } = await db
    .from('prestataires')
    .insert({
      profile_id:       profileId,
      nom:              body.nom,
      telephone:        body.telephone,
      // Le métier auto-déclaré (0031) rejoint aussi les catégories de
      // dispatch staff, pour qu'un prestataire inscrit avec un métier soit
      // immédiatement matchable dessus — cf. décision du 15/09/2026
      // (fusion demandée après confusion Console 360 vs Profil PRO).
      categories:       body.metier_id
        ? Array.from(new Set([...(body.categories ?? []), body.metier_id]))
        : (body.categories ?? []),
      quartier:         body.quartier ?? null,
      geoloc_lat:       body.geoloc_lat ?? null,
      geoloc_lng:       body.geoloc_lng ?? null,
      statut:           'en_attente',
      date_recrutement: new Date().toISOString(),
      ville:            body.ville ?? null,
      metier_id:        body.metier_id ?? null,
      bio:              body.bio ?? null,
      ...(body.zones_couverture !== undefined ? { zones_couverture: body.zones_couverture } : {}),
    })
    .select(PRESTATAIRE_FIELDS)
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data: aplatirMetier(data) }, 201)
})

async function ownPrestataireIdFor(profileId: string): Promise<string | null> {
  const { data } = await db.from('prestataires').select('id').eq('profile_id', profileId).maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

// ── PATCH /api/prestataires/:id — staff : tout ; soi-même : champs non sensibles ──
prestatairesRouter.patch('/:id', zValidator('json', UpdatePrestataireSchema), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const { data: row, error: findError } = await db.from('prestataires').select('profile_id, categories').eq('id', id).maybeSingle()
  if (findError) return c.json({ error: findError.message }, 500)
  if (!row) throw new HTTPException(404, { message: 'Prestataire introuvable' })

  const staff = isStaff(user.role)
  const isOwner = (row as { profile_id: string }).profile_id === user.id
  if (!staff && !isOwner) throw new HTTPException(403, { message: 'Accès refusé' })

  if (!staff && body.taux_commission !== undefined) {
    throw new HTTPException(403, { message: 'Seul le staff peut modifier taux_commission' })
  }

  const update: Record<string, unknown> = {}
  if (body.nom             !== undefined) update.nom = body.nom
  if (body.telephone       !== undefined) update.telephone = body.telephone
  if (body.categories      !== undefined) update.categories = body.categories
  if (body.quartier        !== undefined) update.quartier = body.quartier
  if (body.geoloc_lat      !== undefined) update.geoloc_lat = body.geoloc_lat
  if (body.geoloc_lng      !== undefined) update.geoloc_lng = body.geoloc_lng
  if (body.ville            !== undefined) update.ville = body.ville
  if (body.metier_id        !== undefined) update.metier_id = body.metier_id
  // Fusion métier déclaré -> catégories de dispatch (même logique qu'à la
  // création, cf. POST ci-dessus). N'ajoute jamais depuis `row.categories`
  // si `update.categories` vient déjà d'être posé ci-dessus par le body —
  // dans ce cas on fusionne dans CETTE valeur, pas dans l'ancienne de la DB.
  if (body.metier_id) {
    const base = (update.categories as string[] | undefined) ?? (row as { categories: string[] }).categories ?? []
    update.categories = Array.from(new Set([...base, body.metier_id]))
  }
  if (body.bio              !== undefined) update.bio = body.bio
  if (body.disponible       !== undefined) update.disponible = body.disponible
  if (body.zones_couverture !== undefined) update.zones_couverture = body.zones_couverture
  if (staff && body.taux_commission !== undefined) {
    update.taux_commission = body.taux_commission === null ? null : String(body.taux_commission)
  }

  if (!Object.keys(update).length) return c.json({ success: true })

  const { data, error } = await db.from('prestataires').update(update).eq('id', id).select(PRESTATAIRE_FIELDS).single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data: aplatirMetier(data) })
})

// ── PATCH /api/prestataires/:id/statut — validation de statut (staff) ────────
const STATUT_TRANSITIONS: Record<string, string[]> = {
  en_attente: ['actif', 'suspendu'],
  actif:      ['suspendu'],
  suspendu:   ['actif'],
}

prestatairesRouter.patch(
  '/:id/statut',
  requireRole(['admin', 'superviseur', 'operateur']),
  zValidator('json', UpdatePrestataireStatutSchema),
  async (c) => {
    const id = c.req.param('id')
    const { statut } = c.req.valid('json')

    const { data: row, error: findError } = await db.from('prestataires').select('statut').eq('id', id).maybeSingle()
    if (findError) return c.json({ error: findError.message }, 500)
    if (!row) throw new HTTPException(404, { message: 'Prestataire introuvable' })

    const current = (row as { statut: string }).statut
    if (current !== statut && !STATUT_TRANSITIONS[current]?.includes(statut)) {
      throw new HTTPException(422, { message: `Transition ${current} → ${statut} non autorisée` })
    }

    const { data, error } = await db.from('prestataires').update({ statut }).eq('id', id).select(PRESTATAIRE_FIELDS).single()
    if (error) return c.json({ error: error.message }, 500)
    return c.json({ data: aplatirMetier(data) })
  },
)

// ── PATCH /api/prestataires/:id/pilote — marquer l'échantillon pilote (staff) ──
prestatairesRouter.patch(
  '/:id/pilote',
  requireRole(['admin', 'superviseur', 'operateur']),
  zValidator('json', UpdatePrestatairePiloteSchema),
  async (c) => {
    const id = c.req.param('id')
    const { pilote } = c.req.valid('json')
    const { data, error } = await db.from('prestataires').update({ pilote }).eq('id', id).select(PRESTATAIRE_FIELDS).single()
    if (error) return c.json({ error: error.message }, 500)
    if (!data) throw new HTTPException(404, { message: 'Prestataire introuvable' })
    return c.json({ data: aplatirMetier(data) })
  },
)

// ── Dossier en 3 paliers (0035, PROVISOIRE, staff seulement) ──────────────────
// Informatif : ne bloque ni l'activation ni le dispatch. Le palier atteint est
// calculé à chaque lecture (packages/contracts/src/paliers.ts), jamais stocké.
async function chargerPaliers(prestataireId: string) {
  const { data: presta, error: prestaError } = await db
    .from('prestataires')
    .select('id, nom, telephone, categories, metier_id, quartier, ville, zones_couverture')
    .eq('id', prestataireId)
    .maybeSingle()
  if (prestaError) throw new HTTPException(500, { message: prestaError.message })
  if (!presta) throw new HTTPException(404, { message: 'Prestataire introuvable' })

  const { data: offres, error: offresError } = await db.from('offres').select('id').eq('prestataire_id', prestataireId)
  if (offresError) throw new HTTPException(500, { message: offresError.message })

  const { data: dossier, error: dossierError } = await db
    .from('prestataire_paliers').select('*').eq('prestataire_id', prestataireId).maybeSingle()
  if (dossierError) throw new HTTPException(500, { message: dossierError.message })

  const d = (dossier ?? null) as PrestatairePaliersDossier | null
  return {
    presta: presta as Parameters<typeof calculerPaliers>[0],
    nbOffres: (offres ?? []).length,
    dossier: d,
  }
}

prestatairesRouter.get('/:id/paliers', requireRole(['admin', 'superviseur', 'operateur']), async (c) => {
  const { presta, nbOffres, dossier } = await chargerPaliers(c.req.param('id'))
  return c.json({ data: { dossier, paliers: calculerPaliers(presta, nbOffres, dossier) } })
})

type Utilisateur = { id: string }

/** Applique un patch au dossier (insert ou update), maintient la trace de vérification
 *  (verifie_par / verifie_at : posée quand le palier 2 est complet, effacée sinon) et
 *  renvoie le dossier + les paliers recalculés. Partagé par PUT et les routes documents. */
async function enregistrerDossier(
  id: string,
  user: Utilisateur,
  patch: Record<string, unknown>,
) {
  const { presta, nbOffres, dossier: avant } = await chargerPaliers(id)
  const now = new Date().toISOString()

  const apres = { ...(avant ?? {}), ...patch } as Partial<PrestatairePaliersDossier>
  const calcul = calculerPaliers(presta, nbOffres, apres)
  if (calcul.palier2.complet) {
    patch.verifie_par = avant?.verifie_par ?? user.id
    patch.verifie_at = avant?.verifie_at ?? now
  } else {
    patch.verifie_par = null
    patch.verifie_at = null
  }
  patch.updated_at = now

  const q = avant
    ? db.from('prestataire_paliers').update(patch).eq('prestataire_id', id)
    : db.from('prestataire_paliers').insert({ prestataire_id: id, ...patch })
  const { data, error } = await q.select('*').single()
  if (error) throw new HTTPException(500, { message: error.message })

  const dossier = data as PrestatairePaliersDossier
  return { dossier, paliers: calculerPaliers(presta, nbOffres, dossier) }
}

prestatairesRouter.put(
  '/:id/paliers',
  requireRole(['admin', 'superviseur', 'operateur']),
  zValidator('json', UpdatePrestatairePaliersSchema),
  async (c) => {
    const id = c.req.param('id')
    const user = c.get('user')
    const body = c.req.valid('json')
    const { dossier: avant } = await chargerPaliers(id)
    const now = new Date().toISOString()

    // Les cases à cocher deviennent des dates ; on garde la date d'origine si déjà cochée.
    const patch: Record<string, unknown> = {}
    for (const k of ['identite_type', 'adresse_activite', 'adresse_mobile', 'est_entreprise',
      'realisations_verifiees', 'references_contacts',
      'mm_operateur', 'mm_numero', 'mm_titulaire', 'statut_fiscal'] as const) {
      if (body[k] !== undefined) patch[k] = body[k]
    }
    const date = (flag: boolean | undefined, actuelle: string | null | undefined) =>
      flag === undefined ? undefined : flag ? (actuelle ?? now) : null
    const dates: [string, string | null | undefined][] = [
      ['identite_verifiee_at', date(body.identite_verifiee, avant?.identite_verifiee_at)],
      ['conditions_acceptees_at', date(body.conditions_acceptees, avant?.conditions_acceptees_at)],
      ['commission_convenue_at', date(body.commission_convenue, avant?.commission_convenue_at)],
    ]
    for (const [col, val] of dates) if (val !== undefined) patch[col] = val

    return c.json({ data: await enregistrerDossier(id, user, patch) })
  },
)

// ── Pièces justificatives PDF (0038) — pièce d'identité, RCCM, NIU ────────────
// Bucket Storage privé, accès uniquement ici (service role) ; consultation par URL
// signée de courte durée. Le PDF est vérifié par son contenu (signature %PDF-), pas
// seulement par le type MIME déclaré par le navigateur.
const DOCUMENTS_BUCKET = 'prestataire-documents'
const URL_SIGNEE_SECONDES = 120

const cheminDocument = (prestataireId: string, type: DocumentType) => `${prestataireId}/${type}.pdf`

prestatairesRouter.post(
  '/:id/paliers/documents/:type',
  requireRole(['admin', 'superviseur', 'operateur']),
  async (c) => {
    const id = c.req.param('id')
    const type = DocumentTypeSchema.safeParse(c.req.param('type'))
    if (!type.success) throw new HTTPException(400, { message: 'Type de document inconnu (identite, rccm ou niu)' })
    await chargerPaliers(id) // 404 si le prestataire n'existe pas

    const form = await c.req.parseBody()
    const fichier = form['file']
    if (!(fichier instanceof File)) throw new HTTPException(400, { message: 'Fichier manquant (champ « file »)' })
    if (fichier.size === 0) throw new HTTPException(400, { message: 'Fichier vide' })
    if (fichier.size > DOCUMENT_MAX_BYTES) {
      throw new HTTPException(413, { message: `Fichier trop volumineux (${Math.round(DOCUMENT_MAX_BYTES / 1024 / 1024)} Mo maximum)` })
    }
    const octets = new Uint8Array(await fichier.arrayBuffer())
    const entete = new TextDecoder().decode(octets.slice(0, 5))
    if (entete !== '%PDF-') throw new HTTPException(415, { message: 'Le fichier doit être un PDF' })

    const chemin = cheminDocument(id, type.data)
    const { error: uploadError } = await db.storage
      .from(DOCUMENTS_BUCKET)
      .upload(chemin, octets, { contentType: 'application/pdf', upsert: true })
    if (uploadError) return c.json({ error: uploadError.message }, 500)

    const patch = { [`doc_${type.data}_path`]: chemin, [`doc_${type.data}_at`]: new Date().toISOString() }
    return c.json({ data: await enregistrerDossier(id, c.get('user'), patch) }, 201)
  },
)

prestatairesRouter.get(
  '/:id/paliers/documents/:type',
  requireRole(['admin', 'superviseur', 'operateur']),
  async (c) => {
    const id = c.req.param('id')
    const type = DocumentTypeSchema.safeParse(c.req.param('type'))
    if (!type.success) throw new HTTPException(400, { message: 'Type de document inconnu (identite, rccm ou niu)' })
    const { dossier } = await chargerPaliers(id)
    const chemin = dossier?.[`doc_${type.data}_path` as keyof PrestatairePaliersDossier] as string | null | undefined
    if (!chemin) throw new HTTPException(404, { message: 'Aucun document déposé' })

    const { data, error } = await db.storage.from(DOCUMENTS_BUCKET).createSignedUrl(chemin, URL_SIGNEE_SECONDES)
    if (error || !data) return c.json({ error: error?.message ?? 'URL de consultation indisponible' }, 500)
    return c.json({ data: { url: data.signedUrl, expire_dans: URL_SIGNEE_SECONDES } })
  },
)

prestatairesRouter.delete(
  '/:id/paliers/documents/:type',
  requireRole(['admin', 'superviseur', 'operateur']),
  async (c) => {
    const id = c.req.param('id')
    const type = DocumentTypeSchema.safeParse(c.req.param('type'))
    if (!type.success) throw new HTTPException(400, { message: 'Type de document inconnu (identite, rccm ou niu)' })
    const { dossier } = await chargerPaliers(id)
    const chemin = dossier?.[`doc_${type.data}_path` as keyof PrestatairePaliersDossier] as string | null | undefined
    if (!chemin) throw new HTTPException(404, { message: 'Aucun document déposé' })

    const { error: removeError } = await db.storage.from(DOCUMENTS_BUCKET).remove([chemin])
    if (removeError) return c.json({ error: removeError.message }, 500)

    const patch = { [`doc_${type.data}_path`]: null, [`doc_${type.data}_at`]: null }
    return c.json({ data: await enregistrerDossier(id, c.get('user'), patch) })
  },
)

// ── DELETE /api/prestataires/:id — staff seulement ────────────────────────────
prestatairesRouter.delete('/:id', requireRole(['admin', 'superviseur', 'operateur']), async (c) => {
  const id = c.req.param('id')
  const { error } = await db.from('prestataires').delete().eq('id', id)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
})
