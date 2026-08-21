/**
 * Phase 2 — Tests d'intégration du flux marketplace.
 *
 * Flux complet : demande (client) → matching proposé (operateur) →
 * accepté (prestataire) → clôturé réalisé (prestataire) → avis (client).
 * Plus la vérification RBAC explicite de la Phase 2 : un client ne peut
 * pas clôturer un matching.
 *
 * Utilise fakeSupabase (état en mémoire, cohérent entre requêtes
 * successives) plutôt que les mocks à réponse unique de helpers.ts, car ce
 * flux dépend de l'état écrit par l'étape précédente.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import type { FakeSupabase } from './fakeSupabase'
import { authHeaders } from './helpers'

vi.mock('@forge/db/supabase', async () => {
  const { createFakeSupabase } = await import('./fakeSupabase')
  const client = createFakeSupabase()
  ;(globalThis as unknown as { __fakeDb: FakeSupabase }).__fakeDb = client
  return { supabase: client, supabaseAdmin: client }
})

import app from '../app'

const fakeDb = () => (globalThis as unknown as { __fakeDb: FakeSupabase }).__fakeDb

const ADMIN_ID       = '11111111-1111-4111-8111-111111111111'
const CLIENT_USER_ID = '22222222-2222-4222-8222-222222222222'
const PRESTA_USER_ID = '33333333-3333-4333-8333-333333333333'
const CLIENT_ROW_ID  = '44444444-4444-4444-8444-444444444444'
const PRESTA_ROW_ID  = '55555555-5555-4555-8555-555555555555'
const CATEGORIE_ID   = '66666666-6666-4666-8666-666666666666'

beforeAll(() => {
  const db = fakeDb()
  db.seed('profiles', [
    { id: ADMIN_ID,       email: 'admin@maideres.cm',  nom: 'Admin',       role: 'admin',      actif: true },
    { id: CLIENT_USER_ID, email: 'client@maideres.cm', nom: 'Client Test', role: 'technicien',  actif: true },
    { id: PRESTA_USER_ID, email: 'presta@maideres.cm', nom: 'Presta Test', role: 'technicien',  actif: true },
  ])
  db.seed('categories_services', [{ id: CATEGORIE_ID, libelle: 'Coiffure', actif: true }])
  db.seed('clients', [{ id: CLIENT_ROW_ID, profile_id: CLIENT_USER_ID, nom: 'Client Test', telephone: '+237690000001', quartier: 'Akwa' }])
  db.seed('prestataires', [{
    id: PRESTA_ROW_ID, profile_id: PRESTA_USER_ID, nom: 'Presta Test', telephone: '+237690000002',
    categories: [CATEGORIE_ID], quartier: 'Bonapriso', statut: 'actif', note_moyenne: '0', taux_commission: '15',
  }])
})

async function call(method: string, path: string, role: Parameters<typeof authHeaders>[0], userId: string, body?: unknown) {
  return app.request(path, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', ...authHeaders(role, userId) }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('Flux marketplace complet : demande → matching → clôture → avis', () => {
  let demandeId: string
  let matchingId: string

  it('un client crée une demande (POST /api/demandes)', async () => {
    const res = await call('POST', '/api/demandes', 'technicien', CLIENT_USER_ID, {
      categorie_id: CATEGORIE_ID,
      description:  'Coiffure à domicile samedi matin',
      canal:        'web',
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { id: string; statut: string; client_id: string } }
    expect(body.data.statut).toBe('nouvelle')
    expect(body.data.client_id).toBe(CLIENT_ROW_ID)
    demandeId = body.data.id
  })

  it("un opérateur propose le prestataire (POST /api/matchings) → demande passe en_traitement", async () => {
    const res = await call('POST', '/api/matchings', 'admin', ADMIN_ID, {
      demande_id: demandeId,
      prestataire_id: PRESTA_ROW_ID,
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { id: string; statut: string } }
    expect(body.data.statut).toBe('propose')
    matchingId = body.data.id

    const demande = fakeDb().dump('demandes').find((d) => d.id === demandeId)
    expect(demande?.statut).toBe('en_traitement')
  })

  it('le prestataire accepte (PATCH /:id/accepter) → demande passe matchee', async () => {
    const res = await call('PATCH', `/api/matchings/${matchingId}/accepter`, 'technicien', PRESTA_USER_ID)
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { statut: string } }
    expect(body.data.statut).toBe('accepte')

    const demande = fakeDb().dump('demandes').find((d) => d.id === demandeId)
    expect(demande?.statut).toBe('matchee')
  })

  it("le prestataire clôture en 'realise' (PATCH /:id/cloturer) → demande passe realisee", async () => {
    const res = await call('PATCH', `/api/matchings/${matchingId}/cloturer`, 'technicien', PRESTA_USER_ID, {
      issue: 'realise',
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { statut: string; closed_at: string | null } }
    expect(body.data.statut).toBe('realise')
    expect(body.data.closed_at).not.toBeNull()

    const demande = fakeDb().dump('demandes').find((d) => d.id === demandeId)
    expect(demande?.statut).toBe('realisee')
  })

  it('le client laisse un avis (POST /api/avis)', async () => {
    const res = await call('POST', '/api/avis', 'technicien', CLIENT_USER_ID, {
      matching_id: matchingId,
      note: 5,
      commentaire: 'Excellent service',
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { note: number } }
    expect(body.data.note).toBe(5)
  })

  it('chaque écriture a été journalisée dans audit_log', () => {
    const logs = fakeDb().dump('audit_log')
    const tables = logs.map((l) => l.table_name)
    expect(tables).toContain('demandes')
    expect(tables).toContain('matchings')
    expect(tables).toContain('avis')
  })
})

describe('RBAC — un client ne peut pas clôturer un matching', () => {
  it('POST demande → POST matching → PATCH cloturer par le client → 403', async () => {
    const demandeRes = await call('POST', '/api/demandes', 'technicien', CLIENT_USER_ID, {
      categorie_id: CATEGORIE_ID,
      description:  'Deuxième demande pour test RBAC',
    })
    const { data: demande } = await demandeRes.json() as { data: { id: string } }

    const matchingRes = await call('POST', '/api/matchings', 'admin', ADMIN_ID, {
      demande_id: demande.id,
      prestataire_id: PRESTA_ROW_ID,
    })
    const { data: matching } = await matchingRes.json() as { data: { id: string } }

    await call('PATCH', `/api/matchings/${matching.id}/accepter`, 'technicien', PRESTA_USER_ID)

    const cloturerRes = await call('PATCH', `/api/matchings/${matching.id}/cloturer`, 'technicien', CLIENT_USER_ID, {
      issue: 'realise',
    })
    expect(cloturerRes.status).toBe(403)
  })

  it('un client ne peut pas non plus proposer un matching (staff uniquement)', async () => {
    const res = await call('POST', '/api/matchings', 'technicien', CLIENT_USER_ID, {
      demande_id: 'whatever',
      prestataire_id: PRESTA_ROW_ID,
    })
    expect(res.status).toBe(403)
  })
})

describe('RBAC — un client ne voit pas les prestataires en_attente', () => {
  it("GET /api/prestataires en tant que client ne renvoie que les statut='actif'", async () => {
    const db = fakeDb()
    db.seed('prestataires', [{
      id: '77777777-7777-4777-8777-777777777777', profile_id: '88888888-8888-4888-8888-888888888888', nom: 'En attente',
      telephone: '+237690000099', categories: [], quartier: null, statut: 'en_attente',
      note_moyenne: '0', taux_commission: '15',
    }])

    const res = await call('GET', '/api/prestataires', 'technicien', CLIENT_USER_ID)
    expect(res.status).toBe(200)
    const body = await res.json() as { data: Array<{ statut: string }> }
    expect(body.data.every((p) => p.statut === 'actif')).toBe(true)
  })
})
