import { z } from 'zod'
import { StatutInterventionSchema, TypeEvenementSchema } from './enums'

export const InterventionSchema = z.object({
  id: z.string().uuid(),
  matching_id: z.string().uuid(),
  statut: StatutInterventionSchema,
  date_planifiee: z.string().nullable(),
  creneau_fin: z.string().nullable(),
  date_debut: z.string().nullable(),
  date_fin: z.string().nullable(),
  checkin_at: z.string().nullable(),
  checkout_at: z.string().nullable(),
  localisation_checkin: z.string().nullable(),
  preuve: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type Intervention = z.infer<typeof InterventionSchema>

/** Journal append-only alimenté par trigger (packages/db/drizzle/0009_intervention_sync.sql) — jamais écrit directement par l'API. */
export const InterventionEvenementSchema = z.object({
  id: z.string().uuid(),
  intervention_id: z.string().uuid(),
  type: TypeEvenementSchema,
  ancien_statut: StatutInterventionSchema.nullable(),
  nouveau_statut: StatutInterventionSchema.nullable(),
  commentaire: z.string().nullable(),
  localisation: z.string().nullable(),
  operateur_id: z.string().uuid().nullable(),
  created_at: z.string(),
})
export type InterventionEvenement = z.infer<typeof InterventionEvenementSchema>

/** PATCH /api/interventions/:id/checkin — le trigger DB force statut='sur_site' et journalise, l'API tient checkin_at/localisation. */
export const CheckinInterventionSchema = z.object({
  localisation_checkin: z.string().trim().max(200).nullable().optional(),
})
export type CheckinInterventionInput = z.infer<typeof CheckinInterventionSchema>

/** PATCH /api/interventions/:id/statut */
export const UpdateInterventionStatutSchema = z.object({ statut: StatutInterventionSchema })
export type UpdateInterventionStatutInput = z.infer<typeof UpdateInterventionStatutSchema>

/** Transitions autorisées (apps/api/src/routes/interventions.ts) — realisee/echouee/annulee sont terminales. */
export const INTERVENTION_TRANSITIONS: Record<string, string[]> = {
  planifiee: ['en_route', 'sur_site', 'reportee', 'annulee'],
  en_route: ['sur_site', 'reportee', 'annulee'],
  sur_site: ['en_cours', 'reportee', 'annulee'],
  en_cours: ['realisee', 'echouee', 'annulee'],
  reportee: ['planifiee', 'en_route', 'annulee'],
  realisee: [],
  echouee: [],
  annulee: [],
}
export const INTERVENTION_TERMINAL_STATUTS = ['realisee', 'echouee', 'annulee']

/** PATCH /api/interventions/:id/reporter — reporte à une nouvelle date planifiée. */
export const ReporterInterventionSchema = z.object({
  date_planifiee: z.string().datetime(),
  commentaire: z.string().trim().max(500).nullable().optional(),
})
export type ReporterInterventionInput = z.infer<typeof ReporterInterventionSchema>
