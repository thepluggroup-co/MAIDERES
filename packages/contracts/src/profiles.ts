import { z } from 'zod'
import { RoleSchema } from './enums'

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  nom: z.string(),
  role: RoleSchema,
  telephone: z.string().nullable(),
  adresse: z.string().nullable(),
  actif: z.boolean(),
  created_at: z.string().optional(),
})
export type Profile = z.infer<typeof ProfileSchema>

/** GET /api/profile/me — profil + identité métier dérivée (apps/api/src/routes/profile.ts). */
export const MonIdentiteSchema = ProfileSchema.extend({
  is_staff: z.boolean(),
  client_id: z.string().uuid().nullable(),
  prestataire_id: z.string().uuid().nullable(),
})
export type MonIdentite = z.infer<typeof MonIdentiteSchema>

export const UpdateProfileSchema = z.object({
  nom: z.string().min(1).max(100).optional(),
  telephone: z.string().max(30).nullable().optional(),
  adresse: z.string().max(200).nullable().optional(),
})
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>
