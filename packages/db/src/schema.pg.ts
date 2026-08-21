/**
 * MAIDERES — Drizzle ORM Schema (PostgreSQL / Supabase)
 * Utilisé pour les migrations Supabase et la génération de types.
 */
import {
  pgTable, uuid, text, boolean, integer, numeric, doublePrecision,
  timestamp, pgEnum, jsonb,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ── Helpers ────────────────────────────────────────────────────────────────────

const id = () => uuid('id').primaryKey().defaultRandom()
const ts = (col: string) => timestamp(col, { withTimezone: true }).notNull().defaultNow()
const tsN = (col: string) => timestamp(col, { withTimezone: true })

// ── Enums PostgreSQL ───────────────────────────────────────────────────────────

export const roleEnum = pgEnum('role', ['admin', 'superviseur', 'operateur', 'apprenant'])

export const prestataireStatutEnum = pgEnum('prestataire_statut', ['en_attente', 'actif', 'suspendu'])
export const demandeCanalEnum      = pgEnum('demande_canal', ['web', 'whatsapp', 'manuel'])
export const demandeStatutEnum     = pgEnum('demande_statut', ['nouvelle', 'en_traitement', 'matchee', 'realisee', 'annulee'])
export const matchingStatutEnum    = pgEnum('matching_statut', ['propose', 'accepte', 'refuse', 'realise', 'echoue'])
export const paiementStatutEnum    = pgEnum('paiement_statut', ['en_attente', 'paye', 'echoue', 'rembourse'])
export const reversementStatutEnum = pgEnum('reversement_statut', ['en_attente', 'traite', 'echoue'])
export const notifCanalEnum        = pgEnum('notif_canal', ['sms', 'whatsapp', 'email'])
export const notifStatutEnum       = pgEnum('notif_statut', ['en_attente', 'envoye', 'echoue'])

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

// ══════════════════════════════════════════════════════════════════════════════
// AUDIT_LOG — journal générique des écritures API (auditMiddleware).
// Distinct de rbac_audit_logs (événements de sécurité RBAC, voir schema.pg.rbac.ts).
// ══════════════════════════════════════════════════════════════════════════════

export const auditLogPg = pgTable('audit_log', {
  id:        id(),
  userId:    uuid('user_id').references(() => profilesPg.id),
  action:    text('action').notNull(),        // 'create' | 'update' | 'delete'
  tableName: text('table_name').notNull(),
  recordId:  text('record_id'),
  newData:   jsonb('new_data'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: ts('created_at'),
})

export type AuditLogPg        = typeof auditLogPg.$inferSelect
export type NouveauAuditLogPg = typeof auditLogPg.$inferInsert

// ══════════════════════════════════════════════════════════════════════════════
// CATEGORIES_SERVICES
// ══════════════════════════════════════════════════════════════════════════════

export const categoriesServicesPg = pgTable('categories_services', {
  id:      id(),
  libelle: text('libelle').notNull(),
  actif:   boolean('actif').notNull().default(true),
})

export type CategorieServicePg    = typeof categoriesServicesPg.$inferSelect
export type NouvelleCategorieServicePg = typeof categoriesServicesPg.$inferInsert

// ══════════════════════════════════════════════════════════════════════════════
// PRESTATAIRES
// ══════════════════════════════════════════════════════════════════════════════

export const prestatairesPg = pgTable('prestataires', {
  id:               id(),
  profileId:        uuid('profile_id').notNull().references(() => profilesPg.id).unique(),
  nom:              text('nom').notNull(),
  telephone:        text('telephone').notNull(),
  categories:       uuid('categories').array().notNull().default(sql`ARRAY[]::uuid[]`),
  quartier:         text('quartier'),
  geolocLat:        doublePrecision('geoloc_lat'),
  geolocLng:        doublePrecision('geoloc_lng'),
  statut:           prestataireStatutEnum('statut').notNull().default('en_attente'),
  noteMoyenne:      numeric('note_moyenne', { precision: 3, scale: 2 }).notNull().default('0'),
  tauxCommission:   numeric('taux_commission', { precision: 5, scale: 2 }).notNull().default('0'),
  dateRecrutement:  ts('date_recrutement'),
})

export type PrestatairePg        = typeof prestatairesPg.$inferSelect
export type NouveauPrestatairePg = typeof prestatairesPg.$inferInsert

// ══════════════════════════════════════════════════════════════════════════════
// CLIENTS
// ══════════════════════════════════════════════════════════════════════════════

export const clientsPg = pgTable('clients', {
  id:        id(),
  profileId: uuid('profile_id').notNull().references(() => profilesPg.id).unique(),
  nom:       text('nom').notNull(),
  telephone: text('telephone').notNull(),
  quartier:  text('quartier'),
})

export type ClientPg        = typeof clientsPg.$inferSelect
export type NouveauClientPg = typeof clientsPg.$inferInsert

// ══════════════════════════════════════════════════════════════════════════════
// DEMANDES
// ══════════════════════════════════════════════════════════════════════════════

export const demandesPg = pgTable('demandes', {
  id:           id(),
  clientId:     uuid('client_id').notNull().references(() => clientsPg.id),
  categorieId:  uuid('categorie_id').notNull().references(() => categoriesServicesPg.id),
  description:  text('description').notNull(),
  localisation: text('localisation'),
  canal:        demandeCanalEnum('canal').notNull().default('web'),
  statut:       demandeStatutEnum('statut').notNull().default('nouvelle'),
  createdAt:    ts('created_at'),
})

export type DemandePg        = typeof demandesPg.$inferSelect
export type NouvelleDemandePg = typeof demandesPg.$inferInsert

// ══════════════════════════════════════════════════════════════════════════════
// MATCHINGS
// ══════════════════════════════════════════════════════════════════════════════

export const matchingsPg = pgTable('matchings', {
  id:             id(),
  demandeId:      uuid('demande_id').notNull().references(() => demandesPg.id),
  prestataireId:  uuid('prestataire_id').notNull().references(() => prestatairesPg.id),
  operateurId:    uuid('operateur_id').references(() => profilesPg.id),
  statut:         matchingStatutEnum('statut').notNull().default('propose'),
  motifEchec:     text('motif_echec'),
  proposedAt:     ts('proposed_at'),
  closedAt:       tsN('closed_at'),
})

export type MatchingPg        = typeof matchingsPg.$inferSelect
export type NouveauMatchingPg = typeof matchingsPg.$inferInsert

// ══════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS
// ══════════════════════════════════════════════════════════════════════════════

export const transactionsPg = pgTable('transactions', {
  id:                id(),
  matchingId:        uuid('matching_id').notNull().references(() => matchingsPg.id).unique(),
  montantService:    integer('montant_service').notNull(),
  commissionTaux:    numeric('commission_taux', { precision: 5, scale: 2 }).notNull().default('0'),
  commissionMontant: integer('commission_montant').notNull().default(0),
  statutPaiement:    paiementStatutEnum('statut_paiement').notNull().default('en_attente'),
  refNotchpay:       text('ref_notchpay'),
  createdAt:         ts('created_at'),
})

export type TransactionPg        = typeof transactionsPg.$inferSelect
export type NouvelleTransactionPg = typeof transactionsPg.$inferInsert

// ══════════════════════════════════════════════════════════════════════════════
// AVIS
// ══════════════════════════════════════════════════════════════════════════════

export const avisPg = pgTable('avis', {
  id:          id(),
  matchingId:  uuid('matching_id').notNull().references(() => matchingsPg.id).unique(),
  note:        integer('note').notNull(),
  commentaire: text('commentaire'),
  createdAt:   ts('created_at'),
})

export type AvisPg        = typeof avisPg.$inferSelect
export type NouvelAvisPg  = typeof avisPg.$inferInsert

// ══════════════════════════════════════════════════════════════════════════════
// REVERSEMENTS
// ══════════════════════════════════════════════════════════════════════════════

export const reversementsPg = pgTable('reversements', {
  id:             id(),
  prestataireId:  uuid('prestataire_id').notNull().references(() => prestatairesPg.id),
  montant:        integer('montant').notNull(),
  statut:         reversementStatutEnum('statut').notNull().default('en_attente'),
  ref:            text('ref'),
  createdAt:      ts('created_at'),
})

export type ReversementPg        = typeof reversementsPg.$inferSelect
export type NouveauReversementPg = typeof reversementsPg.$inferInsert

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS_LOG
// ══════════════════════════════════════════════════════════════════════════════

export const notificationsLogPg = pgTable('notifications_log', {
  id:        id(),
  cible:     uuid('cible').notNull().references(() => profilesPg.id),
  canal:     notifCanalEnum('canal').notNull(),
  contenu:   text('contenu').notNull(),
  statut:    notifStatutEnum('statut').notNull().default('en_attente'),
  createdAt: ts('created_at'),
})

export type NotificationLogPg        = typeof notificationsLogPg.$inferSelect
export type NouvelleNotificationLogPg = typeof notificationsLogPg.$inferInsert
