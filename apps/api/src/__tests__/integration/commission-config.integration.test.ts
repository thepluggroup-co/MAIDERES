/**
 * commission-config.integration.test.ts
 *
 * VRAI test d'intégration — aucun mock. Exécuté contre la même instance
 * Supabase de TEST que marketplace-flow.integration.test.ts (voir README
 * § "Tests d'intégration"). Ignoré automatiquement si TEST_SUPABASE_URL /
 * TEST_SUPABASE_SERVICE_ROLE_KEY ne sont pas définies.
 *
 * Cible public.calculer_commission() et le trigger
 * trg_transactions_commission (packages/db/drizzle/0011_commission_calculee.sql) :
 *
 *   1. Les 3 cas de résolution, dans l'ordre documenté sur la fonction —
 *      override prestataire > règle de catégorie > règle globale. Appelés
 *      directement en RPC (pas de mock possible : la logique vit en SQL,
 *      cf. la docstring de commission.service.ts — ce serait une seconde
 *      source de vérité si on la réimplémentait en JS pour la tester).
 *   2. Le câblage sur transactions : un INSERT direct (service role, comme
 *      intervention-sync.integration.test.ts) déclenche le vrai trigger, qui
 *      doit alimenter commission_taux/commission_montant — jamais une
 *      constante fournie par l'appelant.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const TEST_SUPABASE_URL              = process.env.TEST_SUPABASE_URL
const TEST_SUPABASE_SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY

const CONFIGURED = Boolean(TEST_SUPABASE_URL && TEST_SUPABASE_SERVICE_ROLE_KEY)

if (!CONFIGURED) {
  console.warn(
    '[integration] TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_ROLE_KEY ' +
    "non définies — tests d'intégration ignorés (voir README § Tests d'intégration).",
  )
}

const CATEGORIE_LIBELLE  = '__integration_test__ Commission'
const PRESTA_EMAIL       = 'integration-commission-presta@maideres-test.cm'
const CLIENT_PROFILE_EMAIL = 'integration-commission-client@maideres-test.cm'

type Row = Record<string, unknown>

describe.skipIf(!CONFIGURED)('calculer_commission — 3 cas de résolution + câblage transactions (Supabase de test)', () => {
  let admin: SupabaseClient
  let categorieId: string
  let prestataireId: string
  let profileId: string
  let clientId: string

  const createdConfigIds: string[] = []
  const createdDemandeIds: string[] = []
  const createdMatchingIds: string[] = []
  const createdTransactionIds: string[] = []

  beforeAll(async () => {
    admin = createClient(TEST_SUPABASE_URL!, TEST_SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: existingCat } = await admin
      .from('categories_services').select('id').eq('libelle', CATEGORIE_LIBELLE).maybeSingle()
    if (existingCat) {
      categorieId = (existingCat as Row).id as string
    } else {
      const { data, error } = await admin
        .from('categories_services').insert({ libelle: CATEGORIE_LIBELLE, actif: true }).select('id').single()
      if (error) throw error
      categorieId = (data as Row).id as string
    }

    // profiles.id n'a pas de FK vers auth.users en base (voir 0000) — pas
    // besoin d'un vrai utilisateur Auth pour ce test, qui n'appelle aucune
    // route HTTP protégée.
    const { data: existingProfile } = await admin
      .from('profiles').select('id').eq('email', PRESTA_EMAIL).maybeSingle()
    if (existingProfile) {
      profileId = (existingProfile as Row).id as string
    } else {
      const { data, error } = await admin
        .from('profiles').insert({ id: randomUUID(), email: PRESTA_EMAIL, nom: 'Presta Commission Intégration', role: 'apprenant' })
        .select('id').single()
      if (error) throw error
      profileId = (data as Row).id as string
    }

    const { data: existingPresta } = await admin
      .from('prestataires').select('id').eq('profile_id', profileId).maybeSingle()
    if (existingPresta) {
      prestataireId = (existingPresta as Row).id as string
      // Repart d'un état neutre (pas d'override) avant chaque run.
      await admin.from('prestataires').update({ taux_commission: null }).eq('id', prestataireId)
    } else {
      const { data, error } = await admin
        .from('prestataires')
        .insert({
          profile_id: profileId, nom: 'Presta Commission Intégration', telephone: '+237699000099',
          categories: [categorieId], statut: 'actif',
        })
        .select('id').single()
      if (error) throw error
      prestataireId = (data as Row).id as string
    }

    // Fiche client factice — sert uniquement de FK pour la demande du test
    // de câblage sur transactions, aucune route HTTP n'est appelée dessus.
    const { data: existingClientProfile } = await admin
      .from('profiles').select('id').eq('email', CLIENT_PROFILE_EMAIL).maybeSingle()
    const clientProfileId = existingClientProfile
      ? ((existingClientProfile as Row).id as string)
      : ((await admin.from('profiles').insert({ id: randomUUID(), email: CLIENT_PROFILE_EMAIL, nom: 'Client Commission Intégration', role: 'apprenant' }).select('id').single()).data as Row).id as string

    const { data: existingClient } = await admin
      .from('clients').select('id').eq('profile_id', clientProfileId).maybeSingle()
    if (existingClient) {
      clientId = (existingClient as Row).id as string
    } else {
      const { data, error } = await admin
        .from('clients').insert({ profile_id: clientProfileId, nom: 'Client Commission Intégration', telephone: '+237699000098' })
        .select('id').single()
      if (error) throw error
      clientId = (data as Row).id as string
    }

    // Désactive toute règle de catégorie résiduelle d'un run précédent.
    await admin.from('commission_config').update({ actif: false }).eq('categorie_id', categorieId)
  }, 30_000)

  afterAll(async () => {
    if (!CONFIGURED) return
    if (createdTransactionIds.length) await admin.from('transactions').delete().in('id', createdTransactionIds)
    if (createdMatchingIds.length)    await admin.from('matchings').delete().in('id', createdMatchingIds)
    if (createdDemandeIds.length)     await admin.from('demandes').delete().in('id', createdDemandeIds)
    if (createdConfigIds.length)      await admin.from('commission_config').delete().in('id', createdConfigIds)
  })

  async function rpcCommission(montant: number, categorie: string | null, prestataire: string | null): Promise<number> {
    const { data, error } = await admin.rpc('calculer_commission', {
      _montant: montant, _categorie_id: categorie, _prestataire_id: prestataire,
    })
    if (error) throw error
    return data as number
  }

  it('(c) aucune règle de catégorie, aucun override → retombe sur la règle globale', async () => {
    // La règle globale par défaut (15 %, seedée en 0011) doit toujours exister.
    const { data: globalRule } = await admin
      .from('commission_config').select('type, valeur').is('categorie_id', null).eq('actif', true)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    expect(globalRule).not.toBeNull()
    const { type, valeur } = globalRule as { type: string; valeur: string }
    expect(type).toBe('pourcentage')

    const commission = await rpcCommission(10_000, categorieId, null)
    expect(commission).toBe(Math.round(10_000 * Number(valeur) / 100))
  })

  it('(b) règle de catégorie active → prime sur la règle globale', async () => {
    const { data, error } = await admin
      .from('commission_config')
      .insert({ categorie_id: categorieId, type: 'pourcentage', valeur: 20, actif: true })
      .select('id').single()
    if (error) throw error
    createdConfigIds.push((data as Row).id as string)

    const commission = await rpcCommission(10_000, categorieId, null)
    expect(commission).toBe(2_000) // 20 % de 10 000
  })

  it('(a) override prestataire → prime sur la règle de catégorie ET sur la règle globale', async () => {
    await admin.from('prestataires').update({ taux_commission: '7.50' }).eq('id', prestataireId)

    const commission = await rpcCommission(10_000, categorieId, prestataireId)
    expect(commission).toBe(750) // 7.5 % de 10 000, pas les 20 % de la catégorie

    await admin.from('prestataires').update({ taux_commission: null }).eq('id', prestataireId)
  })

  it('montant nul ou négatif → 0, sans erreur', async () => {
    expect(await rpcCommission(0, categorieId, null)).toBe(0)
    expect(await rpcCommission(-500, categorieId, null)).toBe(0)
  })

  it("trg_transactions_commission alimente commission_taux/commission_montant à l'INSERT, jamais une constante fournie", async () => {
    // Règle de catégorie encore active depuis le test (b) : 20 %. Aucun
    // override prestataire (nettoyé à la fin du test précédent).
    const { data: demande, error: demandeError } = await admin
      .from('demandes')
      .insert({ client_id: clientId, categorie_id: categorieId, description: 'Test commission', canal: 'manuel', statut: 'realisee' })
      .select('id').single()
    if (demandeError) throw demandeError
    const demandeId = (demande as Row).id as string
    createdDemandeIds.push(demandeId)

    const { data: matching, error: matchingError } = await admin
      .from('matchings')
      .insert({
        demande_id: demandeId, prestataire_id: prestataireId, statut: 'realise',
        proposed_at: new Date().toISOString(), closed_at: new Date().toISOString(),
      })
      .select('id').single()
    if (matchingError) throw matchingError
    const matchingId = (matching as Row).id as string
    createdMatchingIds.push(matchingId)

    const { data: transaction, error: transactionError } = await admin
      .from('transactions')
      .insert({ matching_id: matchingId, montant_service: 10_000 })
      .select('id, commission_taux, commission_montant')
      .single()
    if (transactionError) throw transactionError

    const row = transaction as { id: string; commission_taux: string; commission_montant: number }
    createdTransactionIds.push(row.id)

    expect(row.commission_montant).toBe(2_000) // 20 % — la règle de catégorie, pas un défaut à 0
    expect(Number(row.commission_taux)).toBe(20)
  })
})
