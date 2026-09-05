/**
 * MAIDERES — Drizzle ORM Schema (PostgreSQL / Supabase)
 * Utilisé pour les migrations Supabase et la génération de types.
 */
import {
  pgTable, uuid, text, boolean, integer, numeric, doublePrecision,
  timestamp, pgEnum, jsonb, index,
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
// 'en_cours' ajoutée en 0007 (migration séparée — cf. packages/db/drizzle/0007_*.sql :
// Postgres interdit d'ajouter une valeur d'enum et de l'utiliser dans la même transaction).
export const demandeStatutEnum     = pgEnum('demande_statut', ['nouvelle', 'en_traitement', 'matchee', 'realisee', 'annulee', 'en_cours'])
export const matchingStatutEnum    = pgEnum('matching_statut', ['propose', 'accepte', 'refuse', 'realise', 'echoue'])
export const paiementStatutEnum    = pgEnum('paiement_statut', ['en_attente', 'paye', 'echoue', 'rembourse'])
export const reversementStatutEnum = pgEnum('reversement_statut', ['en_attente', 'traite', 'echoue'])
export const notifCanalEnum        = pgEnum('notif_canal', ['sms', 'whatsapp', 'email'])
export const notifStatutEnum       = pgEnum('notif_statut', ['en_attente', 'envoye', 'echoue'])

export const typeClientEnum   = pgEnum('type_client', ['particulier', 'entreprise', 'organisation'])
export const sourceClientEnum = pgEnum('source_client', ['whatsapp', 'appel', 'ecommerce', 'referral'])

export const typeCommissionEnum = pgEnum('type_commission', ['pourcentage', 'montant_fixe'])

export const statutInterventionEnum = pgEnum('statut_intervention', [
  'planifiee', 'en_route', 'sur_site', 'en_cours', 'realisee', 'echouee', 'reportee', 'annulee',
])
export const typeEvenementEnum = pgEnum('type_evenement', [
  'changement_statut', 'note', 'checkin', 'checkout', 'retard',
])

export const niveauUrgenceEnum = pgEnum('niveau_urgence', ['immediate', 'urgent', 'planifie'])

// ══════════════════════════════════════════════════════════════════════════════
// AUTH / PROFILS
// ══════════════════════════════════════════════════════════════════════════════

export const profilesPg = pgTable('profiles', {
  id:        uuid('id').primaryKey(),           // Supabase Auth UUID (pas defaultRandom)
  email:     text('email').notNull().unique(),
  nom:       text('nom').notNull(),
  role:      roleEnum('role').notNull().default('operateur'),
  telephone: text('telephone'),
  adresse:   text('adresse'),
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
// COMMISSION_CONFIG — barème de commission paramétrable (jamais de taux en
// dur dans le code, cf. public.calculer_commission() en 0011). categorieId
// NULL = règle globale (fallback quand aucune règle catégorie active
// n'existe) ; sinon règle spécifique à la catégorie. Le taux effectivement
// appliqué peut en plus être surchargé par prestataires.tauxCommission —
// voir l'ordre de résolution documenté sur la fonction SQL.
// ══════════════════════════════════════════════════════════════════════════════

export const commissionConfigPg = pgTable('commission_config', {
  id:          id(),
  categorieId: uuid('categorie_id').references(() => categoriesServicesPg.id, { onDelete: 'cascade' }),
  type:        typeCommissionEnum('type').notNull().default('pourcentage'),
  valeur:      numeric('valeur', { precision: 10, scale: 2 }).notNull(),
  actif:       boolean('actif').notNull().default(true),
  createdAt:   ts('created_at'),
})

export type CommissionConfigPg        = typeof commissionConfigPg.$inferSelect
export type NouvelleCommissionConfigPg = typeof commissionConfigPg.$inferInsert

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
  // NULL = pas d'override, la commission suit commission_config (catégorie
  // puis règle globale) — cf. public.calculer_commission(), 0011. Nullable
  // depuis 0010 (auparavant NOT NULL DEFAULT '0', ce qui rendait "pas configuré"
  // indistinguable de "override explicite à 0 %").
  tauxCommission:   numeric('taux_commission', { precision: 5, scale: 2 }),
  dateRecrutement:  ts('date_recrutement'),
}, (table) => ({
  // GIN : categories est un uuid[] filtré par "contains" (@>) au dispatch —
  // un btree standard ne sait pas indexer un opérateur sur tableau.
  categoriesIdx: index('prestataires_categories_gin_idx').using('gin', table.categories),
  quartierIdx:   index('prestataires_quartier_idx').on(table.quartier),
}))

export type PrestatairePg        = typeof prestatairesPg.$inferSelect
export type NouveauPrestatairePg = typeof prestatairesPg.$inferInsert

// ══════════════════════════════════════════════════════════════════════════════
// CLIENTS
// ══════════════════════════════════════════════════════════════════════════════

export const clientsPg = pgTable('clients', {
  id:         id(),
  profileId:  uuid('profile_id').notNull().references(() => profilesPg.id).unique(),
  nom:        text('nom').notNull(),
  telephone:  text('telephone').notNull(),
  quartier:   text('quartier'),
  typeClient: typeClientEnum('type_client').notNull().default('particulier'),
  niu:        text('niu'),        // pertinent pour entreprise/organisation, non contraint en base
  whatsapp:   text('whatsapp'),
  email:      text('email'),
  source:     sourceClientEnum('source').notNull().default('whatsapp'),
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
  // niveauUrgence/dateSouhaitee/delaiCible : ajoutées pour pouvoir indexer et
  // trier par urgence côté dispatch. delaiCible est calculée par trigger
  // (jamais renseignée directement par l'API) — cf. packages/db/drizzle/
  // 0015_demandes_delai_cible_trigger.sql pour le calcul (adapté du projet
  // de référence : sla_config.delai_heures par niveau, ou date_souhaitee
  // directement si niveau_urgence='planifie').
  niveauUrgence: niveauUrgenceEnum('niveau_urgence').notNull().default('urgent'),
  dateSouhaitee: tsN('date_souhaitee'),
  delaiCible:    tsN('delai_cible'),
}, (table) => ({
  categorieIdx: index('demandes_categorie_id_idx').on(table.categorieId),
  statutIdx:    index('demandes_statut_idx').on(table.statut),
  delaiCibleIdx: index('demandes_delai_cible_idx').on(table.delaiCible),
}))

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
}, (table) => ({
  demandeIdIdx: index('matchings_demande_id_idx').on(table.demandeId),
}))

