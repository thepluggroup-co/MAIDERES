/**
 * prestataires-pilote.test.ts
 *
 * Couvre le marquage de l'échantillon pilote (0034, décision du 17/09/2026
 * — cf. docs/integration/12-NIVEAU-2-PROCESSUS-ET-GOUVERNANCE.md §6) :
 * seul le staff peut marquer/démarquer un prestataire comme pilote, jamais
 * en self-service, et le filtre ?pilote= ne doit lister que les vrais
 * membres de l'échantillon.
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

const STAFF_USER_ID   = 'b1111111-1111-4111-8111-111111111111'
const PRESTA_USER_ID  = 'b2222222-2222-4222-8222-222222222222'
const PRESTA_PILOTE_ID    = 'b3333333-3333-4333-8333-333333333333'
const PRESTA_HORS_PILOTE_ID = 'b4444444-4444-4444-8444-444444444444'

beforeAll(() => {
  const db = fakeDb()
  db.seed('profiles', [
    { id: STAFF_USER_ID, email: 'staff@maideres.cm', nom: 'Staff Test', role: 'operateur', actif: true },
    { id: PRESTA_USER_ID, email: 'presta@maideres.cm', nom: 'Presta Test', role: 'apprenant', actif: true },
  ])
  db.seed('prestataires', [
    { id: PRESTA_PILOTE_ID, profile_id: PRESTA_USER_ID, nom: 'Presta Pilote', telephone: '+237690000010', statut: 'actif', pilote: false },
    { id: PRESTA_HORS_PILOTE_ID, profile_id: STAFF_USER_ID, nom: 'Presta Hors Pilote', telephone: '+237690000011', statut: 'actif', pilote: false },
  ])
})

describe('PATCH /api/prestataires/:id/pilote', () => {
  it('le staff peut marquer un prestataire comme pilote', async () => {
    const res = await app.request(`/api/prestataires/${PRESTA_PILOTE_ID}/pilote`, {
      method: 'PATCH',
      headers: authHeaders('operateur', STAFF_USER_ID),
      body: JSON.stringify({ pilote: true }),
    })
    expect(res.status).toBe(200)
    const { data } = await res.json() as { data: { pilote: boolean } }
    expect(data.pilote).toBe(true)
  })

  it('le prestataire ne peut pas se marquer lui-même pilote (self-service ignore le champ)', async () => {
    const res = await app.request(`/api/prestataires/${PRESTA_PILOTE_ID}`, {
      method: 'PATCH',
      headers: authHeaders('apprenant', PRESTA_USER_ID),
      body: JSON.stringify({ pilote: false, bio: 'Mise à jour légitime' }),
    })
    expect(res.status).toBe(200)
    const { data } = await res.json() as { data: { pilote: boolean; bio: string } }
    // La tentative de repasser à false est ignorée : le champ n'existe pas
    // dans UpdatePrestataireSchema, donc jamais transmis à la mise à jour.
    expect(data.pilote).toBe(true)
    expect(data.bio).toBe('Mise à jour légitime')
  })

  it('?pilote=true ne liste que les membres de l\u2019échantillon', async () => {
    const res = await app.request('/api/prestataires?pilote=true', {
      headers: authHeaders('operateur', STAFF_USER_ID),
    })
    const { data } = await res.json() as { data: { id: string }[] }
    expect(data.map((p) => p.id)).toEqual([PRESTA_PILOTE_ID])
  })

  it('refuse la requête d\u2019un prestataire (non-staff)', async () => {
    const res = await app.request(`/api/prestataires/${PRESTA_HORS_PILOTE_ID}/pilote`, {
      method: 'PATCH',
      headers: authHeaders('apprenant', PRESTA_USER_ID),
      body: JSON.stringify({ pilote: true }),
    })
    expect(res.status).toBe(403)
  })
})
