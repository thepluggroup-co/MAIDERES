import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

export type StatutIntervention =
  | 'planifiee' | 'en_route' | 'sur_site' | 'en_cours' | 'realisee' | 'echouee' | 'reportee' | 'annulee'

export interface Intervention {
  id:                    string
  matching_id:           string
  statut:                StatutIntervention
  date_planifiee:        string | null
  creneau_fin:           string | null
  date_debut:            string | null
  date_fin:              string | null
  checkin_at:            string | null
  checkout_at:           string | null
  localisation_checkin:  string | null
  preuve:                string | null
  created_at:            string
  updated_at:            string
}

export type TypeEvenement = 'changement_statut' | 'note' | 'checkin' | 'checkout' | 'retard'

export interface InterventionEvenement {
  id:              string
  intervention_id: string
  type:            TypeEvenement
  ancien_statut:   StatutIntervention | null
  nouveau_statut:  StatutIntervention | null
  commentaire:     string | null
  localisation:    string | null
  operateur_id:    string | null
  created_at:      string
}

function invalidateAfterChange(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['interventions'] })
  void qc.invalidateQueries({ queryKey: ['demandes'] })
}

export function useInterventions(filter: { statut?: StatutIntervention } = {}) {
  const params = new URLSearchParams()
  if (filter.statut) params.set('statut', filter.statut)
  const qs = params.toString()

  return useQuery({
    queryKey: ['interventions', filter],
    queryFn:  () => apiClient.get<{ data: Intervention[] }>(`/api/interventions${qs ? `?${qs}` : ''}`),
    select:   (res) => res.data,
  })
}

export function useInterventionEvenements(interventionId: string | null) {
  return useQuery({
    queryKey: ['interventions', 'evenements', interventionId],
    queryFn:  () => apiClient.get<{ data: InterventionEvenement[] }>(`/api/interventions/${interventionId}/evenements`),
    select:   (res) => res.data,
    enabled:  Boolean(interventionId),
  })
}

export function useCheckin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, localisation_checkin }: { id: string; localisation_checkin?: string | null }) =>
      apiClient.patch<{ data: Intervention }>(`/api/interventions/${id}/checkin`, { localisation_checkin }),
    onSuccess: (_data, variables) => {
      invalidateAfterChange(qc)
      void qc.invalidateQueries({ queryKey: ['interventions', 'evenements', variables.id] })
      toast.success('Check-in enregistré')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de check-in'),
  })
}

export function useCheckout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.patch<{ data: Intervention }>(`/api/interventions/${id}/checkout`, {}),
    onSuccess: (_data, id) => {
      invalidateAfterChange(qc)
      void qc.invalidateQueries({ queryKey: ['interventions', 'evenements', id] })
      toast.success('Check-out enregistré')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de check-out'),
  })
}

export function useUpdateInterventionStatut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: StatutIntervention }) =>
      apiClient.patch<{ data: Intervention }>(`/api/interventions/${id}/statut`, { statut }),
    onSuccess: (_data, variables) => {
      invalidateAfterChange(qc)
      void qc.invalidateQueries({ queryKey: ['interventions', 'evenements', variables.id] })
      toast.success('Statut mis à jour')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de mise à jour'),
  })
}

export function useReporterIntervention() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, date_planifiee, commentaire }: { id: string; date_planifiee: string; commentaire?: string | null }) =>
      apiClient.patch<{ data: Intervention }>(`/api/interventions/${id}/reporter`, { date_planifiee, commentaire }),
    onSuccess: (_data, variables) => {
      invalidateAfterChange(qc)
      void qc.invalidateQueries({ queryKey: ['interventions', 'evenements', variables.id] })
      toast.success('Intervention reportée')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de report'),
  })
}
