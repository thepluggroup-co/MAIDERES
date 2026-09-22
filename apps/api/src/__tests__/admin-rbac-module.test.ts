/**
 * admin-rbac-module.test.ts
 *
 * Couvre le correctif du 16/09/2026 : les routes admin.ts vérifiaient un
 * module RBAC 'ADMIN' qui n'existe dans aucune permission réelle (ni seed,
 * ni garde-rail SUPER_ADMIN) — ces routes renvoyaient 403 "Accès refusé"
 * pour absolument tout le monde, y compris SUPER_ADMIN, en toute
 * circonstance. Corrigé en UTILISATEURS (gestion des comptes),
 * AUDIT (export des logs) et PARAMETRAGE (réglages de sécurité), qui sont
 * bien dans le périmètre couvert par le garde-rail SUPER_ADMIN.
 *
 * Chaque test ci-dessous aurait échoué avec 403 avant le correctif.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import type { FakeSupabase } from './fakeSupabase'
import { authHeaders } from './helpers'
import { vi } from 'vitest'

vi.mock('@maideres/db/supabase', async () => {
  const { createFakeSupabase } = await import('./fakeSupabase')
  const client = createFakeSupabase()
  ;(globalThis as unknown as { __fakeDb: FakeSupabase }).__fakeDb = client
  return { supabase: client, supabaseAdmin: client }
})

import app from '../app'

const fakeDb = () => (globalThis as unknown as { __fakeDb: FakeSupabase }).__fakeDb

const SUPER_ADMIN_ID = 'b1111111-1111-4111-8111-111111111111'
const CIBLE_ID        = 'b2222222-2222-4222-8222-222222222222'

beforeAll(() => {
  const db = fakeDb()
  // Aucune ligne rbac_user_profiles pour ces deux comptes : checkPermission
  // retombe sur le fallback legacy (LEGACY_ROLE_MAP), 'admin' -> SUPER_ADMIN,
  // comme le fait tout le reste de la suite de tests existante.
  db.seed('profiles', [
    { id: SUPER_ADMIN_ID, email: 'super@maideres.cm', nom: 'Super Admin', role: 'admin', actif: true },
    { id: CIBLE_ID, email: 'cible@maideres.cm', nom: 'Compte Cible', role: 'operateur', actif: true },
  ])
})

describe('admin.ts — routes anciennement bloquées par le module ADMIN', () => {
  it("PATCH /rbac/users/:id/deactivate n'échoue plus en 403", async () => {
    const res = await app.request(`/api/admin/rbac/users/${CIBLE_ID}/deactivate`, {
      method: 'PATCH',
      headers: authHeaders('admin', SUPER_ADMIN_ID),
    })
    expect(res.status).not.toBe(403)
  })

  it("PATCH /rbac/users/:id/reset-password n'échoue plus en 403", async () => {
    const res = await app.request(`/api/admin/rbac/users/${CIBLE_ID}/reset-password`, {
      method: 'PATCH',
      headers: authHeaders('admin', SUPER_ADMIN_ID),
    })
    expect(res.status).not.toBe(403)
  })

  it("GET /rbac/audit-logs/export n'échoue plus en 403", async () => {
    const res = await app.request('/api/admin/rbac/audit-logs/export', {
      method: 'GET',
      headers: authHeaders('admin', SUPER_ADMIN_ID),
    })
    expect(res.status).not.toBe(403)
  })

  it("PATCH /rbac/security-settings n'échoue plus en 403", async () => {
    const res = await app.request('/api/admin/rbac/security-settings', {
      method: 'PATCH',
      headers: authHeaders('admin', SUPER_ADMIN_ID),
      body: JSON.stringify({}),
    })
    expect(res.status).not.toBe(403)
  })

  it("DELETE /rbac/users/:id n'échoue plus en 403", async () => {
    // Pas d'assertion 200 ici : fakeSupabase ne mocke pas le namespace
    // `auth.admin` (supabaseAdmin!.auth.admin.deleteUser), donc la route
    // échoue plus loin (500) une fois la vérification de permission passée
    // — ce qui est justement ce qu'on veut confirmer : la permission n'est
    // plus le blocage.
    const res = await app.request(`/api/admin/rbac/users/${CIBLE_ID}`, {
      method: 'DELETE',
      headers: authHeaders('admin', SUPER_ADMIN_ID),
    })
    expect(res.status).not.toBe(403)
  })

  it('un non-SUPER_ADMIN (sans permission UTILISATEURS accordée) reste bloqué en 403', async () => {
    // Contrôle négatif : le correctif ne doit pas ouvrir ces routes à tout
    // le monde, seulement corriger le module vérifié pour ceux qui ont
    // légitimement la permission (garde-rail SUPER_ADMIN, ou une permission
    // explicitement accordée via rbac_role_permissions).
    const res = await app.request(`/api/admin/rbac/users/${CIBLE_ID}/deactivate`, {
      method: 'PATCH',
      headers: authHeaders('apprenant', 'b3333333-3333-4333-8333-333333333333'),
    })
    expect(res.status).toBe(403)
  })
})
