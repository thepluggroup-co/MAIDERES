/**
 * Dispatch.test.tsx
 *
 * Tests d'UI de base sur le module Dispatch : tri de la file (en retard
 * d'abord, puis urgence immediate > urgent > planifie, puis ancienneté),
 * prestataires pertinents pour une demande sélectionnée, proposition d'un
 * matching, et enregistrement de l'issue (realise/echoue + motif_echec) sur
 * une affectation acceptée. Mock de `apiClient` uniquement.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const CATEGORIE = { id: 'cat-1', libelle: 'Coiffure', actif: true }
const CLIENT_A = { id: 'cli-1', profile_id: 'p1', nom: 'Client Akwa', telephone: '+237691000001', quartier: 'Akwa', type_client: 'particulier', niu: null, whatsapp: null, email: null, source: 'whatsapp' }
const PRESTATAIRE = {
  id: 'pre-1', profile_id: 'pp1', nom: 'Aïcha Mballa', telephone: '+237690000001',
  categories: ['cat-1'], quartier: 'Akwa', geoloc_lat: null, geoloc_lng: null,
  statut: 'actif', note_moyenne: '4.50', taux_commission: null, date_recrutement: null,
}

const h = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString()

let demandes: any[]
let matchings: any[]

// Ordre attendu après tri : en retard d'abord, puis urgence, puis ancienneté
// (created_at le plus ancien en premier au sein d'un même palier).
function seedDemandes() {
  return [
    // Pas en retard, urgent, créée il y a 2h — la plus récente des "urgent".
    { id: 'dem-urgent-recent0', client_id: 'cli-1', categorie_id: 'cat-1', description: 'Urgent récent', localisation: null, canal: 'web', statut: 'nouvelle', created_at: h(-2), niveau_urgence: 'urgent', date_souhaitee: null, delai_cible: h(10) },
    // En retard, urgent — doit passer devant tout ce qui n'est pas en retard.
    { id: 'dem-retard-urgent0', client_id: 'cli-1', categorie_id: 'cat-1', description: 'Urgent en retard', localisation: null, canal: 'web', statut: 'nouvelle', created_at: h(-20), niveau_urgence: 'urgent', date_souhaitee: null, delai_cible: h(-1) },
    // Pas en retard, immediate — doit passer devant "urgent récent" (urgence plus haute) mais après les deux en retard.
    { id: 'dem-immediate-ok00', client_id: 'cli-1', categorie_id: 'cat-1', description: 'Immédiate à temps', localisation: null, canal: 'web', statut: 'en_traitement', created_at: h(-1), niveau_urgence: 'immediate', date_souhaitee: null, delai_cible: h(1) },
    // En retard, immediate — doit être en tête (retard + urgence la plus haute).
    { id: 'dem-retard-immed00', client_id: 'cli-1', categorie_id: 'cat-1', description: 'Immédiate en retard', localisation: null, canal: 'web', statut: 'nouvelle', created_at: h(-15), niveau_urgence: 'immediate', date_souhaitee: null, delai_cible: h(-3) },
  ]
}

function resetState() {
  demandes = seedDemandes()
  matchings = []
}

const apiGet = vi.fn(async (path: string) => {
  if (path.startsWith('/api/categories_services')) return { data: [CATEGORIE] }
  if (path.startsWith('/api/clients')) return { data: [CLIENT_A] }
  if (path.startsWith('/api/prestataires')) return { data: [PRESTATAIRE] }
  if (path.startsWith('/api/demandes')) return { data: demandes }
  if (path.startsWith('/api/matchings')) {
    const url = new URL(`http://x${path}`)
    const demandeId = url.searchParams.get('demande_id')
    return { data: demandeId ? matchings.filter((m) => m.demande_id === demandeId) : matchings }
  }
  throw new Error(`GET non mocké: ${path}`)
})

const apiPost = vi.fn(async (path: string, body: any) => {
  if (path === '/api/matchings') {
    const row = {
      id: `match-${matchings.length + 1}`, demande_id: body.demande_id, prestataire_id: body.prestataire_id,
      operateur_id: 'op-1', statut: 'accepte', // simule l'acceptation immédiate du prestataire pour exercer la clôture
      motif_echec: null, proposed_at: new Date().toISOString(), closed_at: null,
    }
    matchings.push(row)
    const d = demandes.find((dd) => dd.id === body.demande_id)
    if (d) d.statut = 'matchee'
    return { data: row }
  }
  throw new Error(`POST non mocké: ${path}`)
})

const apiPatch = vi.fn(async (path: string, body: any) => {
  const match = path.match(/^\/api\/matchings\/([^/]+)\/cloturer$/)
  if (match) {
    const m = matchings.find((mm) => mm.id === match[1])
    if (!m) throw new Error('introuvable')
    m.statut = body.issue
    m.motif_echec = body.motif_echec ?? null
    return { data: m }
  }
  throw new Error(`PATCH non mocké: ${path}`)
})

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get:   (path: string) => apiGet(path),
    post:  (path: string, body: unknown) => apiPost(path, body),
    patch: (path: string, body: unknown) => apiPatch(path, body),
  },
  setApiToken: vi.fn(),
}))

import Dispatch from '@/pages/Dispatch'

function renderComponent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Dispatch />
    </QueryClientProvider>,
  )
}

describe('Dispatch — tri de la file, matching, clôture', () => {
  beforeEach(() => {
    resetState()
    apiGet.mockClear()
    apiPost.mockClear()
    apiPatch.mockClear()
  })

  afterEach(() => cleanup())

  it('trie la file : en retard d\'abord, puis urgence, puis ancienneté', async () => {
    renderComponent()
    await screen.findByText('Immédiate en retard')

    const rows = screen.getAllByText(/en retard$|récent$|à temps$/).map((el) => el.textContent)
    expect(rows).toEqual([
      'Immédiate en retard', // en retard + immediate
      'Urgent en retard',    // en retard + urgent
      'Immédiate à temps',   // pas en retard, immediate (plus urgent que "urgent")
      'Urgent récent',       // pas en retard, urgent
    ])
  })

  it('propose un prestataire pertinent pour la demande sélectionnée', async () => {
    const user = userEvent.setup()
    renderComponent()
    await screen.findByText('Immédiate en retard')

    const row = screen.getByText('Immédiate en retard').closest('tr')!
    await user.click(within(row).getByRole('button', { name: /dispatcher/i }))

    await screen.findByText('Aïcha Mballa')
    await user.click(screen.getByRole('button', { name: /proposer/i }))

    await screen.findByText('Aïcha Mballa', { selector: 'td' })
    expect(apiPost).toHaveBeenCalledWith('/api/matchings', {
      demande_id: 'dem-retard-immed00', prestataire_id: 'pre-1',
    })
  })

  it('enregistre l\'issue échouée avec motif sur une affectation acceptée', async () => {
    const user = userEvent.setup()
    matchings.push({
      id: 'match-x', demande_id: 'dem-retard-immed00', prestataire_id: 'pre-1', operateur_id: 'op-1',
      statut: 'accepte', motif_echec: null, proposed_at: new Date().toISOString(), closed_at: null,
    })
    renderComponent()
    await screen.findByText('Affectations en cours (1)')

    const row = screen.getByText('Aïcha Mballa').closest('tr')!
    await user.click(within(row).getByRole('button', { name: /échoué/i }))
    await user.type(within(row).getByPlaceholderText(/motif/i), 'Prestataire injoignable')
    await user.click(within(row).getByRole('button', { name: /enregistrer l'issue/i }))

    expect(apiPatch).toHaveBeenCalledWith('/api/matchings/match-x/cloturer', {
      issue: 'echoue', motif_echec: 'Prestataire injoignable',
    })
  })
})
