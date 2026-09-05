/**
 * transactions.test.ts
 *
 * Tests RBAC/validation unitaires (mock Supabase in-memory) pour
 * POST /api/transactions — uniquement les branches qui n'impliquent pas le
 * trigger Postgres trg_transactions_commission (403/404/422, avant l'insert).
 *
 * Le calcul de commission lui-même (public.calculer_commission, le trigger
 * qui le câble sur transactions, les 3 cas de résolution) ne peut PAS être
 * testé avec ce mock — un mock in-memory ne simule aucun trigger Postgres,
 * voir la docstring de marketplace-flow.test.ts. Couvert en conditions
 * réelles dans integration/commission-config.integration.test.ts.
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

const ADMIN_ID           = '11111111-1111-4111-8111-111111111111'
const CLIENT_USER_ID      = '22222222-2222-4222-8222-222222222222'
const MATCHING_REALISE_ID = '99999999-9999-4999-8999-999999999991'
const MATCHING_PROPOSE_ID = '99999999-9999-4999-8999-999999999992'

beforeAll(() => {
  const db = fakeDb()
  db.seed('profiles', [
    { id: ADMIN_ID,       email: 'admin@maideres.cm',  nom: 'Admin',       role: 'admin' },
    { id: CLIENT_USER_ID, email: 'client@maideres.cm', nom: 'Client Test', role: 'apprenant' },
  ])
  db.seed('matchings', [
    { id: MATCHING_REALISE_ID, demande_id: 'd1', prestataire_id: 'p1', statut: 'realise', proposed_at: new Date().toISOString() },
    { id: MATCHING_PROPOSE_ID, demande_id: 'd2', prestataire_id: 'p1', statut: 'propose', proposed_at: new Date().toISOString() },
  ])
})

async function call(method: string, path: string, role: Parameters<typeof authHeaders>[0], userId: string, body?: unknown) {
  return app.request(path, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', ...authHeaders(role, userId) }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('POST /api/transactions — RBAC et validation (avant tout calcul de commission)', () => {
  it('un client (non-staff) ne peut pas créer de transaction → 403', async () => {
    const res = await call('POST', '/api/transactions', 'apprenant', CLIENT_USER_ID, {
      matching_id: MATCHING_REALISE_ID, montant_service: 10_000,
    })
    expect(res.status).toBe(403)
  })

  it('matching_id inexistant → 404', async () => {
    const res = await call('POST', '/api/transactions', 'admin', ADMIN_ID, {
      matching_id: '00000000-0000-4000-8000-000000000000', montant_service: 10_000,
    })
    expect(res.status).toBe(404)
  })

  it("matching pas encore 'realise' → 422", async () => {
    const res = await call('POST', '/api/transactions', 'admin', ADMIN_ID, {
      matching_id: MATCHING_PROPOSE_ID, montant_service: 10_000,
    })
    expect(res.status).toBe(422)
  })

  it('montant_service négatif ou nul rejeté par le schéma → 400', async () => {
    const res = await call('POST', '/api/transactions', 'admin', ADMIN_ID, {
      matching_id: MATCHING_REALISE_ID, montant_service: 0,
    })
    expect(res.status).toBe(400)
  })
})
