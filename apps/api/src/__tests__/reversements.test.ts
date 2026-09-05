/**
 * reversements.test.ts
 *
 * Tests avec mock Supabase in-memory (fakeSupabase) pour :
 *  - GET /api/reversements — filtrage par rôle (staff : tout ; prestataire :
 *    uniquement le sien ; utilisateur sans fiche prestataire : liste vide) ;
 *  - PATCH /:id/marquer-paye — RBAC, garde-fous 404/422, et le calcul du
 *    montant net (montant_service − commission_montant, jamais transmis par
 *    le client) via le pointeur ref='intervention:<id>' amorcé par le trigger
 *    sync_intervention_statut (0009_intervention_sync.sql). Contrairement au
 *    calcul de commission (public.calculer_commission, trigger Postgres, non
 *    simulable par ce mock — voir transactions.test.ts), cette résolution vit
 *    entièrement dans la route et peut donc être testée ici.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
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
const PRESTATAIRE_USER_ID = '22222222-2222-4222-8222-222222222222'
const AUTRE_PRESTATAIRE_USER_ID = '33333333-3333-4333-8333-333333333333'
const CLIENT_USER_ID    = '44444444-4444-4444-8444-444444444444'

const PRESTATAIRE_ID       = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const AUTRE_PRESTATAIRE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const MATCHING_ID          = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const INTERVENTION_ID      = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

const REV_DUE_ID           = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const REV_SANS_TX_ID       = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
const REV_DEJA_PAYE_ID     = '99999999-9999-4999-8999-999999999999'
const REV_AUTRE_PREST_ID   = '88888888-8888-4888-8888-888888888888'

beforeEach(() => {
  const db = fakeDb()
  db.seed('prestataires', [
    { id: PRESTATAIRE_ID, profile_id: PRESTATAIRE_USER_ID, nom: 'Plombier Pro' },
    { id: AUTRE_PRESTATAIRE_ID, profile_id: AUTRE_PRESTATAIRE_USER_ID, nom: 'Électricien Pro' },
  ])
  db.seed('matchings', [
    { id: MATCHING_ID, demande_id: 'dem-1', prestataire_id: PRESTATAIRE_ID, statut: 'realise', proposed_at: new Date().toISOString() },
  ])
  db.seed('interventions', [
    { id: INTERVENTION_ID, matching_id: MATCHING_ID, statut: 'realisee' },
  ])
  db.seed('transactions', [
    { id: 'tx-1', matching_id: MATCHING_ID, montant_service: 10_000, commission_montant: 1_500 },
  ])
  db.seed('reversements', [
    { id: REV_DUE_ID, prestataire_id: PRESTATAIRE_ID, montant: 0, statut: 'en_attente', ref: `intervention:${INTERVENTION_ID}`, date_paiement: null },
    { id: REV_SANS_TX_ID, prestataire_id: PRESTATAIRE_ID, montant: 0, statut: 'en_attente', ref: 'intervention:introuvable', date_paiement: null },
    { id: REV_DEJA_PAYE_ID, prestataire_id: PRESTATAIRE_ID, montant: 8_500, statut: 'traite', ref: `intervention:${INTERVENTION_ID}`, date_paiement: new Date().toISOString() },
    { id: REV_AUTRE_PREST_ID, prestataire_id: AUTRE_PRESTATAIRE_ID, montant: 3_000, statut: 'traite', ref: 'intervention:autre', date_paiement: new Date().toISOString() },
  ])
})

async function call(method: string, path: string, role: Parameters<typeof authHeaders>[0], userId: string, body?: unknown) {
  return app.request(path, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', ...authHeaders(role, userId) }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/reversements — filtrage par rôle', () => {
  it('le staff voit tous les reversements', async () => {
    const res = await call('GET', '/api/reversements', 'admin', ADMIN_ID)
    const body = await res.json() as { data: { id: string }[] }
    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(4)
  })

  it('un prestataire ne voit que ses propres reversements', async () => {
    const res = await call('GET', '/api/reversements', 'livreur', PRESTATAIRE_USER_ID)
    const body = await res.json() as { data: { id: string; prestataire_id: string }[] }
    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(3)
    expect(body.data.every((r) => r.prestataire_id === PRESTATAIRE_ID)).toBe(true)
  })

  it('un utilisateur sans fiche prestataire ni staff obtient une liste vide', async () => {
    const res = await call('GET', '/api/reversements', 'apprenant', CLIENT_USER_ID)
    const body = await res.json() as { data: unknown[] }
    expect(res.status).toBe(200)
    expect(body.data).toEqual([])
  })
})

describe('PATCH /api/reversements/:id/marquer-paye', () => {
  it('un non-staff ne peut pas marquer payé → 403', async () => {
    const res = await call('PATCH', `/api/reversements/${REV_DUE_ID}/marquer-paye`, 'apprenant', CLIENT_USER_ID, {})
    expect(res.status).toBe(403)
  })

  it('id inexistant → 404', async () => {
    const res = await call('PATCH', '/api/reversements/00000000-0000-4000-8000-000000000000/marquer-paye', 'admin', ADMIN_ID, {})
    expect(res.status).toBe(404)
  })

  it('déjà payé → 422', async () => {
    const res = await call('PATCH', `/api/reversements/${REV_DEJA_PAYE_ID}/marquer-paye`, 'admin', ADMIN_ID, {})
    expect(res.status).toBe(422)
  })

  it("aucune transaction liée à l'intervention d'origine → 422", async () => {
    const res = await call('PATCH', `/api/reversements/${REV_SANS_TX_ID}/marquer-paye`, 'admin', ADMIN_ID, {})
    expect(res.status).toBe(422)
  })

  it('calcule le montant net (montant_service − commission_montant) et marque payé', async () => {
    const res = await call('PATCH', `/api/reversements/${REV_DUE_ID}/marquer-paye`, 'admin', ADMIN_ID, {})
    const body = await res.json() as { data: { statut: string; montant: number; date_paiement: string | null; ref: string } }
    expect(res.status).toBe(200)
    expect(body.data.statut).toBe('traite')
    expect(body.data.montant).toBe(8_500)
    expect(body.data.date_paiement).not.toBeNull()
    expect(body.data.ref).toBe(`intervention:${INTERVENTION_ID}`)
  })
})
