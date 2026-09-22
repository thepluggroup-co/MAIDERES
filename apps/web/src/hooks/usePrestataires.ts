import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import type {
  Prestataire, PrestataireStatut, PrestatairePaliersDossier, PaliersCalcules, UpdatePrestatairePaliersInput, DocumentType,
} from '@maideres/contracts'

export type { Prestataire, PrestataireStatut }

export interface PrestatairesFilter {
  categorie?: string
  quartier?:  string
  statut?:    PrestataireStatut
  pilote?:    boolean
}

function buildQuery(filter: PrestatairesFilter): string {
  const params = new URLSearchParams()
  if (filter.categorie) params.set('categorie', filter.categorie)
  if (filter.quartier)  params.set('quartier', filter.quartier)
  if (filter.statut)    params.set('statut', filter.statut)
  if (filter.pilote !== undefined) params.set('pilote', String(filter.pilote))
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

/** Marque/démarque l'appartenance à l'échantillon de référence du pilote
 *  (0034) — staff seulement, orthogonal au statut. */
export function useUpdatePrestatairePilote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, pilote }: { id: string; pilote: boolean }) =>
      apiClient.patch<{ data: Prestataire }>(`/api/prestataires/${id}/pilote`, { pilote }),
    onSuccess: (_, { pilote }) => {
      void qc.invalidateQueries({ queryKey: ['prestataires'] })
      toast.success(pilote ? 'Ajouté à l\u2019échantillon pilote' : 'Retiré de l\u2019échantillon pilote')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de mise à jour'),
  })
}

/** Dossier en 3 paliers (0035, provisoire) — staff seulement, informatif. */
export interface PaliersReponse { dossier: PrestatairePaliersDossier | null; paliers: PaliersCalcules }

export function usePrestatairePaliers(id: string | null) {
  return useQuery({
    queryKey: ['prestataire-paliers', id],
    queryFn:  () => apiClient.get<{ data: PaliersReponse }>(`/api/prestataires/${id}/paliers`),
    select:   (res) => res.data,
    enabled:  Boolean(id),
  })
}

export function useUpdatePrestatairePaliers(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdatePrestatairePaliersInput) =>
      apiClient.put<{ data: PaliersReponse }>(`/api/prestataires/${id}/paliers`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['prestataire-paliers', id] })
      toast.success('Dossier mis à jour')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur de mise à jour'),
  })
}

/** Dépôt d'un PDF (pièce d'identité, RCCM, NIU) — staff seulement, Storage privé (0038). */
export function useUploadPalierDocument(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ type, fichier }: { type: DocumentType; fichier: File }) => {
      const form = new FormData()
      form.set('file', fichier)
      return apiClient.postForm<{ data: PaliersReponse }>(`/api/prestataires/${id}/paliers/documents/${type}`, form)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['prestataire-paliers', id] })
      toast.success('Document déposé')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Échec du dépôt'),
  })
}

export function useDeletePalierDocument(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (type: DocumentType) =>
      apiClient.delete<{ data: PaliersReponse }>(`/api/prestataires/${id}/paliers/documents/${type}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['prestataire-paliers', id] })
      toast.success('Document supprimé')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Échec de la suppression'),
  })
}

/** Ouvre le PDF via une URL signée courte (le fenêtre est ouverte tout de suite pour éviter le blocage de pop-up). */
export async function ouvrirDocumentPalier(id: string, type: DocumentType) {
  const fenetre = window.open('', '_blank')
  try {
    const res = await apiClient.get<{ data: { url: string } }>(`/api/prestataires/${id}/paliers/documents/${type}`)
    if (fenetre) fenetre.location.href = res.data.url
    else window.location.href = res.data.url
  } catch (e) {
    fenetre?.close()
    toast.error(e instanceof Error ? e.message : 'Document indisponible')
  }
}
