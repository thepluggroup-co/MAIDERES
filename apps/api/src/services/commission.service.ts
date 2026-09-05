/**
 * Miroir TS de public.calculer_commission() (packages/db/drizzle/0011_commission_calculee.sql).
 *
 * Ne réimplémente PAS la résolution (override prestataire → catégorie →
 * globale) : ce serait une seconde source de vérité qui pourrait diverger
 * de la fonction SQL. Ce service appelle la fonction via RPC — il expose
 * juste un point d'entrée typé pour l'API (ex. prévisualiser une commission
 * avant de créer la transaction).
 *
 * La création réelle d'une transaction n'a pas besoin d'appeler ce service :
 * le trigger public.set_transaction_commission() (BEFORE INSERT) applique
 * déjà calculer_commission() côté base, quoi que le client envoie.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface CommissionInput {
  montantService: number
  categorieId:    string | null
  prestataireId:  string | null
}

export async function calculerCommission(db: SupabaseClient, input: CommissionInput): Promise<number> {
  const { data, error } = await db.rpc('calculer_commission', {
    _montant:        input.montantService,
    _categorie_id:   input.categorieId,
    _prestataire_id: input.prestataireId,
  })

  if (error) {
    throw new Error(`commission.service.calculerCommission: échec de l'appel RPC — ${error.message}`)
  }
  return data as number
}
