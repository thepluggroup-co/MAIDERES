/**
 * intervention-sync.integration.test.ts
 *
 * VRAI test d'intégration — aucun mock. Exécuté contre la même instance
 * Supabase de TEST que marketplace-flow.integration.test.ts (voir README
 * § "Tests d'intégration"). Ignoré automatiquement si TEST_SUPABASE_URL /
 * TEST_SUPABASE_ANON_KEY / TEST_SUPABASE_SERVICE_ROLE_KEY ne sont pas
 * définies.
 *
 * Cible le trigger public.sync_intervention_statut() (packages/db/drizzle/
 * 0009_intervention_sync.sql) : aucune route API n'existe encore pour
 * `interventions` (hors périmètre de cette tâche — pas d'app prestataire),
 * donc les écritures se font directement via le client service-role, qui
 * déclenche le VRAI trigger Postgres — c'est justement ce qu'un mock ne
 * peut pas simuler.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const TEST_SUPABASE_URL              = process.env.TEST_SUPABASE_URL
const TEST_SUPABASE_SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY

const CONFIGURED = Boolean(TEST_SUPABASE_URL && TEST_SUPABASE_SERVICE_ROLE_KEY)

if (!CONFIGURED) {
  console.warn(
    '[integration] TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_ROLE_KEY ' +
    "non définies — tests d'intégration ignorés (voir README § Tests d'intégration).",
  )
}

const CATEGORIE_LIBELLE = '__integration_test__ Suivi terrain'
const PRESTA_EMAIL = 'integration-intervention-presta@maideres-test.cm'
const CLIENT_EMAIL = 'integration-intervention-client@maideres-test.cm'
const PASSWORD = 'Integration-Test-Passw0rd!'

type Row = Record<string, unknown>

describe.skipIf(!CONFIGURED)('Trigger sync_intervention_statut (Supabase de test)', () => {
  let admin: SupabaseClient
  let categorieId: string
  let clientRowId: string
  let prestataireRowId: string

  const createdDemandeIds: string[] = []
  const createdMatchingIds: string[] = []
  const createdInterventionIds: string[] = []

  async function ensureAuthUser(email: string, nom: string): Promise<string> {
    const { data, error } = await admin.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true, app_metadata: { role: 'apprenant' }, user_metadata: { nom },
    })
    if (!error && data.user) return data.user.id
    const { data: list, error: listError } = await admin.auth.admin.listUsers()
    if (listError) throw listError
    const existing = list.users.find((u) => u.email === email)
    if (!existing) throw error ?? new Error(`Utilisateur ${email} introuvable après échec de création`)
    return existing.id
  }

  /** Crée une demande + un matching frais (état minimal, écriture directe — pas de dépendance à l'API). */
  async function creerDemandeEtMatching(): Promise<{ demandeId: string; matchingId: string }> {
    const { data: demande, error: demandeError } = await admin
      .from('demandes')
      .insert({ client_id: clientRowId, categorie_id: categorieId, description: 'Test intervention', canal: 'manuel', statut: 'matchee' })
      .select('id').single()
    if (demandeError) throw demandeError
    const demandeId = (demande as Row).id as string
    createdDemandeIds.push(demandeId)

    const { data: matching, error: matchingError } = await admin
      .from('matchings')
      .insert({ demande_id: demandeId, prestataire_id: prestataireRowId, statut: 'accepte', proposed_at: new Date().toISOString() })
      .select('id').single()
    if (matchingError) throw matchingError
    const matchingId = (matching as Row).id as string
    createdMatchingIds.push(matchingId)

    return { demandeId, matchingId }
  }

  async function creerIntervention(matchingId: string): Promise<string> {
    const { data, error } = await admin
      .from('interventions')
      .insert({ matching_id: matchingId, statut: 'planifiee' })
      .select('id').single()
    if (error) throw error
    const id = (data as Row).id as string
    createdInterventionIds.push(id)
    return id
  }

  async function evenements(interventionId: string) {
    const { data, error } = await admin
      .from('intervention_evenements')
      .select('type, ancien_statut, nouveau_statut')
      .eq('intervention_id', interventionId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data as Row[]
  }

  async function demandeStatut(demandeId: string): Promise<string> {
    const { data, error } = await admin.from('demandes').select('statut').eq('id', demandeId).single()
    if (error) throw error
    return (data as Row).statut as string
  }

  beforeAll(async () => {
    admin = createClient(TEST_SUPABASE_URL!, TEST_SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const [clientUserId, prestaUserId] = await Promise.all([
      ensureAuthUser(CLIENT_EMAIL, 'Client Intervention Test'),
      ensureAuthUser(PRESTA_EMAIL, 'Presta Intervention Test'),
    ])

    await Promise.all([
      admin.from('profiles').upsert({ id: clientUserId, email: CLIENT_EMAIL, nom: 'Client Intervention Test', role: 'apprenant', actif: true }, { onConflict: 'id' }),
      admin.from('profiles').upsert({ id: prestaUserId, email: PRESTA_EMAIL, nom: 'Presta Intervention Test', role: 'apprenant', actif: true }, { onConflict: 'id' }),
    ])

    const { data: existingCat } = await admin.from('categories_services').select('id').eq('libelle', CATEGORIE_LIBELLE).maybeSingle()
    if (existingCat) {
      categorieId = (existingCat as Row).id as string
    } else {
      const { data, error } = await admin.from('categories_services').insert({ libelle: CATEGORIE_LIBELLE, actif: true }).select('id').single()
      if (error) throw error
      categorieId = (data as Row).id as string
    }

    const { data: existingClient } = await admin.from('clients').select('id').eq('profile_id', clientUserId).maybeSingle()
    if (existingClient) {
      clientRowId = (existingClient as Row).id as string
    } else {
      const { data, error } = await admin.from('clients').insert({ profile_id: clientUserId, nom: 'Client Intervention Test', telephone: '+237699100001' }).select('id').single()
      if (error) throw error
      clientRowId = (data as Row).id as string
    }

    const { data: existingPresta } = await admin.from('prestataires').select('id').eq('profile_id', prestaUserId).maybeSingle()
    if (existingPresta) {
      prestataireRowId = (existingPresta as Row).id as string
      await admin.from('prestataires').update({ statut: 'actif' }).eq('id', prestataireRowId)
    } else {
      const { data, error } = await admin
        .from('prestataires')
        .insert({ profile_id: prestaUserId, nom: 'Presta Intervention Test', telephone: '+237699100002', categories: [categorieId], statut: 'actif' })
        .select('id').single()
      if (error) throw error
      prestataireRowId = (data as Row).id as string
    }
  }, 30_000)

  afterAll(async () => {
    if (!CONFIGURED) return
    if (createdInterventionIds.length) {
      await admin.from('intervention_evenements').delete().in('intervention_id', createdInterventionIds)
      await admin.from('reversements').delete().like('ref', 'intervention:%').in('ref', createdInterventionIds.map((id) => `intervention:${id}`))
      await admin.from('interventions').delete().in('id', createdInterventionIds)
    }
    if (createdMatchingIds.length) await admin.from('matchings').delete().in('id', createdMatchingIds)
    if (createdDemandeIds.length)  await admin.from('demandes').delete().in('id', createdDemandeIds)
  })

  describe('cycle de vie complet — planifiee → en_route → checkin → checkout → realisee', () => {
    let interventionId: string
    let demandeId: string

    it('création : statut planifiee, aucun événement journalisé', async () => {
      const { demandeId: d, matchingId } = await creerDemandeEtMatching()
      demandeId = d
      interventionId = await creerIntervention(matchingId)

      const rows = await evenements(interventionId)
      expect(rows).toHaveLength(0) // pas de log à la création — seulement sur UPDATE (cf. migration 0009)
    })

    it('planifiee → en_route : un seul événement changement_statut, demande passe en_cours', async () => {
      const { error } = await admin.from('interventions').update({ statut: 'en_route' }).eq('id', interventionId)
      expect(error).toBeNull()

      const rows = await evenements(interventionId)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ type: 'changement_statut', ancien_statut: 'planifiee', nouveau_statut: 'en_route' })

      expect(await demandeStatut(demandeId)).toBe('en_cours')
    })

    it('check-in : force statut=sur_site, horodate checkin_at, journalise un seul événement de type checkin (pas de doublon)', async () => {
      const { data, error } = await admin
        .from('interventions')
        .update({ checkin_at: new Date().toISOString(), localisation_checkin: 'Devant le portail bleu, Bonanjo' })
        .eq('id', interventionId)
        .select('statut, checkin_at')
        .single()
      expect(error).toBeNull()
      expect((data as Row).statut).toBe('sur_site')
      expect((data as Row).checkin_at).not.toBeNull()

      const rows = await evenements(interventionId)
      // 1 événement de la transition précédente (en_route) + exactement 1 nouveau (checkin) — jamais 2 pour ce check-in.
      expect(rows).toHaveLength(2)
      expect(rows[1]).toMatchObject({ type: 'checkin', ancien_statut: 'en_route', nouveau_statut: 'sur_site' })

      expect(await demandeStatut(demandeId)).toBe('en_cours')
    })

    it("check-out : horodate checkout_at, journalise un événement checkout, ne force aucun changement de statut", async () => {
      const { data, error } = await admin
        .from('interventions')
        .update({ checkout_at: new Date().toISOString() })
        .eq('id', interventionId)
        .select('statut, checkout_at')
        .single()
      expect(error).toBeNull()
      expect((data as Row).statut).toBe('sur_site') // inchangé par le check-out
      expect((data as Row).checkout_at).not.toBeNull()

      const rows = await evenements(interventionId)
      expect(rows).toHaveLength(3)
      expect(rows[2]).toMatchObject({ type: 'checkout' })
    })

    it('→ realisee : demande passe realisee et un reversement en_attente est créé', async () => {
      const { error } = await admin.from('interventions').update({ statut: 'realisee' }).eq('id', interventionId)
      expect(error).toBeNull()

      const rows = await evenements(interventionId)
      expect(rows).toHaveLength(4)
      expect(rows[3]).toMatchObject({ type: 'changement_statut', ancien_statut: 'sur_site', nouveau_statut: 'realisee' })

      expect(await demandeStatut(demandeId)).toBe('realisee')

      const { data: reversement, error: revError } = await admin
        .from('reversements')
        .select('statut, montant, prestataire_id')
        .eq('ref', `intervention:${interventionId}`)
        .single()
      expect(revError).toBeNull()
      expect(reversement).toMatchObject({ statut: 'en_attente', prestataire_id: prestataireRowId })
      // Montant placeholder — le calcul réel de commission arrive en Phase 5 (cf. commentaire migration 0009).
      expect((reversement as Row).montant).toBe(0)
    })
  })

  it("echouee synchronise demande.statut = annulee (branche séparée du cycle 'realisee')", async () => {
    const { demandeId, matchingId } = await creerDemandeEtMatching()
    const interventionId = await creerIntervention(matchingId)

    const { error } = await admin.from('interventions').update({ statut: 'echouee' }).eq('id', interventionId)
    expect(error).toBeNull()

    expect(await demandeStatut(demandeId)).toBe('annulee')

    const rows = await evenements(interventionId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'changement_statut', ancien_statut: 'planifiee', nouveau_statut: 'echouee' })
  })

  it("un UPDATE qui ne touche ni statut ni checkin_at ni checkout_at (ex. `preuve`) ne journalise rien", async () => {
    const { demandeId: _demandeId, matchingId } = await creerDemandeEtMatching()
    const interventionId = await creerIntervention(matchingId)

    const { error } = await admin.from('interventions').update({ preuve: 'photo-avant.jpg' }).eq('id', interventionId)
    expect(error).toBeNull()

    const rows = await evenements(interventionId)
    expect(rows).toHaveLength(0)
  })
})
