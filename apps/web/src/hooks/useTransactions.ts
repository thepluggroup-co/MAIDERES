import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

export type StatutPaiement = 'en_attente' | 'paye' | 'echoue'

export interface Transaction {
  id:                 string
  matching_id:        string
  montant_service:    number
  commission_taux:    string
  // Calculé par le trigger DB (public.calculer_commission, 0011) — jamais
  // renseigné ni recalculé côté front.
  commission_montant: number
  statut_paiement:    StatutPaiement
  ref_notchpay:       string | null
  created_at:         string
}

export function useTransactions() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn:  () => apiClient.get<{ data: Transaction[] }>('/api/transactions'),
    select:   (res) => res.data,
  })
}
