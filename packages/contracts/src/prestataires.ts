import { z } from 'zod'
import { PrestataireStatutSchema } from './enums'

export const PrestataireSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  nom: z.string(),
  telephone: z.string(),
  categories: z.array(z.string().uuid()),
  quartier: z.string().nullable(),
  geoloc_lat: z.number().nullable(),
  geoloc_lng: z.number().nullable(),
  statut: PrestataireStatutSchema,
  note_moyenne: z.string(),
  taux_commission: z.string().nullable(),
  date_recrutement: z.string().nullable().optional(),
  // Colonnes self-service (0027) — profil public maidere-connect, jamais
  // consommées par le matching/dispatch staff (qui reste sur `categories`).
  ville: z.string().nullable().optional(),
  metier: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  disponible: z.boolean().optional(),
  zones_couverture: z.array(z.string()).optional(),
})
export type Prestataire = z.infer<typeof PrestataireSchema>

/** POST /api/prestataires — auto-inscription (statut forcé à 'en_attente' côté serveur). */
export const CreatePrestataireSchema = z.object({
  nom: z.string().trim().min(1).max(100),
  telephone: z.string().trim().min(6).max(30),
  categories: z.array(z.string().uuid()).default([]),
  quartier: z.string().trim().max(100).nullable().optional(),
  geoloc_lat: z.number().min(-90).max(90).nullable().optional(),
  geoloc_lng: z.number().min(-180).max(180).nullable().optional(),
  ville: z.string().trim().max(100).nullable().optional(),
  metier: z.string().trim().max(100).nullable().optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  zones_couverture: z.array(z.string().trim().max(100)).optional(),
  profile_id: z.string().uuid().optional(), // staff seulement : créer pour un autre profil
})
export type CreatePrestataireInput = z.infer<typeof CreatePrestataireSchema>

/** PATCH /api/prestataires/:id — staff : tout ; soi-même : champs non sensibles (taux_commission excepté). */
export const UpdatePrestataireSchema = z.object({
  nom: z.string().trim().min(1).max(100).optional(),
  telephone: z.string().trim().min(6).max(30).optional(),
  categories: z.array(z.string().uuid()).optional(),
  quartier: z.string().trim().max(100).nullable().optional(),
  geoloc_lat: z.number().min(-90).max(90).nullable().optional(),
  geoloc_lng: z.number().min(-180).max(180).nullable().optional(),
  ville: z.string().trim().max(100).nullable().optional(),
  metier: z.string().trim().max(100).nullable().optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  disponible: z.boolean().optional(),
  zones_couverture: z.array(z.string().trim().max(100)).optional(),
  // staff seulement — vérifié dans la route, pas ici. null = retirer l'override.
  taux_commission: z.number().min(0).max(100).nullable().optional(),
})
export type UpdatePrestataireInput = z.infer<typeof UpdatePrestataireSchema>

export const UpdatePrestataireStatutSchema = z.object({ statut: PrestataireStatutSchema })
export type UpdatePrestataireStatutInput = z.infer<typeof UpdatePrestataireStatutSchema>

/** Champs exposés côté vitrine publique (GET /api/public/prestataires*) — jamais profile_id/geoloc/categories/taux_commission. */
export const PrestatairePublicSchema = z.object({
  id: z.string().uuid(),
  nom: z.string(),
  telephone: z.string(),
  quartier: z.string().nullable(),
  ville: z.string().nullable(),
  metier: z.string().nullable(),
  bio: z.string().nullable(),
  disponible: z.boolean(),
  zones_couverture: z.array(z.string()),
  note_moyenne: z.string(),
  statut: PrestataireStatutSchema,
})
export type PrestatairePublic = z.infer<typeof PrestatairePublicSchema>
