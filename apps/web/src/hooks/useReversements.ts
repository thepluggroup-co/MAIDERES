import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

export type ReversementStatut = 'en_attente' | 'traite' | 'echoue'

export interface Reversement {
  id:             string
  prestataire_id: string
  // Placeholder à 0 tant que statut='en_attente' (amorcé par le trigger
  // sync_intervention_statut, 0009) — le net réel est recalculé côté serveur
  // au moment du marquage payé, voir PATCH /:id/marquer-paye.
  montant:        number
  statut:         ReversementStatut
  ref:            string | null
  date_paiement:  string | null
  created_at:     string
}

export function useReversements(filter: { statut?: ReversementStatut } = {}) {
  const params = new URLSearchParams()
  if (filter.statut) params.set('statut', filter.statut)
  const qs = params.toString()

  return useQuery({
    queryKey: ['reversements', filter],
    queryFn:  () => apiClient.get<{ data: Reversement[] }>(`/api/reversements${qs ? `?${qs}` : ''}`),
    select:   (res) => res.data,
  })
}

export function useMarquerReversementPaye() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.patch<{ data: Reversement }>(`/api/reversements/${id}/marquer-paye`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reversements'] })
      toast.success('Reversement marqué payé')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de marquage'),
  })
}
