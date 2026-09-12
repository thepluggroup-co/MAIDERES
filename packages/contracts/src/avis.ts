import { z } from 'zod'

export const AvisSchema = z.object({
  id: z.string().uuid(),
  matching_id: z.string().uuid(),
  note: z.number().int().min(1).max(5),
  commentaire: z.string().nullable(),
  reponse: z.string().nullable(),
  created_at: z.string(),
})
export type Avis = z.infer<typeof AvisSchema>

/** POST /api/avis — le client laisse un avis sur son propre matching 'realise'. */
export const CreateAvisSchema = z.object({
  matching_id: z.string().uuid(),
  note: z.number().int().min(1).max(5),
  commentaire: z.string().trim().max(1000).nullable().optional(),
})
export type CreateAvisInput = z.infer<typeof CreateAvisSchema>

/** PATCH /api/avis/:id — le prestataire concerné répond publiquement (ou staff). Jamais note/commentaire. */
export const UpdateAvisReponseSchema = z.object({
  reponse: z.string().trim().max(1000).nullable(),
})
export type UpdateAvisReponseInput = z.infer<typeof UpdateAvisReponseSchema>

/** Champs exposés côté vitrine publique (GET /api/public/prestataires/:id) — jamais d'info identifiant le client. */
export const AvisPublicSchema = z.object({
  id: z.string().uuid(),
  note: z.number().int().min(1).max(5),
  commentaire: z.string().nullable(),
  reponse: z.string().nullable(),
  created_at: z.string(),
})
export type AvisPublic = z.infer<typeof AvisPublicSchema>
