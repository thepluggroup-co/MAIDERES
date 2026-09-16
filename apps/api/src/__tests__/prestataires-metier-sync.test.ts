/**
 * prestataires-metier-sync.test.ts
 *
 * Couvre la fusion métier déclaré -> catégories de dispatch (décision du
 * 15/09/2026) : quand un prestataire pose/modifie `metier_id` (POST /PATCH
 * /api/prestataires), ce métier doit rejoindre `categories` (le tableau
 * utilisé par le staff pour le matching/dispatch), sans jamais supprimer
 * une catégorie déjà assignée par le staff ni imposer de doublon.
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

const PRESTA_USER_ID = 'a1111111-1111-4111-8111-111111111111'
const PRESTA_ID      = 'a2222222-2222-4222-8222-222222222222'
const CAT_PLOMBERIE  = 'a3333333-3333-4333-8333-333333333333'
const CAT_COUTURE    = 'a4444444-4444-4444-8444-444444444444'
const CAT_STAFF_ONLY = 'a5555555-5555-4555-8555-555555555555'

beforeAll(() => {
  const db = fakeDb()
  db.seed('profiles', [
    { id: PRESTA_USER_ID, email: 'presta@maideres.cm', nom: 'Presta Sync', role: 'apprenant', actif: true },
  ])
  db.seed('prestataires', [
    {
      id: PRESTA_ID, profile_id: PRESTA_USER_ID, nom: 'Presta Sync', telephone: '+237690000009',
      statut: 'actif', ville: 'Douala', quartier: 'Akwa',
      categories: [CAT_STAFF_ONLY], metier_id: null,
    },
  ])
})

describe('PATCH /api/prestataires/:id — fusion metier_id -> categories', () => {
  it('ajoute le métier déclaré aux catégories, sans retirer celles déjà assignées par le staff', async () => {
    const res = await app.request(`/api/prestataires/${PRESTA_ID}`, {
      method: 'PATCH',
      headers: authHeaders('apprenant', PRESTA_USER_ID),
      body: JSON.stringify({ metier_id: CAT_PLOMBERIE }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { categories: string[]; metier_id: string } }
    expect(body.data.metier_id).toBe(CAT_PLOMBERIE)
    expect(body.data.categories.sort()).toEqual([CAT_STAFF_ONLY, CAT_PLOMBERIE].sort())
  })

  it('ne duplique pas si le métier est déjà dans les catégories', async () => {
    const res = await app.request(`/api/prestataires/${PRESTA_ID}`, {
      method: 'PATCH',
      headers: authHeaders('apprenant', PRESTA_USER_ID),
      body: JSON.stringify({ metier_id: CAT_PLOMBERIE }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { categories: string[] } }
    expect(body.data.categories.filter((c) => c === CAT_PLOMBERIE)).toHaveLength(1)
  })

  it('changer de métier ajoute la nouvelle catégorie sans retirer les anciennes', async () => {
    const res = await app.request(`/api/prestataires/${PRESTA_ID}`, {
      method: 'PATCH',
      headers: authHeaders('apprenant', PRESTA_USER_ID),
      body: JSON.stringify({ metier_id: CAT_COUTURE }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { categories: string[] } }
    expect(body.data.categories.sort()).toEqual([CAT_STAFF_ONLY, CAT_PLOMBERIE, CAT_COUTURE].sort())
  })

  it('poser metier_id à null ne modifie pas categories', async () => {
    const res = await app.request(`/api/prestataires/${PRESTA_ID}`, {
      method: 'PATCH',
      headers: authHeaders('apprenant', PRESTA_USER_ID),
      body: JSON.stringify({ metier_id: null }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { categories: string[]; metier_id: string | null } }
    expect(body.data.metier_id).toBeNull()
    expect(body.data.categories.sort()).toEqual([CAT_STAFF_ONLY, CAT_PLOMBERIE, CAT_COUTURE].sort())
  })
})

describe('POST /api/prestataires — fusion metier_id -> categories à la création', () => {
  it("inclut le métier déclaré dans categories dès l'inscription", async () => {
    const nouveauUserId = 'a6666666-6666-4666-8666-666666666666'
    fakeDb().seed('profiles', [
      { id: nouveauUserId, email: 'nouveau@maideres.cm', nom: 'Nouveau', role: 'apprenant', actif: true },
    ])
    const res = await app.request('/api/prestataires', {
      method: 'POST',
      headers: authHeaders('apprenant', nouveauUserId),
      body: JSON.stringify({
        nom: 'Nouveau Prestataire', telephone: '+237690000010', metier_id: CAT_COUTURE,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { categories: string[]; metier_id: string } }
    expect(body.data.metier_id).toBe(CAT_COUTURE)
    expect(body.data.categories).toEqual([CAT_COUTURE])
  })
})
