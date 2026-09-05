/**
 * marketplace-flow.integration.test.ts
 *
 * VRAI test d'intégration — aucun mock Supabase. Exécuté contre une instance
 * Supabase de TEST dédiée (jamais le projet MAIDERES de dev/prod — voir
 * README § "Tests d'intégration" pour la configuration).
 *
 * Remplace l'ancienne version mockée de ce test (fakeSupabase, état en
 * mémoire) : un mock in-memory teste notre modèle mental de Supabase, pas
 * Supabase — c'est exactement la classe d'erreur qui avait laissé passer
 * l'absence de la table audit_log en Phase 2 (le mock l'avait "créée"
 * implicitement en la seedant, alors qu'aucune migration réelle ne
 * l'avait jamais créée).
 *
 * Ignoré automatiquement (describe.skip) si TEST_SUPABASE_URL /
 * TEST_SUPABASE_ANON_KEY / TEST_SUPABASE_SERVICE_ROLE_KEY ne sont pas
 * définies — ne casse donc pas `pnpm test` en local/CI sans ces secrets.
 *
 * Note découverte pendant l'écriture de ce test : audit.ts (middleware
 * conservé tel quel depuis Phase 0) extrait `record_id` depuis l'URL —
 * pour un POST sur une collection (ex. POST /api/demandes), il n'y a pas
 * d'id dans l'URL, donc `record_id` est NULL dans audit_log pour toute
 * création. La vérification "audit_log alimenté" pour les POST se fait
 * donc par (table_name, action, fenêtre de temps), pas par record_id —
 * qui lui n'est fiable que pour les PATCH/DELETE (id présent dans l'URL).
 * C'est une limitation réelle du middleware existant, pas un artefact du
 * test ; non corrigée ici, hors périmètre de cette tâche.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const TEST_SUPABASE_URL              = process.env.TEST_SUPABASE_URL
const TEST_SUPABASE_ANON_KEY         = process.env.TEST_SUPABASE_ANON_KEY
const TEST_SUPABASE_SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY

const CONFIGURED = Boolean(TEST_SUPABASE_URL && TEST_SUPABASE_ANON_KEY && TEST_SUPABASE_SERVICE_ROLE_KEY)

if (!CONFIGURED) {
  console.warn(
    '[integration] TEST_SUPABASE_URL / TEST_SUPABASE_ANON_KEY / TEST_SUPABASE_SERVICE_ROLE_KEY ' +
    "non définies — tests d'intégration ignorés (voir README § Tests d'intégration).",
  )
}

const PASSWORD = 'Integration-Test-Passw0rd!'
const EMAILS = {
  staff:  'integration-staff@maideres-test.cm',
  client: 'integration-client@maideres-test.cm',
  presta: 'integration-presta@maideres-test.cm',
} as const
const CATEGORIE_LIBELLE = '__integration_test__ Coiffure'

async function loadApp() {
  // Import dynamique : @maideres/db et le middleware auth lisent process.env au
  // chargement du module — il faut avoir pointé SUPABASE_URL/keys vers le
  // projet de TEST (fait juste avant l'appel) avant ce premier import.
  return (await import('../../app')).default
}

type App = Awaited<ReturnType<typeof loadApp>>

describe.skipIf(!CONFIGURED)('Flux marketplace réel (Supabase de test) : demande → matching → clôture → avis', () => {
  let admin: SupabaseClient
  let app: App

  let userIds: { staff: string; client: string; presta: string }
  let tokens: { staff: string; client: string; presta: string }
  let categorieId: string
  let clientRowId: string
  let prestataireRowId: string

  let demandeId: string
  let matchingId: string
  let avisId: string

  const createdDemandeIds: string[] = []
  const createdMatchingIds: string[] = []
  const createdAvisIds: string[] = []

  function isoMinus(ms: number): string {
    return new Date(Date.now() - ms).toISOString()
  }

  async function call(token: string, method: string, path: string, body?: unknown) {
    return app.request(path, {
      method,
      headers: new Headers({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  /**
   * L'écriture dans audit_log est fire-and-forget côté middleware (non
   * attendue avant l'envoi de la réponse HTTP) — pas garantie visible dès
   * le retour de `call()`. On sonde à intervalles courts plutôt que
   * d'ajouter un délai fixe arbitraire.
   */
  async function waitForAuditLogEntry(
    filter: { table_name: string; action: 'create' | 'update' | 'delete'; record_id?: string; since?: string },
    timeoutMs = 5_000,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs
    let lastError: string | null = null
    while (Date.now() < deadline) {
      let query = admin
        .from('audit_log')
        .select('id')
        .eq('table_name', filter.table_name)
        .eq('action', filter.action)
        .limit(1)
      if (filter.record_id) query = query.eq('record_id', filter.record_id)
      if (filter.since) query = query.gte('created_at', filter.since)

      const { data, error } = await query
      if (error) { lastError = error.message } else if (data && data.length > 0) { return }
      await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error(
      `audit_log : aucune entrée trouvée pour ${JSON.stringify(filter)} après ${timeoutMs}ms` +
      (lastError ? ` (dernière erreur requête : ${lastError})` : ''),
    )
  }

  async function ensureAuthUser(email: string, role: string, nom: string): Promise<string> {
    const { data, error } = await admin.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true, app_metadata: { role }, user_metadata: { nom },
    })
    if (!error && data.user) return data.user.id

    // Déjà créé lors d'un run précédent — le retrouver et remettre role/mdp à jour.
    const { data: list, error: listError } = await admin.auth.admin.listUsers()
    if (listError) throw listError
    const existing = list.users.find((u) => u.email === email)
    if (!existing) throw error ?? new Error(`Utilisateur ${email} introuvable après échec de création`)
    await admin.auth.admin.updateUserById(existing.id, { app_metadata: { role }, password: PASSWORD })
    return existing.id
  }

  async function signIn(email: string): Promise<string> {
    const anon = createClient(TEST_SUPABASE_URL!, TEST_SUPABASE_ANON_KEY!)
    const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD })
    if (error || !data.session) throw error ?? new Error(`Connexion impossible pour ${email}`)
    return data.session.access_token
  }

  beforeAll(async () => {
    process.env.SUPABASE_URL              = TEST_SUPABASE_URL
    process.env.SUPABASE_ANON_KEY         = TEST_SUPABASE_ANON_KEY
    process.env.SUPABASE_SERVICE_ROLE_KEY = TEST_SUPABASE_SERVICE_ROLE_KEY
    process.env.SUPABASE_JWT_SECRET       = '' // projet de test récent = signature asymétrique (JWKS)

    admin = createClient(TEST_SUPABASE_URL!, TEST_SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    app = await loadApp()

    const [staffId, clientId, prestaId] = await Promise.all([
      ensureAuthUser(EMAILS.staff, 'admin', 'Staff Intégration'),
      ensureAuthUser(EMAILS.client, 'apprenant', 'Client Intégration'),
      ensureAuthUser(EMAILS.presta, 'apprenant', 'Presta Intégration'),
    ])
    userIds = { staff: staffId, client: clientId, presta: prestaId }

    // Pas de trigger auth.users → profiles dans ce schéma (Phase 1) : synchro manuelle.
    await Promise.all([
      admin.from('profiles').upsert({ id: staffId, email: EMAILS.staff, nom: 'Staff Intégration', role: 'admin', actif: true }, { onConflict: 'id' }),
      admin.from('profiles').upsert({ id: clientId, email: EMAILS.client, nom: 'Client Intégration', role: 'apprenant', actif: true }, { onConflict: 'id' }),
      admin.from('profiles').upsert({ id: prestaId, email: EMAILS.presta, nom: 'Presta Intégration', role: 'apprenant', actif: true }, { onConflict: 'id' }),
    ])

    tokens = {
      staff:  await signIn(EMAILS.staff),
      client: await signIn(EMAILS.client),
      presta: await signIn(EMAILS.presta),
    }

    // Catégorie de test — pas de POST /api/categories_services (Phase 2 : lecture seule), seed direct.
    const { data: existingCat } = await admin.from('categories_services').select('id').eq('libelle', CATEGORIE_LIBELLE).maybeSingle()
    if (existingCat) {
      categorieId = (existingCat as { id: string }).id
    } else {
      const { data: newCat, error } = await admin.from('categories_services').insert({ libelle: CATEGORIE_LIBELLE, actif: true }).select('id').single()
      if (error) throw error
      categorieId = (newCat as { id: string }).id
    }

    // Fiche client (self-registration via la vraie API, idempotent entre runs).
    const { data: existingClient } = await admin.from('clients').select('id').eq('profile_id', clientId).maybeSingle()
    if (existingClient) {
      clientRowId = (existingClient as { id: string }).id
    } else {
      const res = await call(tokens.client, 'POST', '/api/clients', { nom: 'Client Intégration', telephone: '+237699000001', quartier: 'Bonanjo' })
      if (res.status !== 201) throw new Error(`Setup: POST /api/clients a échoué (${res.status})`)
      clientRowId = ((await res.json()) as { data: { id: string } }).data.id
    }

    // Fiche prestataire (self-registration + activation staff), idempotent, statut forcé actif.
    const { data: existingPresta } = await admin.from('prestataires').select('id, statut').eq('profile_id', prestaId).maybeSingle()
    if (existingPresta) {
      const p = existingPresta as { id: string; statut: string }
      prestataireRowId = p.id
      if (p.statut !== 'actif') {
        const res = await call(tokens.staff, 'PATCH', `/api/prestataires/${prestataireRowId}/statut`, { statut: 'actif' })
        if (res.status !== 200) throw new Error(`Setup: activation prestataire a échoué (${res.status})`)
      }
    } else {
      const res = await call(tokens.presta, 'POST', '/api/prestataires', {
        nom: 'Presta Intégration', telephone: '+237699000002', categories: [categorieId], quartier: 'Bonanjo',
      })
      if (res.status !== 201) throw new Error(`Setup: POST /api/prestataires a échoué (${res.status})`)
      prestataireRowId = ((await res.json()) as { data: { id: string } }).data.id

      const activateRes = await call(tokens.staff, 'PATCH', `/api/prestataires/${prestataireRowId}/statut`, { statut: 'actif' })
      if (activateRes.status !== 200) throw new Error(`Setup: activation prestataire a échoué (${activateRes.status})`)
    }
  }, 30_000)

  afterAll(async () => {
    if (!CONFIGURED) return
    // Nettoie uniquement les données éphémères de ce run — les fixtures
    // (users/profiles/clients/prestataires/catégorie de test) sont
    // conservées, réutilisées et re-vérifiées au prochain run.
    if (createdAvisIds.length)     await admin.from('avis').delete().in('id', createdAvisIds)
    if (createdMatchingIds.length) await admin.from('matchings').delete().in('id', createdMatchingIds)
    if (createdDemandeIds.length)  await admin.from('demandes').delete().in('id', createdDemandeIds)
    const recordIds = [...createdDemandeIds, ...createdMatchingIds, ...createdAvisIds]
    if (recordIds.length) await admin.from('audit_log').delete().in('record_id', recordIds)
  })

  it('le client crée une demande (POST /api/demandes) → visible en base et dans audit_log', async () => {
    const since = isoMinus(2_000)
    const res = await call(tokens.client, 'POST', '/api/demandes', {
      categorie_id: categorieId,
      description:  'Coupe à domicile — test intégration',
      canal:        'web',
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { id: string; statut: string; client_id: string } }
    expect(body.data.statut).toBe('nouvelle')
    expect(body.data.client_id).toBe(clientRowId)
    demandeId = body.data.id
    createdDemandeIds.push(demandeId)

    // Vérifie directement en base — pas seulement la réponse HTTP formatée par l'API.
    const { data: row } = await admin.from('demandes').select('id, statut').eq('id', demandeId).single()
    expect((row as { statut: string }).statut).toBe('nouvelle')

    await waitForAuditLogEntry({ table_name: 'demandes', action: 'create', since })
  })

  it("l'opérateur propose le prestataire (POST /api/matchings) → demande passe en_traitement", async () => {
    const since = isoMinus(2_000)
    const res = await call(tokens.staff, 'POST', '/api/matchings', { demande_id: demandeId, prestataire_id: prestataireRowId })
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { id: string; statut: string } }
    expect(body.data.statut).toBe('propose')
    matchingId = body.data.id
    createdMatchingIds.push(matchingId)

    const { data: demande } = await admin.from('demandes').select('statut').eq('id', demandeId).single()
    expect((demande as { statut: string }).statut).toBe('en_traitement')

    await waitForAuditLogEntry({ table_name: 'matchings', action: 'create', since })
  })

  it("le prestataire accepte puis clôture en 'realise' → demande passe realisee", async () => {
    const acceptRes = await call(tokens.presta, 'PATCH', `/api/matchings/${matchingId}/accepter`, {})
    expect(acceptRes.status).toBe(200)
    await waitForAuditLogEntry({ table_name: 'matchings', action: 'update', record_id: matchingId })

    const sinceCloture = isoMinus(2_000)
    const closeRes = await call(tokens.presta, 'PATCH', `/api/matchings/${matchingId}/cloturer`, { issue: 'realise' })
    expect(closeRes.status).toBe(200)
    const body = await closeRes.json() as { data: { statut: string; closed_at: string | null } }
    expect(body.data.statut).toBe('realise')
    expect(body.data.closed_at).not.toBeNull()

    const { data: demande } = await admin.from('demandes').select('statut').eq('id', demandeId).single()
    expect((demande as { statut: string }).statut).toBe('realisee')

    await waitForAuditLogEntry({ table_name: 'matchings', action: 'update', record_id: matchingId, since: sinceCloture })
  })

  it('le client laisse un avis (POST /api/avis) sur le matching réalisé', async () => {
    const since = isoMinus(2_000)
    const res = await call(tokens.client, 'POST', '/api/avis', {
      matching_id: matchingId, note: 5, commentaire: 'Excellent — test intégration',
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { id: string; note: number } }
    expect(body.data.note).toBe(5)
    avisId = body.data.id
    createdAvisIds.push(avisId)

    const { data: row } = await admin.from('avis').select('id').eq('id', avisId).single()
    expect(row).not.toBeNull()

    await waitForAuditLogEntry({ table_name: 'avis', action: 'create', since })
  })
})
