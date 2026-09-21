/**
 * Dossier prestataire en 3 paliers — VERSION PROVISOIRE (cf. 0035).
 *
 *  Palier 1 « matchable » : nom, téléphone, catégorie, localisation, ≥1 offre.
 *  Palier 2 « vérifié »   : pièce d'identité vue, adresse d'activité,
 *                           réalisations vues, ≥1 référence, CGU acceptées.
 *  Palier 3 « paiement »  : Mobile Money, statut fiscal, commission convenue.
 *
 * Purement informatif : aucun palier ne bloque l'activation ni une mise en
 * relation. Le palier atteint est TOUJOURS calculé ici, jamais stocké.
 * Un palier n'est atteint que si les précédents le sont.
 */
import { z } from 'zod'

export const IDENTITE_TYPES = ['cni', 'passeport', 'recepisse', 'niu_rccm'] as const
export const MM_OPERATEURS = ['mtn', 'orange'] as const

const ReferenceContactSchema = z.object({
  nom: z.string().trim().min(1).max(100),
  telephone: z.string().trim().min(6).max(30),
})
export type ReferenceContact = z.infer<typeof ReferenceContactSchema>

const texteNullable = (max: number) => z.string().trim().max(max).nullable().optional()

/** PUT /api/prestataires/:id/paliers — staff seulement. Tous les champs sont optionnels (mise à jour partielle).
 *  Les cases à cocher (…_verifiee, …_acceptees, …_convenue) sont converties en date côté API. */
export const UpdatePrestatairePaliersSchema = z.object({
  identite_type: z.enum(IDENTITE_TYPES).nullable().optional(),
  identite_verifiee: z.boolean().optional(),
  adresse_activite: texteNullable(300),
  realisations_verifiees: z.boolean().optional(),
  references_contacts: z.array(ReferenceContactSchema).max(5).optional(),
  conditions_acceptees: z.boolean().optional(),
  mm_operateur: z.enum(MM_OPERATEURS).nullable().optional(),
  mm_numero: texteNullable(30),
  mm_titulaire: texteNullable(100),
  statut_fiscal: texteNullable(200),
  commission_convenue: z.boolean().optional(),
})
export type UpdatePrestatairePaliersInput = z.infer<typeof UpdatePrestatairePaliersSchema>

/** Ligne de la table prestataire_paliers (forme API). */
export interface PrestatairePaliersDossier {
  prestataire_id: string
  identite_type: (typeof IDENTITE_TYPES)[number] | null
  identite_verifiee_at: string | null
  adresse_activite: string | null
  realisations_verifiees: boolean
  references_contacts: ReferenceContact[]
  conditions_acceptees_at: string | null
  verifie_par: string | null
  verifie_at: string | null
  mm_operateur: (typeof MM_OPERATEURS)[number] | null
  mm_numero: string | null
  mm_titulaire: string | null
  statut_fiscal: string | null
  commission_convenue_at: string | null
}

export interface PalierStatut {
  complet: boolean
  manquants: string[]
}
export interface PaliersCalcules {
  palier1: PalierStatut
  palier2: PalierStatut
  palier3: PalierStatut
  /** Plus haut palier atteint sans trou (0 = aucun). */
  palier_atteint: 0 | 1 | 2 | 3
}

export interface PalierPrestataireSource {
  nom: string | null
  telephone: string | null
  categories: string[] | null
  metier_id: string | null
  quartier: string | null
  ville: string | null
  zones_couverture: string[] | null
}

const rempli = (v: string | null | undefined) => Boolean(v && v.trim() !== '')

export function calculerPaliers(
  prestataire: PalierPrestataireSource,
  nbOffres: number,
  dossier: Partial<PrestatairePaliersDossier> | null,
): PaliersCalcules {
  const d = dossier ?? {}

  const m1: string[] = []
  if (!rempli(prestataire.nom)) m1.push('Nom')
  if (!rempli(prestataire.telephone)) m1.push('Téléphone')
  if (!(prestataire.categories?.length || prestataire.metier_id)) m1.push('Catégorie de service')
  if (!(rempli(prestataire.quartier) || rempli(prestataire.ville) || prestataire.zones_couverture?.length)) {
    m1.push('Localisation / zones couvertes')
  }
  if (nbOffres < 1) m1.push('Au moins une offre avec prix')

  const m2: string[] = []
  if (!d.identite_type || !d.identite_verifiee_at) m2.push("Pièce d'identité vue")
  if (!rempli(d.adresse_activite)) m2.push("Adresse d'activité")
  if (!d.realisations_verifiees) m2.push('Réalisations vérifiées')
  if (!d.references_contacts?.length) m2.push('Au moins une référence')
  if (!d.conditions_acceptees_at) m2.push('Conditions acceptées')

  const m3: string[] = []
  if (!d.mm_operateur) m3.push('Opérateur Mobile Money')
  if (!rempli(d.mm_numero)) m3.push('Numéro Mobile Money')
  if (!rempli(d.mm_titulaire)) m3.push('Titulaire du compte')
  if (!rempli(d.statut_fiscal)) m3.push('Statut fiscal')
  if (!d.commission_convenue_at) m3.push('Commission convenue')

  const p1 = m1.length === 0
  const p2 = m2.length === 0
  const p3 = m3.length === 0
  const atteint = !p1 ? 0 : !p2 ? 1 : !p3 ? 2 : 3

  return {
    palier1: { complet: p1, manquants: m1 },
    palier2: { complet: p2, manquants: m2 },
    palier3: { complet: p3, manquants: m3 },
    palier_atteint: atteint,
  }
}
