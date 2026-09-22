/**
 * demande-depuis-offre.test.ts
 *
 * Sélection directe d'une offre sur la fiche publique d'un prestataire
 * (0033) : POST /api/demandes avec offre_id crée la demande au statut
 * 'nouvelle' en conservant l'offre choisie, mais NE crée AUCUN matching :
 * la demande passe d'abord par l'ERP (dispatch staff) avant d'atteindre
 * le prestataire.
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

const CLIENT_USER_ID = '11111111-1111-4111-8111-111111111111'
const CLIENT_ROW_ID  = '22222222-2222-4222-8222-222222222222'
const PRESTA_USER_ID = '33333333-3333-4333-8333-333333333333'
const PRESTA_ROW_ID  = '44444444-4444-4444-8444-444444444444'
const CATEGORIE_ID   = '55555555-5555-4555-8555-555555555555'
const OFFRE_ID        = '66666666-6666-4666-8666-666666666666'
const OFFRE_DEPUBLIEE_ID = '77777777-7777-4777-8777-777777777777'

beforeAll(() => {
  const db = fakeDb()
  db.seed('profiles', [
    { id: CLIENT_USER_ID, email: 'client@maideres.cm', nom: 'Client Test', role: 'apprenant', actif: true },
    { id: PRESTA_USER_ID, email: 'presta@maideres.cm', nom: 'Presta Test', role: 'apprenant', actif: true },
  ])
  db.seed('categories_services', [{ id: CATEGORIE_ID, libelle: 'Plomberie', actif: true }])
  db.seed('clients', [{ id: CLIENT_ROW_ID, profile_id: CLIENT_USER_ID, nom: 'Client Test', telephone: '+237690000001', quartier: 'Akwa' }])
  db.seed('prestataires', [{
    id: PRESTA_ROW_ID, profile_id: PRESTA_USER_ID, nom: 'Presta Test', telephone: '+237690000002',
    categories: [CATEGORIE_ID], quartier: 'Bonapriso', statut: 'actif', note_moyenne: '0', taux_commission: '15',
  }])
  db.seed('offres', [
    { id: OFFRE_ID, prestataire_id: PRESTA_ROW_ID, categorie: 'Plomberie', titre: 'Dépannage robinet', prix: 8000, unite_prix: 'forfait', publie: true, prestations: [] },
    { id: OFFRE_DEPUBLIEE_ID, prestataire_id: PRESTA_ROW_ID, categorie: 'Plomberie', titre: 'Offre retirée', prix: 5000, unite_prix: 'forfait', publie: false, prestations: [] },
  ])
})

async function call(method: string, path: string, role: Parameters<typeof authHeaders>[0], userId: string, body?: unknown) {
  return app.request(path, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', ...authHeaders(role, userId) }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('POST /api/demandes avec offre_id', () => {
  it("crée la demande 'nouvelle' avec l'offre en préférence, sans matching automatique", async () => {
    const res = await call('POST', '/api/demandes', 'apprenant', CLIENT_USER_ID, {
      categorie_id: CATEGORIE_ID,
      description:  'Robinet de cuisine qui fuit',
      offre_id:     OFFRE_ID,
    })
    expect(res.status).toBe(201)
    const { data: demande } = await res.json() as { data: { id: string; statut: string; offre_id: string } }
    expect(demande.offre_id).toBe(OFFRE_ID)
    expect(demande.statut).toBe('nouvelle')

    // Le prestataire ne voit rien tant que le staff n'a pas dispatché.
    const matchingsRes = await call('GET', `/api/matchings?demande_id=${demande.id}`, 'apprenant', PRESTA_USER_ID)
    const { data: matchings } = await matchingsRes.json() as { data: unknown[] }
    expect(matchings).toHaveLength(0)
  })

  it("refuse une offre qui n'est plus publiée", async () => {
    const res = await call('POST', '/api/demandes', 'apprenant', CLIENT_USER_ID, {
      categorie_id: CATEGORIE_ID,
      description:  'Test offre dépubliée',
      offre_id:     OFFRE_DEPUBLIEE_ID,
    })
    expect(res.status).toBe(422)
  })
})
