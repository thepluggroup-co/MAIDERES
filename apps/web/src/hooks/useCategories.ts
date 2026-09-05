import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

export interface CategorieService {
  id:      string
  libelle: string
  actif:   boolean
}

export function useCategories() {
  return useQuery({
    queryKey:  ['categories'],
    queryFn:   () => apiClient.get<{ data: CategorieService[] }>('/api/categories_services'),
    staleTime: 5 * 60_000,
    select:    (res) => res.data,
  })
}

export interface CategorieInput {
  libelle: string
  actif?:  boolean
}

export function useCreateCategorie() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CategorieInput) =>
      apiClient.post<{ data: CategorieService }>('/api/categories_services', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Catégorie créée')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de création'),
  })
}

export function useUpdateCategorie() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<CategorieInput>) =>
      apiClient.patch<{ data: CategorieService }>(`/api/categories_services/${id}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Catégorie mise à jour')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de mise à jour'),
  })
}

export function useDeleteCategorie() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<{ success: boolean }>(`/api/categories_services/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Catégorie supprimée')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de suppression'),
  })
}
