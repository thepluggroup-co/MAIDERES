import { z } from 'zod'

export const RealisationSchema = z.object({
  id: z.string().uuid(),
  prestataire_id: z.string().uuid(),
  titre: z.string().nullable(),
  description: z.string().nullable(),
  image_url: z.string(),
  created_at: z.string(),
})
export type Realisation = z.infer<typeof RealisationSchema>

/** POST /api/realisations — self-service. `image_url` pointe vers le bucket Storage `maideres`. */
export const CreateRealisationSchema = z.object({
  titre: z.string().trim().max(150).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  image_url: z.string().trim().min(1).max(2000),
  prestataire_id: z.string().uuid().optional(), // staff seulement
})
export type CreateRealisationInput = z.infer<typeof CreateRealisationSchema>

/** Champs exposés côté vitrine publique — jamais created_at. */
export const RealisationPublicSchema = RealisationSchema.omit({ created_at: true })
export type RealisationPublic = z.infer<typeof RealisationPublicSchema>
