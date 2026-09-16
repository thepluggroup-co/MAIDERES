import { z } from 'zod'
import { TypeCommissionSchema } from './enums'

/** categorie_id absent/null = règle globale (fallback), jamais deux notions distinctes. */
export const CommissionConfigSchema = z.object({
  id: z.string().uuid(),
  categorie_id: z.string().uuid().nullable(),
  type: TypeCommissionSchema,
  valeur: z.string(),
  actif: z.boolean(),
  created_at: z.string(),
})
export type CommissionConfig = z.infer<typeof CommissionConfigSchema>

export const CreateCommissionConfigSchema = z.object({
  categorie_id: z.string().uuid().nullable().optional(),
  type: TypeCommissionSchema,
  valeur: z.coerce.number().nonnegative(),
  actif: z.boolean().default(true),
}).refine((body) => body.type !== 'pourcentage' || body.valeur <= 100, {
  message: 'Un taux en pourcentage ne peut pas dépasser 100',
})
export type CreateCommissionConfigInput = z.infer<typeof CreateCommissionConfigSchema>

export const UpdateCommissionConfigSchema = z.object({
  type: TypeCommissionSchema.optional(),
  valeur: z.coerce.number().nonnegative().optional(),
  actif: z.boolean().optional(),
})
export type UpdateCommissionConfigInput = z.infer<typeof UpdateCommissionConfigSchema>
