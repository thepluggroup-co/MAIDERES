import { z } from 'zod'

export const PromotionSchema = z.object({
  id: z.string().uuid(),
  prestataire_id: z.string().uuid(),
  offre_id: z.string().uuid().nullable(),
  titre: z.string(),
  description: z.string().nullable(),
  remise_pct: z.string(),
  debut: z.string().nullable(),
  fin: z.string().nullable(),
  active: z.boolean(),
  created_at: z.string(),
})
export type Promotion = z.infer<typeof PromotionSchema>

/** POST /api/promotions — self-service. `debut` défaut DB (now()), `active` toujours true à la création. */
export const CreatePromotionSchema = z.object({
  offre_id: z.string().uuid().nullable().optional(),
  titre: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).nullable().optional(),
  remise_pct: z.number().min(0.01).max(100),
  fin: z.string().datetime().nullable().optional(),
  prestataire_id: z.string().uuid().optional(), // staff seulement
})
export type CreatePromotionInput = z.infer<typeof CreatePromotionSchema>

export const UpdatePromotionSchema = z.object({
  titre: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  remise_pct: z.number().min(0.01).max(100).optional(),
  fin: z.string().datetime().nullable().optional(),
  active: z.boolean().optional(),
})
export type UpdatePromotionInput = z.infer<typeof UpdatePromotionSchema>

/** Champs exposés côté vitrine publique — jamais created_at/active. */
export const PromotionPublicSchema = PromotionSchema.omit({ created_at: true, active: true })
export type PromotionPublic = z.infer<typeof PromotionPublicSchema>
