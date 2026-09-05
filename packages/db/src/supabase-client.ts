/**
 * Clients Supabase pour MAIDERES.
 *
 * supabase      — client public (anon key) : utilisé côté frontend et API publique.
 * supabaseAdmin — client service role      : réservé au backend / workers.
 *                 NE JAMAIS exposer dans le frontend.
 */
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

// ── Variables d'environnement ─────────────────────────────────────────────────

const SUPABASE_URL      = process.env.VITE_SUPABASE_URL      ?? process.env.SUPABASE_URL      ?? ''
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? ''
const realtimeTransport = WebSocket as never

if (!SUPABASE_URL) {
  console.warn('[MAIDERES/db] SUPABASE_URL manquant — client Supabase non initialisé.')
}

// ── Client public (anon) ──────────────────────────────────────────────────────

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken:  true,
    persistSession:    true,
    detectSessionInUrl: false,
  },
  realtime: {
    transport: realtimeTransport,
  },
  global: {
    headers: { 'x-app-name': 'MAIDERES' },
  },
})

// ── Client admin (service role) ───────────────────────────────────────────────

export const supabaseAdmin = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession:   false,
      },
      realtime: {
        transport: realtimeTransport,
      },
    })
  : null

// ── Types d'aide ──────────────────────────────────────────────────────────────

export type SupabaseClient = typeof supabase

/**
 * Tables Supabase référencées dans les appels .from().
 * Ajouter ici les nouveaux noms de table au fur et à mesure.
 */
export type ForgeTable =
  | 'profiles'
  | 'audit_log'
  | 'categories_services'
  | 'prestataires'
  | 'clients'
  | 'demandes'
  | 'matchings'
  | 'transactions'
  | 'avis'
  | 'reversements'
  | 'notifications_log'
