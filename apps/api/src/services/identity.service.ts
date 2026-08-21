/**
 * Résolution d'identité prestataire/client.
 *
 * profiles.role n'a pas de valeur 'prestataire' ni 'client' (contrainte
 * Phase 1 : ne pas renommer les rôles existants). Un utilisateur est
 * "prestataire" si une ligne prestataires.profile_id = son id existe (idem
 * clients) — pas via profiles.role. Ceci reflète exactement les fonctions
 * SQL public.own_prestataire_id() / public.own_client_id() de la migration
 * RLS (packages/db/drizzle/0001_rls_policies.sql) ; l'API utilise le
 * service role (bypass RLS) donc doit réappliquer la même règle ici.
 */
import { supabaseAdmin } from '@forge/db'

const db = supabaseAdmin!

export async function ownPrestataireId(userId: string): Promise<string | null> {
  const { data } = await db
    .from('prestataires')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

export async function ownClientId(userId: string): Promise<string | null> {
  const { data } = await db
    .from('clients')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

export function isStaff(role: string): boolean {
  return role === 'admin' || role === 'operateur' || role === 'superviseur'
}

export function isAdmin(role: string): boolean {
  return role === 'admin'
}
