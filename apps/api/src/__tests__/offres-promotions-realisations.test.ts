/**
 * offres-promotions-realisations.test.ts
 *
 * Couvre le portage self-service maidere-connect (0027) : ownership sur
 * /api/offres, /api/promotions, /api/realisations (mêmes règles que
 * prestataires.ts/clients.ts — staff ou propriétaire, jamais un tiers), et
 * les routes publiques /api/public/* (sans authentification), dont le
 * filtre "statut='actif'/publie=true/active=true" est le cœur de la
 * sécurité — c'est ce qui empêche un prestataire en_attente/suspendu
 * d'apparaître dans la vitrine.
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

const ADMIN_ID          = '11111111-1111-4111-8111-111111111111'
const PRESTA_A_USER_ID  = '22222222-2222-4222-8222-222222222222'
const PRESTA_A_ID       = '33333333-3333-4333-8333-333333333333'
const PRESTA_B_USER_ID  = '44444444-4444-4444-8444-444444444444'
const PRESTA_B_ID       = '55555555-5555-4555-8555-555555555555'
const PRESTA_SUSPENDU_ID = '66666666-6666-4666-8666-666666666666'
const CLIENT_USER_ID    = '77777777-7777-4777-8777-777777777777'
const OFFRE_A_ID        = '88888888-8888-4888-8888-888888888888'

beforeAll(() => {
  const db = fakeDb()
  db.seed('profiles', [
    { id: ADMIN_ID, email: 'admin@maideres.cm', nom: 'Admin', role: 'admin', actif: true },
    { id: PRESTA_A_USER_ID, email: 'a@maideres.cm', nom: 'Presta A', role: 'apprenant', actif: true },
    { id: PRESTA_B_USER_ID, email: 'b@maideres.cm', nom: 'Presta B', role: 'apprenant', actif: true },
    { id: CLIENT_USER_ID, email: 'c@maideres.cm', nom: 'Client', role: 'apprenant', actif: true },
  ])
  db.seed('prestataires', [
    {
      id: PRESTA_A_ID, profile_id: PRESTA_A_USER_ID, nom: 'Prestataire Actif', telephone: '+237690000001',
      statut: 'actif', ville: 'Douala', quartier: 'Akwa', metier: 'Plomberie', note_moyenne: '4.5',
    },
    {
      id: PRESTA_B_ID, profile_id: PRESTA_B_USER_ID, nom: 'Autre Prestataire', telephone: '+237690000002',
      statut: 'actif', ville: 'Yaoundé', quartier: 'Bastos', metier: 'Couture', note_moyenne: '3.0',
    },
    {
      id: PRESTA_SUSPENDU_ID, profile_id: '99999999-9999-4999-8999-999999999999', nom: 'Prestataire Suspendu',
      telephone: '+237690000003', statut: 'suspendu', ville: 'Douala', quartier: 'Akwa', metier: 'Plomberie',
    },
  ])
  db.seed('offres', [
    { id: OFFRE_A_ID, prestataire_id: PRESTA_A_ID, categorie: 'Plomberie', titre: 'Dépannage', prix: 15000, unite_prix: 'forfait', publie: true, prestations: [] },
  ])
})

async function call(method: string, path: string, role?: Parameters<typeof authHeaders>[0], userId?: string, body?: unknown) {
  return app.request(path, {
    method,
    headers: new Headers({
      'Content-Type': 'application/json',
      ...(role ? authHeaders(role, userId) : {}),
    }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('POST /api/offres — ownership', () => {
  it('un prestataire crée une offre pour sa propre fiche', async () => {
    const res = await call('POST', '/api/offres', 'apprenant', PRESTA_A_USER_ID, {
      categorie: 'Plomberie', titre: 'Nouvelle offre', prix: 20000,
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { prestataire_id: string } }
    expect(body.data.prestataire_id).toBe(PRESTA_A_ID)
  })

  it('un client sans fiche prestataire ne peut pas créer d\'offre → 422', async () => {
    const res = await call('POST', '/api/offres', 'apprenant', CLIENT_USER_ID, {
      categorie: 'Plomberie', titre: 'Offre impossible', prix: 1000,
    })
    expect(res.status).toBe(422)
  })

  it('le staff peut créer une offre pour n\'importe quelle fiche via prestataire_id', async () => {
    const res = await call('POST', '/api/offres', 'admin', ADMIN_ID, {
      categorie: 'Couture', titre: 'Offre créée par staff', prix: 5000, prestataire_id: PRESTA_B_ID,
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { prestataire_id: string } }
    expect(body.data.prestataire_id).toBe(PRESTA_B_ID)
  })
})

describe('PATCH/DELETE /api/offres/:id — un prestataire ne peut pas toucher la fiche d\'un autre', () => {
  it('PATCH sur l\'offre d\'un autre prestataire → 403', async () => {
    const res = await call('PATCH', `/api/offres/${OFFRE_A_ID}`, 'apprenant', PRESTA_B_USER_ID, { titre: 'Piraté' })
    expect(res.status).toBe(403)
  })

  it('le propriétaire peut modifier sa propre offre', async () => {
    const res = await call('PATCH', `/api/offres/${OFFRE_A_ID}`, 'apprenant', PRESTA_A_USER_ID, { titre: 'Dépannage rapide' })
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { titre: string } }
    expect(body.data.titre).toBe('Dépannage rapide')
  })

  it('DELETE sur l\'offre d\'un autre prestataire → 403', async () => {
    const res = await call('DELETE', `/api/offres/${OFFRE_A_ID}`, 'apprenant', PRESTA_B_USER_ID)
    expect(res.status).toBe(403)
  })
})

describe('GET /api/public/prestataires — annuaire public, sans authentification', () => {
  it('ne renvoie que les prestataires statut=actif (jamais suspendu/en_attente)', async () => {
    const res = await call('GET', '/api/public/prestataires')
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { id: string }[] }
    const ids = body.data.map((p) => p.id)
    expect(ids).toContain(PRESTA_A_ID)
    expect(ids).toContain(PRESTA_B_ID)
    expect(ids).not.toContain(PRESTA_SUSPENDU_ID)
  })

  it('filtre par ville', async () => {
    const res = await call('GET', '/api/public/prestataires?ville=Yaound%C3%A9')
    const body = await res.json() as { data: { id: string }[] }
    expect(body.data.map((p) => p.id)).toEqual([PRESTA_B_ID])
  })

  it('filtre par métier (categorie)', async () => {
    const res = await call('GET', '/api/public/prestataires?categorie=Couture')
    const body = await res.json() as { data: { id: string }[] }
    expect(body.data.map((p) => p.id)).toEqual([PRESTA_B_ID])
  })

  it('recherche par nom (ilike, insensible à la casse)', async () => {
    const res = await call('GET', '/api/public/prestataires?recherche=actif')
    const body = await res.json() as { data: { id: string }[] }
    expect(body.data.map((p) => p.id)).toEqual([PRESTA_A_ID])
  })
})

describe('GET /api/public/prestataires/:id — fiche publique', () => {
  it('renvoie null pour un prestataire non actif (jamais 500, jamais de fuite de données)', async () => {
    const res = await call('GET', `/api/public/prestataires/${PRESTA_SUSPENDU_ID}`)
    expect(res.status).toBe(200)
    const body = await res.json() as { data: null }
    expect(body.data).toBeNull()
  })

  it('renvoie la fiche + les offres publiées pour un prestataire actif', async () => {
    const res = await call('GET', `/api/public/prestataires/${PRESTA_A_ID}`)
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { prestataire: { id: string }; offres: { id: string }[] } }
    expect(body.data.prestataire.id).toBe(PRESTA_A_ID)
    expect(body.data.offres.map((o) => o.id)).toContain(OFFRE_A_ID)
  })
})

describe('Aucune route publique ne mute quoi que ce soit', () => {
  it('/api/public/* n\'expose aucune méthode d\'écriture pour ces ressources', async () => {
    // Aucun handler POST n'existe sur publicRouter pour cette ressource : le
    // routeur retombe sur le middleware d'auth du sous-app /api/* (401) plutôt
    // qu'un 404 propre — détail d'implémentation Hono, sans conséquence de
    // sécurité puisque rien n'est jamais muté dans les deux cas. On vérifie
    // la propriété qui compte réellement : jamais un statut de succès.
    const res = await call('POST', '/api/public/prestataires', undefined, undefined, { nom: 'Injection' })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