export type MatchingPg        = typeof matchingsPg.$inferSelect
export type NouveauMatchingPg = typeof matchingsPg.$inferInsert

// ══════════════════════════════════════════════════════════════════════════════
// INTERVENTIONS — suivi terrain horodaté d'un matching (pas de GPS, pas d'app
// prestataire : localisation_checkin est une note texte saisie manuellement).
// ══════════════════════════════════════════════════════════════════════════════

export const interventionsPg = pgTable('interventions', {
  id:                  id(),
  matchingId:          uuid('matching_id').notNull().references(() => matchingsPg.id).unique(),
  statut:              statutInterventionEnum('statut').notNull().default('planifiee'),
  datePlanifiee:       tsN('date_planifiee'),
  creneauFin:          tsN('creneau_fin'),
  dateDebut:           tsN('date_debut'),
  dateFin:             tsN('date_fin'),
  checkinAt:           tsN('checkin_at'),
  checkoutAt:          tsN('checkout_at'),
  localisationCheckin: text('localisation_checkin'),
  preuve:              text('preuve'),
  createdAt:           ts('created_at'),
  updatedAt:           ts('updated_at'),
})

export type InterventionPg        = typeof interventionsPg.$inferSelect
export type NouvelleInterventionPg = typeof interventionsPg.$inferInsert

// ══════════════════════════════════════════════════════════════════════════════
// INTERVENTION_EVENEMENTS — journal append-only (alimenté par trigger, voir
// packages/db/drizzle/0009_intervention_sync.sql). Jamais d'UPDATE/DELETE.
// ══════════════════════════════════════════════════════════════════════════════

export const interventionEvenementsPg = pgTable('intervention_evenements', {
  id:             id(),
  interventionId: uuid('intervention_id').notNull().references(() => interventionsPg.id),
  type:           typeEvenementEnum('type').notNull(),
  ancienStatut:   statutInterventionEnum('ancien_statut'),
  nouveauStatut:  statutInterventionEnum('nouveau_statut'),
  commentaire:    text('commentaire'),
  localisation:   text('localisation'),
  operateurId:    uuid('operateur_id').references(() => profilesPg.id),
  createdAt:      ts('created_at'),
})

export type InterventionEvenementPg        = typeof interventionEvenementsPg.$inferSelect
export type NouvelInterventionEvenementPg  = typeof interventionEvenementsPg.$inferInsert

// ══════════════════════════════════════════════════════════════════════════════
// SLA_CONFIG — délai cible par niveau d'urgence. Table + RLS créées en 0012/0013 ;
// câblée sur demandes.delai_cible par trigger depuis 0015 (voir demandes ci-dessus).
// seuilAlerteHeures (0016) : nombre d'heures avant delai_cible à partir duquel
// une demande passe à l'état "alerte" (orange) plutôt que "ok" (vert) dans les
// futurs écrans Dispatch/Interventions — badge SLA à 3 états, calcul déporté
// ici plutôt qu'en dur dans le front.
// ══════════════════════════════════════════════════════════════════════════════

export const slaConfigPg = pgTable('sla_config', {
  id:                 id(),
  niveauUrgence:      niveauUrgenceEnum('niveau_urgence').notNull().unique(),
  delaiHeures:        integer('delai_heures').notNull(),
  seuilAlerteHeures:  integer('seuil_alerte_heures').notNull().default(0),
  createdAt:          ts('created_at'),
})

export type SlaConfigPg        = typeof slaConfigPg.$inferSelect
export type NouveauSlaConfigPg = typeof slaConfigPg.$inferInsert

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
  datePaiement:   tsN('date_paiement'),
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
