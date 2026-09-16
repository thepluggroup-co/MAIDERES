import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import type { Demande, DemandeCanal, DemandeStatut, NiveauUrgence } from '@maideres/contracts'

export type { Demande, DemandeCanal, DemandeStatut, NiveauUrgence }

export interface DemandesFilter {
  statut?:    DemandeStatut
  categorie?: string
  canal?:     DemandeCanal
  urgence?:   NiveauUrgence
}

function buildQuery(filter: DemandesFilter): string {
  const params = new URLSearchParams()
  if (filter.statut)    params.set('statut', filter.statut)
  if (filter.categorie) params.set('categorie', filter.categorie)
  if (filter.canal)     params.set('canal', filter.canal)
  if (filter.urgence)   params.set('urgence', filter.urgence)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function useDemandes(filter: DemandesFilter = {}) {
  return useQuery({
    queryKey: ['demandes', filter],
    queryFn:  () => apiClient.get<{ data: Demande[] }>(`/api/demandes${buildQuery(filter)}`),
    select:   (res) => res.data,
  })
}

export function useDemande(id: string | null) {
  return useQuery({
    queryKey: ['demandes', 'detail', id],
    queryFn:  () => apiClient.get<{ data: Demande }>(`/api/demandes/${id}`),
    select:   (res) => res.data,
    enabled:  Boolean(id),
  })
}

export interface CreateDemandeInput {
  client_id?:      string
  categorie_id:    string
  description:     string
  localisation?:   string | null
  canal:           DemandeCanal
  niveau_urgence:  NiveauUrgence
  date_souhaitee?: string | null
}

export function useCreateDemande() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDemandeInput) =>
      apiClient.post<{ data: Demande }>('/api/demandes', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['demandes'] })
      toast.success('Demande créée')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de création'),
  })
}

export function useUpdateDemandeStatut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: DemandeStatut }) =>
      apiClient.patch<{ data: Demande }>(`/api/demandes/${id}/statut`, { statut }),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['demandes'] })
      void qc.invalidateQueries({ queryKey: ['demandes', 'detail', variables.id] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de mise à jour'),
  })
}
