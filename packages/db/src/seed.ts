/**
 * MAIDERES — Seed de données Phase 1.
 * Idempotent : upsert par id fixe, ré-exécutable sans dupliquer.
 *
 * Usage : pnpm db:seed (nécessite SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * dans l'environnement — voir .env à la racine du repo).
 *
 * Note rôle : profiles.role n'a pas de valeur "prestataire" ni "client"
 * (contrainte Phase 1 : ne pas renommer les rôles existants). Les comptes
 * prestataire/client sont seedés avec role='apprenant', la valeur la plus
 * basse-privilège du système actuel — leur identité réelle de
 * prestataire/client vient de la ligne correspondante dans les tables
 * prestataires/clients (profile_id), pas de profiles.role. Voir la
 * migration 0001_rls_policies.sql.
 */
import { supabaseAdmin } from './supabase-client'

if (!supabaseAdmin) {
  console.error('[seed] SUPABASE_SERVICE_ROLE_KEY manquant — abandon.')
  process.exit(1)
}
const db = supabaseAdmin

// ── Catégories ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: '157d6b94-5cc4-45bf-a95d-3b60de422e0b', libelle: 'Coiffure',   actif: true },
  { id: 'e76a9fde-c7d2-4281-ba61-ba6b8607e8eb', libelle: 'Taxi',       actif: true },
  { id: '4cdab3d7-b255-4a7d-96c8-dfc40dd286d9', libelle: 'Onglerie',   actif: true },
  { id: '30423365-76c3-4c4d-bdc4-aeade36427cd', libelle: 'Carte SIM',  actif: true },
  { id: 'd3504cfc-a394-44eb-8eb0-09280a79a3b8', libelle: 'Ménage',     actif: true },
]

// ── Prestataires (+ profils associés) ─────────────────────────────────────

const PRESTATAIRE_PROFILES = [
  { id: '60d42339-b76b-4664-b313-4ad7bd24d8c5', email: 'prestataire1@maideres.cm', nom: 'Aïcha Mballa',   role: 'apprenant' as const, telephone: '+237690000001', actif: true },
  { id: 'b7c329fc-e0b8-48bc-b27b-97fdb686bf57', email: 'prestataire2@maideres.cm', nom: 'Jean Fotso',     role: 'apprenant' as const, telephone: '+237690000002', actif: true },
  { id: 'f2927d57-349d-48f8-9956-2ea732ff8ac3', email: 'prestataire3@maideres.cm', nom: 'Sandrine Ekwalla', role: 'apprenant' as const, telephone: '+237690000003', actif: true },
]

const PRESTATAIRES = [
  {
    id: '8a6dc7db-3315-41a4-9e9b-e3eacde9e667',
    profile_id: '60d42339-b76b-4664-b313-4ad7bd24d8c5',
    nom: 'Aïcha Mballa',
    telephone: '+237690000001',
    categories: ['157d6b94-5cc4-45bf-a95d-3b60de422e0b'], // Coiffure
    quartier: 'Akwa',
    geoloc_lat: 4.0483,
    geoloc_lng: 9.7043,
    statut: 'actif',
    note_moyenne: '4.50',
    taux_commission: '15.00',
  },
  {
    id: '2334da3c-adb0-493c-8162-48876c74e10e',
    profile_id: 'b7c329fc-e0b8-48bc-b27b-97fdb686bf57',
    nom: 'Jean Fotso',
    telephone: '+237690000002',
    categories: ['e76a9fde-c7d2-4281-ba61-ba6b8607e8eb'], // Taxi
    quartier: 'Bonapriso',
    geoloc_lat: 4.0289,
    geoloc_lng: 9.6934,
    statut: 'actif',
    note_moyenne: '4.20',
    taux_commission: '10.00',
  },
  {
    id: '8d8e8a35-117e-4357-bc3b-daedadff8304',
    profile_id: 'f2927d57-349d-48f8-9956-2ea732ff8ac3',
    nom: 'Sandrine Ekwalla',
    telephone: '+237690000003',
    categories: ['4cdab3d7-b255-4a7d-96c8-dfc40dd286d9'], // Onglerie
    quartier: 'Deido',
    geoloc_lat: 4.0611,
    geoloc_lng: 9.7147,
    statut: 'en_attente',
    note_moyenne: '0.00',
    taux_commission: '15.00',
  },
]

// ── Clients (+ profils associés) ──────────────────────────────────────────

const CLIENT_PROFILES = [
  { id: '93bbd97a-8558-4874-be62-d98969c20b2c', email: 'client1@maideres.cm', nom: 'Paul Ndongo', role: 'apprenant' as const, telephone: '+237691000001', actif: true },
  { id: 'de1531b0-add7-412a-813b-695c6af74752', email: 'client2@maideres.cm', nom: 'Marie Essomba', role: 'apprenant' as const, telephone: '+237691000002', actif: true },
]

const CLIENTS = [
  { id: '47dc8005-5b4c-4674-baf5-19aa54e2af40', profile_id: '93bbd97a-8558-4874-be62-d98969c20b2c', nom: 'Paul Ndongo', telephone: '+237691000001', quartier: 'Bonanjo' },
  { id: 'a8c16d0a-c39d-488c-8048-836ff56a6d70', profile_id: 'de1531b0-add7-412a-813b-695c6af74752', nom: 'Marie Essomba', telephone: '+237691000002', quartier: 'Makepe' },
]

// ── Demandes ───────────────────────────────────────────────────────────────

const DEMANDES = [
  {
    id: '22ab344b-0022-4751-b371-ff32b3967674',
    client_id: '47dc8005-5b4c-4674-baf5-19aa54e2af40',
    categorie_id: '157d6b94-5cc4-45bf-a95d-3b60de422e0b', // Coiffure
    description: 'Coiffure à domicile pour un mariage samedi matin.',
    localisation: 'Bonanjo, Douala',
    canal: 'web',
    statut: 'nouvelle',
  },
  {
    id: '8e566778-baa7-4b8e-874a-bf88ab590528',
    client_id: 'a8c16d0a-c39d-488c-8048-836ff56a6d70',
    categorie_id: 'e76a9fde-c7d2-4281-ba61-ba6b8607e8eb', // Taxi
    description: "Course de l'aéroport de Douala vers Makepe, ce soir 20h.",
    localisation: 'Aéroport de Douala',
    canal: 'whatsapp',
    statut: 'nouvelle',
  },
]

// ── Exécution ──────────────────────────────────────────────────────────────

async function upsert(table: string, rows: Record<string, unknown>[]) {
  const { error } = await db.from(table).upsert(rows, { onConflict: 'id' })
  if (error) throw new Error(`[seed] ${table}: ${error.message}`)
  console.info(`[seed] ${table}: ${rows.length} ligne(s) upsert`)
}

async function main() {
  await upsert('profiles', PRESTATAIRE_PROFILES)
  await upsert('profiles', CLIENT_PROFILES)
  await upsert('categories_services', CATEGORIES)
  await upsert('prestataires', PRESTATAIRES)
  await upsert('clients', CLIENTS)
  await upsert('demandes', DEMANDES)
  console.info('[seed] terminé.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
