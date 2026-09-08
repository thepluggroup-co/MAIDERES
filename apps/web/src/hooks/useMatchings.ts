import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import type { Matching, MatchingStatut } from '@maideres/contracts'

export type { Matching, MatchingStatut }

export function useMatchings(filter: { demande_id?: string; statut?: MatchingStatut } = {}) {
  const params = new URLSearchParams()
  if (filter.demande_id) params.set('demande_id', filter.demande_id)
  if (filter.statut)     params.set('statut', filter.statut)
  const qs = params.toString()

  return useQuery({
    queryKey: ['matchings', filter],
    queryFn:  () => apiClient.get<{ data: Matching[] }>(`/api/matchings${qs ? `?${qs}` : ''}`),
    select:   (res) => res.data,
  })
}

export function useProposerMatching() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { demande_id: string; prestataire_id: string }) =>
      apiClient.post<{ data: Matching }>('/api/matchings', input),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['matchings'] })
      void qc.invalidateQueries({ queryKey: ['demandes'] })
      void qc.invalidateQueries({ queryKey: ['demandes', 'detail', variables.demande_id] })
      toast.success('Prestataire proposé')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur lors de la proposition'),
  })
}

function invalidateAfterMatchingChange(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['matchings'] })
  void qc.invalidateQueries({ queryKey: ['demandes'] })
}

export function useClolturerMatching() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, issue, motif_echec }: { id: string; issue: 'realise' | 'echoue'; motif_echec?: string | null }) =>
      apiClient.patch<{ data: Matching }>(`/api/matchings/${id}/cloturer`, { issue, motif_echec }),
    onSuccess: () => {
      invalidateAfterMatchingChange(qc)
      toast.success('Matching clôturé')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de clôture'),
  })
}

export function useAccepterMatching() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.patch<{ data: Matching }>(`/api/matchings/${id}/accepter`, {}),
    onSuccess: () => {
      invalidateAfterMatchingChange(qc)
      toast.success('Matching accepté')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur'),
  })
}

export function useRefuserMatching() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, motif_echec }: { id: string; motif_echec?: string | null }) =>
      apiClient.patch<{ data: Matching }>(`/api/matchings/${id}/refuser`, { motif_echec }),
    onSuccess: () => {
      invalidateAfterMatchingChange(qc)
      toast.success('Matching refusé')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur'),
  })
}
