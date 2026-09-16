import { z } from 'zod'
import { NiveauUrgenceSchema } from './enums'

export const SlaConfigSchema = z.object({
  id: z.string().uuid(),
  niveau_urgence: NiveauUrgenceSchema,
  delai_heures: z.number().int(),
  seuil_alerte_heures: z.number().int(),
  created_at: z.string(),
})
export type SlaConfig = z.infer<typeof SlaConfigSchema>

export const UpdateSlaConfigSchema = z.object({
  delai_heures: z.coerce.number().int().positive().optional(),
  seuil_alerte_heures: z.coerce.number().int().min(0).optional(),
}).refine(
  (body) => body.delai_heures === undefined || body.seuil_alerte_heures === undefined || body.seuil_alerte_heures < body.delai_heures,
  { message: 'seuil_alerte_heures doit être inférieur à delai_heures' },
)
export type UpdateSlaConfigInput = z.infer<typeof UpdateSlaConfigSchema>
