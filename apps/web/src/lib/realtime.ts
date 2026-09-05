import type { QueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export function setupRealtime(queryClient: QueryClient): () => void {
  const inv = (...keys: string[][]) => {
    for (const key of keys) void queryClient.invalidateQueries({ queryKey: key })
  }

  const demandes = supabase
    .channel('maideres-demandes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'demandes' }, () => {
      inv(['demandes'])
    })
    .subscribe()

  const matchings = supabase
    .channel('maideres-matchings')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matchings' }, () => {
      inv(['matchings'], ['demandes'])
    })
    .subscribe()

  const prestataires = supabase
    .channel('maideres-prestataires')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'prestataires' }, () => {
      inv(['prestataires'])
    })
    .subscribe()

  const clients = supabase
    .channel('maideres-clients')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
      inv(['clients'])
    })
    .subscribe()

  const categories = supabase
    .channel('maideres-categories')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories_services' }, () => {
      inv(['categories'])
    })
    .subscribe()

  return () => {
    void supabase.removeChannel(demandes)
    void supabase.removeChannel(matchings)
    void supabase.removeChannel(prestataires)
    void supabase.removeChannel(clients)
    void supabase.removeChannel(categories)
  }
}
