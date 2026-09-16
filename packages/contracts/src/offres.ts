import { z } from 'zod'

export const OffreSchema = z.object({
  id: z.string().uuid(),
  prestataire_id: z.string().uuid(),
  categorie: z.string(),
  titre: z.string(),
  description: z.string().nullable(),
  prestations: z.array(z.string()),
  prix: z.number().int(),
  unite_prix: z.string(),
  delai_heures: z.number().int().nullable(),
  publie: z.boolean(),
  created_at: z.string(),
})
export type Offre = z.infer<typeof OffreSchema>

/** POST /api/offres — self-service (statut `publie` toujours `true` par défaut, non réglable à la création). */
export const CreateOffreSchema = z.object({
  categorie: z.string().trim().min(1).max(100),
  titre: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).nullable().optional(),
  prestations: z.array(z.string().trim().max(150)).default([]),
  prix: z.number().int().min(0),
  unite_prix: z.string().trim().min(1).max(30).default('forfait'),
  delai_heures: z.number().int().min(1).nullable().optional(),
  prestataire_id: z.string().uuid().optional(), // staff seulement : créer pour une autre fiche
})
export type CreateOffreInput = z.infer<typeof CreateOffreSchema>

export const UpdateOffreSchema = z.object({
  categorie: z.string().trim().min(1).max(100).optional(),
  titre: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  prestations: z.array(z.string().trim().max(150)).optional(),
  prix: z.number().int().min(0).optional(),
  unite_prix: z.string().trim().min(1).max(30).optional(),
  delai_heures: z.number().int().min(1).nullable().optional(),
  publie: z.boolean().optional(),
})
export type UpdateOffreInput = z.infer<typeof UpdateOffreSchema>

/** Champs exposés côté vitrine publique (GET /api/public/prestataires/:id) — jamais publie/created_at. */
export const OffrePublicSchema = OffreSchema.omit({ publie: true, created_at: true })
export type OffrePublic = z.infer<typeof OffrePublicSchema>
