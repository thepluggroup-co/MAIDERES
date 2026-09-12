/**
 * sla-commission-transactions.test.ts
 *
 * Ces trois routes n'avaient aucun test unitaire (seulement exercées, en
 * partie, par le suivi manuel de la fiche `apps/web`). Chacune porte une
 * règle métier cross-field non triviale, distincte de la validation Zod
 * pure (déjà couverte par packages/contracts) : c'est cette logique-là
 * qu'on teste ici, pas un simple passthrough CRUD.
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

async function call(method: string, path: string, role: Parameters<typeof authHeaders>[0], body?: unknown) {
  return app.request(path, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', ...authHeaders(role, 'user-1') }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('PATCH /api/sla_config/:id — seuil_alerte_heures doit rester < delai_heures', () => {
  it('rejette (422) un seuil supérieur ou égal au délai final, même en ne modifiant que le seuil', async () => {
    mockTables({ sla_config: { data: { delai_heures: 24, seuil_alerte_heures: 4 }, error: null } })
    // delai_heures reste 24 (non modifié) ; nouveau seuil = 24 → invalide.
    const res = await call('PATCH', '/api/sla_config/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin', { seuil_alerte_heures: 24 })
    expect(res.status).toBe(422)
  })

  it('accepte un seuil strictement inférieur au délai final (les deux modifiés ensemble)', async () => {
    mockTables({ sla_config: { data: { id: 'x', delai_heures: 48, seuil_alerte_heures: 4, niveau_urgence: 'urgent', created_at: 'now' }, error: null } })
    const res = await call('PATCH', '/api/sla_config/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin', { delai_heures: 48, seuil_alerte_heures: 6 })
    expect(res.status).toBe(200)
  })

  it('rejette un non-staff (403), avant même la validation métier', async () => {
    const res = await call('PATCH', '/api/sla_config/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'apprenant', { delai_heures: 10 })
    expect(res.status).toBe(403)
  })
})

describe('POST/PATCH /api/commission_config — un taux pourcentage ne dépasse jamais 100', () => {
  it('POST rejette (422 via Zod) un pourcentage de 150', async () => {
    const res = await call('POST', '/api/commission_config', 'admin', { type: 'pourcentage', valeur: 150 })
    expect(res.status).toBe(400) // refine() Zod → 400 zValidator, pas une HTTPException 422 applicative
  })

  it('POST accepte un montant_fixe de 5000 (la borne à 100 ne s\'applique qu\'au pourcentage)', async () => {
    mockTables({ commission_config: { data: { id: 'c1', categorie_id: null, type: 'montant_fixe', valeur: '5000', actif: true, created_at: 'now' }, error: null } })
    const res = await call('POST', '/api/commission_config', 'admin', { type: 'montant_fixe', valeur: 5000 })
    expect(res.status).toBe(201)
  })

  it('PATCH rejette (422) le passage à pourcentage=150 sur une règle existante (type déjà pourcentage)', async () => {
    mockTables({ commission_config: { data: { type: 'pourcentage', valeur: '15' }, error: null } })
    const res = await call('PATCH', '/api/commission_config/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'admin', { valeur: 150 })
    expect(res.status).toBe(422)
  })

  it('un opérateur (staff non-admin) peut lire mais pas créer une règle', async () => {
    mockTables({ commission_config: { data: [], error: null } })
    const readRes = await call('GET', '/api/commission_config', 'operateur')
    expect(readRes.status).toBe(200)
    const writeRes = await call('POST', '/api/commission_config', 'operateur', { type: 'pourcentage', valeur: 10 })
    expect(writeRes.status).toBe(403)
  })
})

describe('POST /api/transactions — uniquement pour un matching réalisé', () => {
  it('rejette (422) la création pour un matching encore "accepte"', async () => {
    mockTables({ matchings: { data: { id: 'm1', statut: 'accepte' }, error: null } })
    const res = await call('POST', '/api/transactions', 'admin', { matching_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', montant_service: 10000 })
    expect(res.status).toBe(422)
  })

  it('accepte la création pour un matching "realise"', async () => {
    mockTables({
      matchings: { data: { id: 'm1', statut: 'realise' }, error: null },
      transactions: {
        data: { id: 't1', matching_id: 'm1', montant_service: 10000, commission_taux: '15.00', commission_montant: 1500, statut_paiement: 'en_attente', ref_notchpay: null, created_at: 'now' },
        error: null,
      },
    })
    const res = await call('POST', '/api/transactions', 'admin', { matching_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', montant_service: 10000 })
    expect(res.status).toBe(201)
  })

  it('un client ne peut pas créer de transaction (403, staff uniquement)', async () => {
    const res = await call('POST', '/api/transactions', 'apprenant', { matching_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', montant_service: 10000 })
    expect(res.status).toBe(403)
  })
})
