import { z } from 'zod'
import { MatchingStatutSchema } from './enums'

export const MatchingSchema = z.object({
  id: z.string().uuid(),
  demande_id: z.string().uuid(),
  prestataire_id: z.string().uuid(),
  operateur_id: z.string().uuid().nullable(),
  statut: MatchingStatutSchema,
  motif_echec: z.string().nullable(),
  proposed_at: z.string(),
  closed_at: z.string().nullable(),
})
export type Matching = z.infer<typeof MatchingSchema>

/** POST /api/matchings — proposer un prestataire pour une demande (staff uniquement). */
export const ProposeMatchingSchema = z.object({
  demande_id: z.string().uuid(),
  prestataire_id: z.string().uuid(),
})
export type ProposeMatchingInput = z.infer<typeof ProposeMatchingSchema>

/** PATCH /api/matchings/:id/refuser — prestataire uniquement, son propre matching 'propose'. */
export const RefuserMatchingSchema = z.object({
  motif_echec: z.string().trim().max(500).nullable().optional(),
})
export type RefuserMatchingInput = z.infer<typeof RefuserMatchingSchema>

/** PATCH /api/matchings/:id/cloturer — staff ou le prestataire assigné, jamais le client. */
export const CloturerMatchingSchema = z.object({
  issue: z.enum(['realise', 'echoue']),
  motif_echec: z.string().trim().max(500).nullable().optional(),
})
export type CloturerMatchingInput = z.infer<typeof CloturerMatchingSchema>
