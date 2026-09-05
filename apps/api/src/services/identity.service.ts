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
 *
 * Cette identité dérivée est la SEULE frontière de sécurité pour un
 * utilisateur externe (prestataire/client) une fois la vitrine self-service
 * branchée — l'API tourne en service role et bypasse la RLS. Une erreur
 * Supabase (panne réseau, etc.) ne doit donc JAMAIS être avalée en `null`
 * (ce qui reviendrait à traiter une panne comme "identité non trouvée") :
 * elle est propagée en exception. `null` signifie uniquement "aucune ligne".
 */
import { supabaseAdmin } from '@maideres/db'

function getDb() {
  if (!supabaseAdmin) {
    throw new Error(
      'identity.service: supabaseAdmin non initialisé — variable d\'environnement ' +
      'SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SERVICE_KEY) manquante.',
    )
  }
  return supabaseAdmin
}

export async function ownPrestataireId(userId: string): Promise<string | null> {
  const { data, error } = await getDb()
    .from('prestataires')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`identity.service.ownPrestataireId: échec de la requête Supabase — ${error.message}`)
  }
  return (data as { id: string } | null)?.id ?? null
}

export async function ownClientId(userId: string): Promise<string | null> {
  const { data, error } = await getDb()
    .from('clients')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`identity.service.ownClientId: échec de la requête Supabase — ${error.message}`)
  }
  return (data as { id: string } | null)?.id ?? null
}

export function isStaff(role: string): boolean {
  return role === 'admin' || role === 'operateur' || role === 'superviseur'
}

export function isAdmin(role: string): boolean {
  return role === 'admin'
}
