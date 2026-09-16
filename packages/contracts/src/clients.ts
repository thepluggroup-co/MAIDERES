import { z } from 'zod'
import { TypeClientSchema, SourceClientSchema } from './enums'

export const ClientSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  nom: z.string(),
  telephone: z.string(),
  quartier: z.string().nullable(),
  type_client: TypeClientSchema,
  niu: z.string().nullable(),
  whatsapp: z.string().nullable(),
  email: z.string().nullable(),
  source: SourceClientSchema,
})
export type Client = z.infer<typeof ClientSchema>

function requiresNiu(typeClient: string | undefined): boolean {
  return typeClient === 'entreprise' || typeClient === 'organisation'
}

/** POST /api/clients — auto-inscription. NIU requis pour entreprise/organisation (règle applicative, pas de contrainte DB). */
export const CreateClientSchema = z.object({
  nom: z.string().trim().min(1).max(100),
  telephone: z.string().trim().min(6).max(30),
  quartier: z.string().trim().max(100).nullable().optional(),
  type_client: TypeClientSchema.default('particulier'),
  niu: z.string().trim().max(50).nullable().optional(),
  whatsapp: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email().max(150).nullable().optional(),
  source: SourceClientSchema.default('whatsapp'),
  profile_id: z.string().uuid().optional(), // staff seulement : créer pour un autre profil
}).refine(
  (body) => !requiresNiu(body.type_client) || Boolean(body.niu?.trim()),
  { message: 'Le NIU est requis pour une entreprise ou une organisation', path: ['niu'] },
)
export type CreateClientInput = z.infer<typeof CreateClientSchema>

export const UpdateClientSchema = z.object({
  nom: z.string().trim().min(1).max(100).optional(),
  telephone: z.string().trim().min(6).max(30).optional(),
  quartier: z.string().trim().max(100).nullable().optional(),
  type_client: TypeClientSchema.optional(),
  niu: z.string().trim().max(50).nullable().optional(),
  whatsapp: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email().max(150).nullable().optional(),
  source: SourceClientSchema.optional(),
})
export type UpdateClientInput = z.infer<typeof UpdateClientSchema>
