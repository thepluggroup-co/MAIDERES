import { z } from 'zod'
import { PaiementStatutSchema } from './enums'

/** commission_taux/commission_montant : toujours écrasés par trigger (0011), jamais fournis par l'appelant. */
export const TransactionSchema = z.object({
  id: z.string().uuid(),
  matching_id: z.string().uuid(),
  montant_service: z.number().int(),
  commission_taux: z.string(),
  commission_montant: z.number().int(),
  statut_paiement: PaiementStatutSchema,
  ref_notchpay: z.string().nullable(),
  created_at: z.string(),
})
export type Transaction = z.infer<typeof TransactionSchema>

/**
 * POST /api/transactions — staff, uniquement pour un matching 'realise'.
 * `commission_taux`/`commission_montant` ne sont jamais acceptés en entrée :
 * ils viennent exclusivement du trigger trg_transactions_commission (0011).
 * Pas de `statut_paiement`/`ref_notchpay` à la création non plus — ces
 * champs suivent leurs propres valeurs par défaut en base, jamais fournis
 * par l'appelant à ce stade (pas d'intégration paiement branchée encore).
 */
export const CreateTransactionSchema = z.object({
  matching_id: z.string().uuid(),
  montant_service: z.number().int().positive(),
})
export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>

/** GET /api/transactions/preview-commission — estimation avant création, staff. */
export const PreviewCommissionQuerySchema = z.object({
  montant_service: z.coerce.number().int().positive(),
  categorie_id: z.string().uuid().optional(),
  prestataire_id: z.string().uuid().optional(),
})
export type PreviewCommissionQuery = z.infer<typeof PreviewCommissionQuerySchema>
