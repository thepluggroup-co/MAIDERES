import { z } from 'zod'
import { ReversementStatutSchema } from './enums'

export const ReversementSchema = z.object({
  id: z.string().uuid(),
  prestataire_id: z.string().uuid(),
  montant: z.number().int(),
  statut: ReversementStatutSchema,
  ref: z.string().nullable(),
  date_paiement: z.string().nullable(),
  created_at: z.string(),
})
export type Reversement = z.infer<typeof ReversementSchema>
