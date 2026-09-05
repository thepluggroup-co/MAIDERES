import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

export type NiveauUrgence = 'immediate' | 'urgent' | 'planifie'

export interface SlaConfig {
  id:                  string
  niveau_urgence:      NiveauUrgence
  delai_heures:        number
  seuil_alerte_heures: number
  created_at:          string
}

export function useSlaConfig() {
  return useQuery({
    queryKey: ['sla_config'],
    queryFn:  () => apiClient.get<{ data: SlaConfig[] }>('/api/sla_config'),
    select:   (res) => res.data,
  })
}

export function useUpdateSlaConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; delai_heures?: number; seuil_alerte_heures?: number }) =>
      apiClient.patch<{ data: SlaConfig }>(`/api/sla_config/${id}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sla_config'] })
      toast.success('Délai SLA mis à jour')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de mise à jour'),
  })
}
