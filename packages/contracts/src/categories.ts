import { z } from 'zod'

export const CategorieServiceSchema = z.object({
  id: z.string().uuid(),
  libelle: z.string(),
  actif: z.boolean(),
})
export type CategorieService = z.infer<typeof CategorieServiceSchema>

export const CreateCategorieServiceSchema = z.object({
  libelle: z.string().trim().min(1).max(100),
  actif: z.boolean().default(true),
})
export type CreateCategorieServiceInput = z.infer<typeof CreateCategorieServiceSchema>

export const UpdateCategorieServiceSchema = z.object({
  libelle: z.string().trim().min(1).max(100).optional(),
  actif: z.boolean().optional(),
})
export type UpdateCategorieServiceInput = z.infer<typeof UpdateCategorieServiceSchema>
