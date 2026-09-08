/**
 * marketplace-flow.test.ts
 *
 * Tests RBAC unitaires (mock Supabase in-memory) : vérifient notre logique
 * d'autorisation dans les routes (isStaff / ownPrestataireId / ownClientId),
 * pas le comportement réel de Supabase — légitime à mocker ici, ces
 * décisions ne dépendent que de notre propre code.
 *
 * Le flux complet demande → matching → clôture → avis (+ vérification
 * audit_log) est testé en conditions réelles, sans mock, dans
 * integration/marketplace-flow.integration.test.ts — un mock in-memory
 * teste notre modèle mental de Supabase, pas Supabase, ce qui avait
 * laissé passer l'absence de la table audit_log en Phase 2.
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
    { id: CLIENT_USER_ID, email: 'client@maideres.cm', nom: 'Client Test', role: 'apprenant',  actif: true },
    { id: PRESTA_USER_ID, email: 'presta@maideres.cm', nom: 'Presta Test', role: 'apprenant',  actif: true },
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

describe('RBAC — un client ne peut pas clôturer un matching', () => {
  it('POST demande → POST matching → PATCH cloturer par le client → 403', async () => {
    const demandeRes = await call('POST', '/api/demandes', 'apprenant', CLIENT_USER_ID, {
      categorie_id: CATEGORIE_ID,
      description:  'Deuxième demande pour test RBAC',
    })
    const { data: demande } = await demandeRes.json() as { data: { id: string } }

    const matchingRes = await call('POST', '/api/matchings', 'admin', ADMIN_ID, {
      demande_id: demande.id,
      prestataire_id: PRESTA_ROW_ID,
    })
    const { data: matching } = await matchingRes.json() as { data: { id: string } }

    await call('PATCH', `/api/matchings/${matching.id}/accepter`, 'apprenant', PRESTA_USER_ID)

    const cloturerRes = await call('PATCH', `/api/matchings/${matching.id}/cloturer`, 'apprenant', CLIENT_USER_ID, {
      issue: 'realise',
    })
    expect(cloturerRes.status).toBe(403)
  })

  it('un client ne peut pas non plus proposer un matching (staff uniquement)', async () => {
    const res = await call('POST', '/api/matchings', 'apprenant', CLIENT_USER_ID, {
      demande_id: 'whatever',
      prestataire_id: PRESTA_ROW_ID,
    })
    expect(res.status).toBe(403)
  })
})

describe('Cycle complet demande → matching → avis → réponse prestataire → vitrine publique', () => {
  it('un client crée une demande, se fait matcher, laisse un avis une fois réalisé ; le prestataire concerné y répond, un autre prestataire ne peut pas', async () => {
    const demandeRes = await call('POST', '/api/demandes', 'apprenant', CLIENT_USER_ID, {
      categorie_id: CATEGORIE_ID,
      description:  "Fuite sous l'évier",
    })
    expect(demandeRes.status).toBe(201)
    const { data: demande } = await demandeRes.json() as { data: { id: string } }

    const matchingRes = await call('POST', '/api/matchings', 'admin', ADMIN_ID, {
      demande_id: demande.id,
      prestataire_id: PRESTA_ROW_ID,
    })
    expect(matchingRes.status).toBe(201)
    const { data: matching } = await matchingRes.json() as { data: { id: string } }

    await call('PATCH', `/api/matchings/${matching.id}/accepter`, 'apprenant', PRESTA_USER_ID)
    const cloturerRes = await call('PATCH', `/api/matchings/${matching.id}/cloturer`, 'apprenant', PRESTA_USER_ID, { issue: 'realise' })
    expect(cloturerRes.status).toBe(200)

    const avisRes = await call('POST', '/api/avis', 'apprenant', CLIENT_USER_ID, {
      matching_id: matching.id, note: 5, commentaire: 'Impeccable, je recommande',
    })
    expect(avisRes.status).toBe(201)
    const { data: avis } = await avisRes.json() as { data: { id: string } }

    // Un autre prestataire (n'ayant aucun matching avec cet avis) ne peut pas y répondre.
    const AUTRE_PRESTA_USER_ID = '99999999-9999-4999-8999-999999999901'
    const AUTRE_PRESTA_ROW_ID  = '99999999-9999-4999-8999-999999999902'
    fakeDb().seed('profiles', [
      { id: AUTRE_PRESTA_USER_ID, email: 'autre@maideres.cm', nom: 'Autre Presta', role: 'apprenant', actif: true },
    ])
    fakeDb().seed('prestataires', [{
      id: AUTRE_PRESTA_ROW_ID, profile_id: AUTRE_PRESTA_USER_ID, nom: 'Autre Presta',
      telephone: '+237690000098', categories: [], quartier: null, statut: 'actif',
      note_moyenne: '0', taux_commission: '15',
    }])
    const reponseInterditeRes = await call('PATCH', `/api/avis/${avis.id}`, 'apprenant', AUTRE_PRESTA_USER_ID, { reponse: 'Piraté' })
    expect(reponseInterditeRes.status).toBe(403)

    // Le prestataire concerné répond bien.
    const reponseRes = await call('PATCH', `/api/avis/${avis.id}`, 'apprenant', PRESTA_USER_ID, { reponse: 'Merci beaucoup !' })
    expect(reponseRes.status).toBe(200)
    const { data: avisAvecReponse } = await reponseRes.json() as { data: { reponse: string; note: number; commentaire: string } }
    expect(avisAvecReponse.reponse).toBe('Merci beaucoup !')
    // note/commentaire (propriété du client) inchangés par la réponse du prestataire.
    expect(avisAvecReponse.note).toBe(5)
    expect(avisAvecReponse.commentaire).toBe('Impeccable, je recommande')

    // La vitrine publique (sans authentification) affiche l'avis + la réponse,
    // jamais d'information identifiant le client auteur.
    const publicRes = await app.request(`/api/public/prestataires/${PRESTA_ROW_ID}`)
    expect(publicRes.status).toBe(200)
    const { data: fiche } = await publicRes.json() as {
      data: { avis: Array<{ note: number; commentaire: string; reponse: string; client_id?: string }> }
    }
    expect(fiche.avis).toHaveLength(1)
    expect(fiche.avis[0]!.note).toBe(5)
    expect(fiche.avis[0]!.reponse).toBe('Merci beaucoup !')
    expect(fiche.avis[0]!.client_id).toBeUndefined()
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

    const res = await call('GET', '/api/prestataires', 'apprenant', CLIENT_USER_ID)
    expect(res.status).toBe(200)
    const body = await res.json() as { data: Array<{ statut: string }> }
    expect(body.data.every((p) => p.statut === 'actif')).toBe(true)
  })
})
