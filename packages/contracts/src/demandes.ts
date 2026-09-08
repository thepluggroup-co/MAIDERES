import { z } from 'zod'
import { DemandeCanalSchema, DemandeStatutSchema, NiveauUrgenceSchema } from './enums'

export const DemandeSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  categorie_id: z.string().uuid(),
  description: z.string(),
  localisation: z.string().nullable(),
  canal: DemandeCanalSchema,
  statut: DemandeStatutSchema,
  created_at: z.string(),
  niveau_urgence: NiveauUrgenceSchema,
  date_souhaitee: z.string().nullable(),
  delai_cible: z.string().nullable(),
})
export type Demande = z.infer<typeof DemandeSchema>

/**
 * POST /api/demandes — création multi-canal (self-service ou staff pour un
 * client donné). `delai_cible` n'est jamais accepté ici : calculé par
 * trigger DB (packages/db/drizzle/0015_demandes_delai_cible_trigger.sql).
 */
export const CreateDemandeSchema = z.object({
  client_id: z.string().uuid().optional(), // staff seulement
  categorie_id: z.string().uuid(),
  description: z.string().trim().min(1).max(2000),
  localisation: z.string().trim().max(200).nullable().optional(),
  canal: DemandeCanalSchema.default('web'),
  niveau_urgence: NiveauUrgenceSchema.default('urgent'),
  date_souhaitee: z.string().datetime().nullable().optional(),
}).refine(
  (body) => body.niveau_urgence !== 'planifie' || Boolean(body.date_souhaitee),
  { message: 'date_souhaitee est requise pour une demande planifiée', path: ['date_souhaitee'] },
)
export type CreateDemandeInput = z.infer<typeof CreateDemandeSchema>

/** PATCH /api/demandes/:id/statut — staff : toute transition valide ; client : uniquement annuler une demande 'nouvelle'. */
export const UpdateDemandeStatutSchema = z.object({ statut: DemandeStatutSchema })
export type UpdateDemandeStatutInput = z.infer<typeof UpdateDemandeStatutSchema>

/** Transitions autorisées pour le staff (apps/api/src/routes/demandes.ts) — un client ne peut que nouvelle→annulee. */
export const DEMANDE_STAFF_TRANSITIONS: Record<string, string[]> = {
  nouvelle: ['en_traitement', 'annulee'],
  en_traitement: ['matchee', 'annulee'],
  matchee: ['realisee', 'en_traitement', 'annulee'],
  realisee: [],
  annulee: [],
}
