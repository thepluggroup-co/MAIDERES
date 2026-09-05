/**
 * identity.test.ts
 *
 * ownPrestataireId / ownClientId sont la seule frontière de sécurité pour un
 * utilisateur externe (l'API tourne en service role, bypass RLS). Couvre :
 *   (a) erreur Supabase → exception (jamais avalée en null)
 *   (b) aucune ligne → null
 *   (c) ligne présente → id
 *   (d) supabaseAdmin non configuré → exception actionnable (nom de la var d'env)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock Supabase ──────────────────────────────────────────────────────────────

vi.mock('@maideres/db', () => ({
  supabaseAdmin: { from: vi.fn() },
}))

import { supabaseAdmin } from '@maideres/db'
import { ownPrestataireId, ownClientId } from '../services/identity.service'

type MockFn = ReturnType<typeof vi.fn>
const db = supabaseAdmin as unknown as { from: MockFn }

function buildBuilder(resolved: unknown) {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'maybeSingle']) {
    b[m] = () => (m === 'maybeSingle' ? Promise.resolve(resolved) : b)
  }
  return b
}

function mockDb(tableResponses: Record<string, unknown>) {
  db.from.mockImplementation((table: string) => buildBuilder(tableResponses[table] ?? { data: null, error: null }))
}

beforeEach(() => db.from.mockReset())

// ═══════════════════════════════════════════════════════════════════════════════
// ownPrestataireId
// ═══════════════════════════════════════════════════════════════════════════════

describe('ownPrestataireId', () => {
  it('(a) erreur Supabase → lève une exception (ne renvoie jamais null silencieusement)', async () => {
    mockDb({ prestataires: { data: null, error: { message: 'connection reset' } } })
    await expect(ownPrestataireId('user-1')).rejects.toThrow(/connection reset/)
  })

  it('(b) aucune ligne trouvée → null', async () => {
    mockDb({ prestataires: { data: null, error: null } })
    await expect(ownPrestataireId('user-1')).resolves.toBeNull()
  })

  it('(c) ligne présente → id', async () => {
    mockDb({ prestataires: { data: { id: 'prest-123' }, error: null } })
    await expect(ownPrestataireId('user-1')).resolves.toBe('prest-123')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// ownClientId
// ═══════════════════════════════════════════════════════════════════════════════

describe('ownClientId', () => {
  it('(a) erreur Supabase → lève une exception', async () => {
    mockDb({ clients: { data: null, error: { message: 'timeout' } } })
    await expect(ownClientId('user-1')).rejects.toThrow(/timeout/)
  })

  it('(b) aucune ligne trouvée → null', async () => {
    mockDb({ clients: { data: null, error: null } })
    await expect(ownClientId('user-1')).resolves.toBeNull()
  })

  it('(c) ligne présente → id', async () => {
    mockDb({ clients: { data: { id: 'client-456' }, error: null } })
    await expect(ownClientId('user-1')).resolves.toBe('client-456')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// supabaseAdmin non configuré — plus d'assertion de non-nullité silencieuse
// ═══════════════════════════════════════════════════════════════════════════════

describe('supabaseAdmin non configuré', () => {
  it('lève une exception actionnable citant SUPABASE_SERVICE_ROLE_KEY', async () => {
    vi.resetModules()
    vi.doMock('@maideres/db', () => ({ supabaseAdmin: null }))
    const { ownPrestataireId: ownPrestataireIdUnconfigured } = await import('../services/identity.service')

    await expect(ownPrestataireIdUnconfigured('user-1')).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/)

    vi.doUnmock('@maideres/db')
    vi.resetModules()
  })
})
