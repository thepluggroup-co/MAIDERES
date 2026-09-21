/**
 * prestataires-paliers.test.ts
 *
 * Dossier prestataire en 3 paliers (0035, PROVISOIRE) : réservé au staff,
 * palier atteint calculé (jamais stocké), un palier exige les précédents,
 * et rien de tout cela ne bloque l'activation d'un prestataire.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import type { FakeSupabase } from './fakeSupabase'
import { authHeaders } from './helpers'

vi.mock('@maideres/db/supabase', async () => {
  const { createFakeSupabase } = await import('./fakeSupabase')
  const client = createFakeSupabase()
  ;(globalThis as unknown as { __fakeDb: FakeSupabase }).__fakeDb = client
  return { supabase: client, supabaseAdmin: client }
})

import app from '../app'

const fakeDb = () => (globalThis as unknown as { __fakeDb: FakeSupabase }).__fakeDb

const STAFF_USER_ID  = 'c1111111-1111-4111-8111-111111111111'
const PRESTA_USER_ID = 'c2222222-2222-4222-8222-222222222222'
const PRESTA_ID      = 'c3333333-3333-4333-8333-333333333333'
const PRESTA_VIDE_ID = 'c4444444-4444-4444-8444-444444444444'
const CATEGORIE_ID   = 'c5555555-5555-4555-8555-555555555555'

beforeAll(() => {
  const db = fakeDb()
  db.seed('profiles', [
    { id: STAFF_USER_ID, email: 'staff@maideres.cm', nom: 'Staff', role: 'operateur', actif: true },
    { id: PRESTA_USER_ID, email: 'presta@maideres.cm', nom: 'Presta', role: 'apprenant', actif: true },
  ])
  db.seed('prestataires', [
    { id: PRESTA_ID, profile_id: PRESTA_USER_ID, nom: 'Salon Akwa', telephone: '+237690000020', categories: [CATEGORIE_ID], quartier: 'Akwa', statut: 'en_attente' },
    { id: PRESTA_VIDE_ID, profile_id: STAFF_USER_ID, nom: 'Presta vide', telephone: '+237690000021', categories: [], quartier: null, statut: 'en_attente' },
  ])
  db.seed('offres', [
    { id: 'c6666666-6666-4666-8666-666666666666', prestataire_id: PRESTA_ID, categorie: 'Beauté', titre: 'Coupe', prix: 3000, unite_prix: 'forfait', publie: true, prestations: [] },
  ])
})

const get = (id: string, role: Parameters<typeof authHeaders>[0], uid: string) =>
  app.request(`/api/prestataires/${id}/paliers`, { headers: authHeaders(role, uid) })
const put = (id: string, body: unknown, role: Parameters<typeof authHeaders>[0], uid: string) =>
  app.request(`/api/prestataires/${id}/paliers`, { method: 'PUT', headers: authHeaders(role, uid), body: JSON.stringify(body) })

type Reponse = { data: { dossier: Record<string, unknown> | null; paliers: { palier_atteint: number; palier1: { complet: boolean; manquants: string[] }; palier2: { complet: boolean; manquants: string[] }; palier3: { complet: boolean; manquants: string[] } } } }

describe('Dossier prestataire — 3 paliers (provisoire)', () => {
  it('palier 1 calculé depuis prestataire + offres, sans dossier stocké', async () => {
    const res = await get(PRESTA_ID, 'operateur', STAFF_USER_ID)
    expect(res.status).toBe(200)
    const { data } = await res.json() as Reponse
    expect(data.dossier).toBeNull()
    expect(data.paliers.palier1.complet).toBe(true)
    expect(data.paliers.palier_atteint).toBe(1)
    expect(data.paliers.palier2.manquants).toContain("Pièce d'identité vue")
  })

  it('un prestataire incomplet liste ce qui manque au palier 1', async () => {
    const { data } = await (await get(PRESTA_VIDE_ID, 'operateur', STAFF_USER_ID)).json() as Reponse
    expect(data.paliers.palier_atteint).toBe(0)
    expect(data.paliers.palier1.manquants).toEqual(expect.arrayContaining(['Catégorie de service', 'Au moins une offre avec prix']))
  })

  it('palier 2 complet → trace de vérification (verifie_par / verifie_at)', async () => {
    const res = await put(PRESTA_ID, {
      identite_type: 'cni', identite_verifiee: true,
      adresse_activite: 'Akwa, face pharmacie', realisations_verifiees: true,
      references_contacts: [{ nom: 'Cliente Rose', telephone: '+237690111111' }],
      conditions_acceptees: true,
    }, 'operateur', STAFF_USER_ID)
    expect(res.status).toBe(200)
    const { data } = await res.json() as Reponse
    expect(data.paliers.palier2.complet).toBe(true)
    expect(data.paliers.palier_atteint).toBe(2)
    expect(data.dossier?.verifie_par).toBe(STAFF_USER_ID)
    expect(data.dossier?.verifie_at).toBeTruthy()
  })

  it('palier 3 complet → palier atteint = 3', async () => {
    const res = await put(PRESTA_ID, {
      mm_operateur: 'mtn', mm_numero: '+237670000000', mm_titulaire: 'Salon Akwa',
      statut_fiscal: 'Impôt libératoire', commission_convenue: true,
    }, 'operateur', STAFF_USER_ID)
    const { data } = await res.json() as Reponse
    expect(data.paliers.palier_atteint).toBe(3)
  })

  it('décocher une vérification efface la trace et fait retomber le palier', async () => {
    const res = await put(PRESTA_ID, { identite_verifiee: false }, 'operateur', STAFF_USER_ID)
    const { data } = await res.json() as Reponse
    expect(data.paliers.palier2.complet).toBe(false)
    expect(data.dossier?.verifie_par).toBeNull()
    // Le palier 3 est rempli mais ne compte pas sans le palier 2 : pas de trou.
    expect(data.paliers.palier3.complet).toBe(true)
    expect(data.paliers.palier_atteint).toBe(1)
  })

  it("ne bloque pas l'activation : le statut reste modifiable par le staff sans palier 2", async () => {
    const res = await app.request(`/api/prestataires/${PRESTA_VIDE_ID}/statut`, {
      method: 'PATCH', headers: authHeaders('operateur', STAFF_USER_ID), body: JSON.stringify({ statut: 'actif' }),
    })
    expect(res.status).toBe(200)
  })

  it('refuse un prestataire (non-staff), en lecture comme en écriture', async () => {
    expect((await get(PRESTA_ID, 'apprenant', PRESTA_USER_ID)).status).toBe(403)
    expect((await put(PRESTA_ID, { identite_verifiee: true }, 'apprenant', PRESTA_USER_ID)).status).toBe(403)
  })

  it('valide les entrées (opérateur Mobile Money inconnu → 400)', async () => {
    expect((await put(PRESTA_ID, { mm_operateur: 'wave' }, 'operateur', STAFF_USER_ID)).status).toBe(400)
  })
})
