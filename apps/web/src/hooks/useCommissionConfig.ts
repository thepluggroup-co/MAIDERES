import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

export type TypeCommission = 'pourcentage' | 'montant_fixe'

export interface CommissionConfig {
  id:           string
  categorie_id: string | null   // null = règle globale
  type:         TypeCommission
  valeur:       string
  actif:        boolean
  created_at:   string
}

export function useCommissionConfig() {
  return useQuery({
    queryKey: ['commission_config'],
    queryFn:  () => apiClient.get<{ data: CommissionConfig[] }>('/api/commission_config'),
    select:   (res) => res.data,
  })
}

export interface CommissionConfigInput {
  categorie_id?: string | null
  type:          TypeCommission
  valeur:        number
  actif?:        boolean
}

export function useCreateCommissionConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CommissionConfigInput) =>
      apiClient.post<{ data: CommissionConfig }>('/api/commission_config', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['commission_config'] })
      toast.success('Règle de commission créée')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de création'),
  })
}

export function useUpdateCommissionConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<Pick<CommissionConfigInput, 'type' | 'valeur' | 'actif'>>) =>
      apiClient.patch<{ data: CommissionConfig }>(`/api/commission_config/${id}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['commission_config'] })
      toast.success('Règle de commission mise à jour')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de mise à jour'),
  })
}

export function useDeleteCommissionConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<{ success: boolean }>(`/api/commission_config/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['commission_config'] })
      toast.success('Règle de commission supprimée')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de suppression'),
  })
}
