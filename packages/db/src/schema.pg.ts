/**
 * MAIDERES — Drizzle ORM Schema (PostgreSQL / Supabase)
 * Utilisé pour les migrations Supabase et la génération de types.
 *
 * Le schéma métier (categories_services, prestataires, clients, demandes,
 * matchings, transactions, avis, reversements, notifications_log) est
 * construit en Phase 1. Seule la table d'auth partagée survit ici.
 */
import {
  pgTable, uuid, text, boolean,
  timestamp, pgEnum,
} from 'drizzle-orm/pg-core'

// ── Helpers ────────────────────────────────────────────────────────────────────

const ts = (col: string) => timestamp(col, { withTimezone: true }).notNull().defaultNow()

// ── Enums PostgreSQL ───────────────────────────────────────────────────────────

export const roleEnum = pgEnum('role', ['admin', 'superviseur', 'operateur', 'apprenant'])

// ══════════════════════════════════════════════════════════════════════════════
// AUTH / PROFILS
// ══════════════════════════════════════════════════════════════════════════════

export const profilesPg = pgTable('profiles', {
  id:        uuid('id').primaryKey(),           // Supabase Auth UUID (pas defaultRandom)
  email:     text('email').notNull().unique(),
  nom:       text('nom').notNull(),
  role:      roleEnum('role').notNull().default('operateur'),
  telephone: text('telephone'),
  avatarUrl: text('avatar_url'),
  actif:     boolean('actif').notNull().default(true),
  createdAt: ts('created_at'),
  updatedAt: ts('updated_at'),
})

export type ProfilePg        = typeof profilesPg.$inferSelect
export type NouveauProfilePg = typeof profilesPg.$inferInsert
