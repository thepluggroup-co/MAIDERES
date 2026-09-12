/**
 * Énumérations métier — mirroir exact des `pgEnum` de
 * `packages/db/src/schema.pg.ts` (source de vérité pour le schéma DB).
 *
 * Ces valeurs sont dupliquées ici plutôt qu'importées de `@maideres/db`
 * délibérément : `@maideres/db` dépend de `drizzle-orm`/`pg`, des
 * dépendances serveur qu'un frontend (apps/web, et à terme un
 * `@maideres/api-client` publié pour maidere-connect) ne doit jamais
 * bundler. Toute modification d'un enum dans `schema.pg.ts` doit être
 * répercutée ici manuellement — couvert par `contracts.test.ts`, qui
 * échoue si les deux dérivent.
 */
import { z } from 'zod'

export const RoleSchema = z.enum(['admin', 'superviseur', 'operateur', 'apprenant'])
export type Role = z.infer<typeof RoleSchema>

export const PrestataireStatutSchema = z.enum(['en_attente', 'actif', 'suspendu'])
export type PrestataireStatut = z.infer<typeof PrestataireStatutSchema>

export const DemandeCanalSchema = z.enum(['web', 'whatsapp', 'manuel'])
export type DemandeCanal = z.infer<typeof DemandeCanalSchema>

export const DemandeStatutSchema = z.enum(['nouvelle', 'en_traitement', 'matchee', 'realisee', 'annulee', 'en_cours'])
export type DemandeStatut = z.infer<typeof DemandeStatutSchema>

export const MatchingStatutSchema = z.enum(['propose', 'accepte', 'refuse', 'realise', 'echoue'])
export type MatchingStatut = z.infer<typeof MatchingStatutSchema>

export const PaiementStatutSchema = z.enum(['en_attente', 'paye', 'echoue', 'rembourse'])
export type PaiementStatut = z.infer<typeof PaiementStatutSchema>

export const ReversementStatutSchema = z.enum(['en_attente', 'traite', 'echoue'])
export type ReversementStatut = z.infer<typeof ReversementStatutSchema>

export const NotifCanalSchema = z.enum(['sms', 'whatsapp', 'email'])
export type NotifCanal = z.infer<typeof NotifCanalSchema>

export const NotifStatutSchema = z.enum(['en_attente', 'envoye', 'echoue'])
export type NotifStatut = z.infer<typeof NotifStatutSchema>

export const TypeClientSchema = z.enum(['particulier', 'entreprise', 'organisation'])
export type TypeClient = z.infer<typeof TypeClientSchema>

export const SourceClientSchema = z.enum(['whatsapp', 'appel', 'ecommerce', 'referral'])
export type SourceClient = z.infer<typeof SourceClientSchema>

export const TypeCommissionSchema = z.enum(['pourcentage', 'montant_fixe'])
export type TypeCommission = z.infer<typeof TypeCommissionSchema>

export const StatutInterventionSchema = z.enum([
  'planifiee', 'en_route', 'sur_site', 'en_cours', 'realisee', 'echouee', 'reportee', 'annulee',
])
export type StatutIntervention = z.infer<typeof StatutInterventionSchema>

export const TypeEvenementSchema = z.enum(['changement_statut', 'note', 'checkin', 'checkout', 'retard'])
export type TypeEvenement = z.infer<typeof TypeEvenementSchema>

export const NiveauUrgenceSchema = z.enum(['immediate', 'urgent', 'planifie'])
export type NiveauUrgence = z.infer<typeof NiveauUrgenceSchema>

/**
 * Codes d'erreur canoniques (master prompt §16). Pas encore adopté par
 * toutes les routes `apps/api` (qui renvoient encore souvent `{ error }`
 * sans `code`) — déclaré ici comme cible pour les nouvelles routes et les
 * migrations progressives des routes existantes, pas rétrofit d'un coup.
 */
export const ErrorCodeSchema = z.enum([
  'AUTH_REQUIRED',
  'FORBIDDEN',
  'VALIDATION_ERROR',
  'RESOURCE_NOT_FOUND',
  'REQUEST_NOT_FOUND',
  'PROVIDER_NOT_FOUND',
  'PROVIDER_NOT_AVAILABLE',
  'INVALID_STATUS_TRANSITION',
  'MATCHING_FAILED',
  'PAYMENT_FAILED',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
])
export type ErrorCode = z.infer<typeof ErrorCodeSchema>
