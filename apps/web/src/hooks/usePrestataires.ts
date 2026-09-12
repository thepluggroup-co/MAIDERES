import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import type { Prestataire, PrestataireStatut } from '@maideres/contracts'

export type { Prestataire, PrestataireStatut }

export interface PrestatairesFilter {
  categorie?: string
  quartier?:  string
  statut?:    PrestataireStatut
}

function buildQuery(filter: PrestatairesFilter): string {
  const params = new URLSearchParams()
  if (filter.categorie) params.set('categorie', filter.categorie)
  if (filter.quartier)  params.set('quartier', filter.quartier)
  if (filter.statut)    params.set('statut', filter.statut)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function usePrestataires(filter: PrestatairesFilter = {}) {
  return useQuery({
    queryKey: ['prestataires', filter],
    queryFn:  () => apiClient.get<{ data: Prestataire[] }>(`/api/prestataires${buildQuery(filter)}`),
    select:   (res) => res.data,
  })
}

export interface CreatePrestataireInput {
  nom:         string
  telephone:   string
  categories:  string[]
  quartier?:   string | null
  geoloc_lat?: number | null
  geoloc_lng?: number | null
}

export function useCreatePrestataire() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePrestataireInput) =>
      apiClient.post<{ data: Prestataire }>('/api/prestataires', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['prestataires'] })
      toast.success('Prestataire créé')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de création'),
  })
}

export interface UpdatePrestataireInput {
  nom?:             string
  telephone?:       string
  categories?:      string[]
  quartier?:        string | null
  geoloc_lat?:      number | null
  geoloc_lng?:      number | null
  // staff seulement. null = retirer l'override (revenir à commission_config).
  taux_commission?: number | null
}

export function useUpdatePrestataire() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & UpdatePrestataireInput) =>
      apiClient.patch<{ data: Prestataire }>(`/api/prestataires/${id}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['prestataires'] })
      toast.success('Fiche mise à jour')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de mise à jour'),
  })
}

export function useUpdatePrestataireStatut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: PrestataireStatut }) =>
      apiClient.patch<{ data: Prestataire }>(`/api/prestataires/${id}/statut`, { statut }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['prestataires'] })
      toast.success('Statut mis à jour')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de mise à jour'),
  })
}
