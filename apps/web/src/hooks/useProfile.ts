import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import type { MonIdentite } from '@maideres/contracts'

// Alias conservé : GET /api/profile/me renvoie désormais aussi
// is_staff/client_id/prestataire_id (cf. apps/api/src/routes/profile.ts),
// disponibles ici pour tout consommateur qui en aurait besoin.
export type ProfileData = MonIdentite

export function useProfile() {
  const [data, setData]       = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ data: ProfileData }>('/api/profile/me')
      setData(res.data ?? null)
    } catch {
      // silent — profile data just won't pre-fill
    } finally {
      setLoading(false)
    }
  }, [])

  const update = useCallback(async (patch: { nom?: string; telephone?: string | null; adresse?: string | null }) => {
    setSaving(true)
    try {
      await apiClient.patch<{ success: boolean }>('/api/profile/me', patch)
      setData(prev => prev ? { ...prev, ...patch } : prev)
      toast.success('Profil mis à jour')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur de sauvegarde')
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  useEffect(() => { void fetch() }, [fetch])
  return { data, loading, saving, refetch: fetch, update }
}
