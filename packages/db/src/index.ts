// MAIDERES — @forge/db
// Schéma Drizzle ORM (PostgreSQL / Supabase) et clients DB.

// ── Schéma PostgreSQL (Supabase) ──────────────────────────────────────────────
export * from './schema.pg'

// ── Clients Supabase ──────────────────────────────────────────────────────────
export { supabase, supabaseAdmin } from './supabase-client'
export type { SupabaseClient, ForgeTable } from './supabase-client'

// ── Module Sécurité / RBAC ────────────────────────────────────────────────────
export * from './schema.pg.rbac'
export { runRbacSeed, ROLE_PERMISSIONS_MATRIX, SEED_ROLES, IMMUTABLE_PERMISSIONS } from './seeds/rbac'
