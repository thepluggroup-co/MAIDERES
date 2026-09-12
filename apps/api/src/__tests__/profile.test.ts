/**
 * profile.test.ts
 *
 * GET /api/profile/me renvoie désormais, en plus du profil brut, l'identité
 * métier dérivée (is_staff/client_id/prestataire_id) — cf. identity.service.ts.
 * C'est ce que maidere-connect (une fois branché sur ce projet Supabase,
 * cf. docs/integration/03-AUTH-MAPPING.md) utilise pour savoir si un
 * utilisateur fraîchement connecté doit atterrir sur /espace (client) ou
 * /pro (prestataire), sans réimplémenter cette résolution côté frontend.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkChain, authHeaders } from './helpers'

vi.mock('@maideres/db/supabase', () => {
  const client = { from: vi.fn() }
  return { supabase: client, supabaseAdmin: client }
})

import { supabase } from '@maideres/db/supabase'
import app from '../app'

type MockFn = ReturnType<typeof vi.fn>
const db = supabase as unknown as { from: MockFn }

function mockTables(responses: Record<string, Record<string, unknown>>) {
  db.from.mockImplementation((table: string) => mkChain(responses[table] ?? { data: null, error: null }) as never)
}

beforeEach(() => db.from.mockReset())

const PROFILE_ROW = {
  id: 'user-1', email: 'test@maideres.com', nom: 'Test', role: 'apprenant',
  telephone: null, adresse: null, actif: true, created_at: '2026-01-01T00:00:00Z',
}

async function getMe(role: Parameters<typeof authHeaders>[0]) {
  return app.request('/api/profile/me', { headers: new Headers(authHeaders(role, 'user-1')) })
}

describe('GET /api/profile/me — identité métier dérivée', () => {
  it('staff : is_staff=true, client_id/prestataire_id toujours null, aucune requête clients/prestataires déclenchée', async () => {
    mockTables({ profiles: { data: { ...PROFILE_ROW, role: 'admin' }, error: null } })

    const res = await getMe('admin')
    const body = await res.json() as { data: Record<string, unknown> }

    expect(res.status).toBe(200)
    expect(body.data.is_staff).toBe(true)
    expect(body.data.client_id).toBeNull()
    expect(body.data.prestataire_id).toBeNull()
    expect(db.from).not.toHaveBeenCalledWith('clients')
    expect(db.from).not.toHaveBeenCalledWith('prestataires')
  })

  it('prestataire : is_staff=false, prestataire_id résolu, client_id null', async () => {
    mockTables({
      profiles:      { data: PROFILE_ROW, error: null },
      clients:       { data: null, error: null },
      prestataires:  { data: { id: 'presta-1' }, error: null },
    })

    const res = await getMe('apprenant')
    const body = await res.json() as { data: Record<string, unknown> }

    expect(res.status).toBe(200)
    expect(body.data.is_staff).toBe(false)
    expect(body.data.prestataire_id).toBe('presta-1')
    expect(body.data.client_id).toBeNull()
  })

  it('client : is_staff=false, client_id résolu, prestataire_id null', async () => {
    mockTables({
      profiles:     { data: PROFILE_ROW, error: null },
      clients:      { data: { id: 'client-1' }, error: null },
      prestataires: { data: null, error: null },
    })

    const res = await getMe('apprenant')
    const body = await res.json() as { data: Record<string, unknown> }

    expect(res.status).toBe(200)
    expect(body.data.client_id).toBe('client-1')
    expect(body.data.prestataire_id).toBeNull()
  })

  it("compte tout juste inscrit (ni client ni prestataire) : les deux id sont null, pas d'erreur", async () => {
    mockTables({
      profiles:     { data: PROFILE_ROW, error: null },
      clients:      { data: null, error: null },
      prestataires: { data: null, error: null },
    })

    const res = await getMe('apprenant')
    const body = await res.json() as { data: Record<string, unknown> }

    expect(res.status).toBe(200)
    expect(body.data.client_id).toBeNull()
    expect(body.data.prestataire_id).toBeNull()
  })
})
