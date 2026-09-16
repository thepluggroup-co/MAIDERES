import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import type { Client, TypeClient, SourceClient } from '@maideres/contracts'

export type { Client, TypeClient, SourceClient }

export function useClients(quartier?: string) {
  return useQuery({
    queryKey: ['clients', quartier ?? null],
    queryFn:  () => apiClient.get<{ data: Client[] }>(`/api/clients${quartier ? `?quartier=${encodeURIComponent(quartier)}` : ''}`),
    select:   (res) => res.data,
  })
}

export interface ClientInput {
  nom:         string
  telephone:   string
  quartier?:   string | null
  type_client: TypeClient
  niu?:        string | null
  whatsapp?:   string | null
  email?:      string | null
  source:      SourceClient
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ClientInput) =>
      apiClient.post<{ data: Client }>('/api/clients', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de création'),
  })
}

export function useUpdateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<ClientInput>) =>
      apiClient.patch<{ data: Client }>(`/api/clients/${id}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client mis à jour')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de mise à jour'),
  })
}
