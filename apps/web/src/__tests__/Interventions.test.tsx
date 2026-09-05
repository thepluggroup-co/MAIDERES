/**
 * Interventions.test.tsx
 *
 * Tests d'UI de base sur le module Interventions : le board kanban reflète
 * les statuts réels, les badges SLA (retard/à risque/dans les temps, calculés
 * via sla_config — jamais en dur) sont corrects, la timeline affiche les
 * événements horodatés, et le check-in fonctionne. Mock de `apiClient`
 * uniquement.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const CATEGORIE = { id: 'cat-1', libelle: 'Plomberie', actif: true }
const CLIENT = { id: 'cli-1', profile_id: 'p1', nom: 'Client Test', telephone: '+237691000001', quartier: 'Akwa', type_client: 'particulier', niu: null, whatsapp: null, email: null, source: 'whatsapp' }
const PRESTATAIRE = {
  id: 'pre-1', profile_id: 'pp1', nom: 'Plombier Pro', telephone: '+237690000001',
  categories: ['cat-1'], quartier: 'Akwa', geoloc_lat: null, geoloc_lng: null,
  statut: 'actif', note_moyenne: '4.5', taux_commission: null, date_recrutement: null,
}

const SLA_CONFIG = [
  { id: 'sla-1', niveau_urgence: 'immediate', delai_heures: 2, seuil_alerte_heures: 1, created_at: '' },
  { id: 'sla-2', niveau_urgence: 'urgent', delai_heures: 24, seuil_alerte_heures: 12, created_at: '' },
  { id: 'sla-3', niveau_urgence: 'planifie', delai_heures: 72, seuil_alerte_heures: 48, created_at: '' },
]

const h = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString()

// 3 demandes couvrant les 3 états SLA : retard, à risque (dans la fenêtre
// seuil_alerte_heures avant delai_cible), dans les temps.
const demandes = [
  { id: 'dem-retard0', client_id: 'cli-1', categorie_id: 'cat-1', description: 'Fuite urgente', localisation: null, canal: 'web', statut: 'matchee', created_at: h(-30), niveau_urgence: 'urgent', date_souhaitee: null, delai_cible: h(-1) },
  { id: 'dem-risque00', client_id: 'cli-1', categorie_id: 'cat-1', description: 'Robinet à réparer', localisation: null, canal: 'web', statut: 'matchee', created_at: h(-5), niveau_urgence: 'urgent', date_souhaitee: null, delai_cible: h(5) }, // reste 5h <= seuil 12h → alerte
  { id: 'dem-temps000', client_id: 'cli-1', categorie_id: 'cat-1', description: 'Chauffe-eau', localisation: null, canal: 'web', statut: 'matchee', created_at: h(-1), niveau_urgence: 'urgent', date_souhaitee: null, delai_cible: h(20) }, // reste 20h > seuil 12h → ok
]

const matchings = [
  { id: 'match-retard0', demande_id: 'dem-retard0', prestataire_id: 'pre-1', operateur_id: 'op-1', statut: 'accepte', motif_echec: null, proposed_at: h(-29), closed_at: null },
  { id: 'match-risque00', demande_id: 'dem-risque00', prestataire_id: 'pre-1', operateur_id: 'op-1', statut: 'accepte', motif_echec: null, proposed_at: h(-4), closed_at: null },
  { id: 'match-temps000', demande_id: 'dem-temps000', prestataire_id: 'pre-1', operateur_id: 'op-1', statut: 'accepte', motif_echec: null, proposed_at: h(-1), closed_at: null },
]

let interventions: any[]
let evenements: Record<string, any[]>

function resetState() {
  interventions = [
    { id: 'interv-retard0', matching_id: 'match-retard0', statut: 'planifiee', date_planifiee: null, creneau_fin: null, date_debut: null, date_fin: null, checkin_at: null, checkout_at: null, localisation_checkin: null, preuve: null, created_at: h(-29), updated_at: h(-29) },
    { id: 'interv-risque00', matching_id: 'match-risque00', statut: 'en_route', date_planifiee: null, creneau_fin: null, date_debut: null, date_fin: null, checkin_at: null, checkout_at: null, localisation_checkin: null, preuve: null, created_at: h(-4), updated_at: h(-4) },
    { id: 'interv-temps000', matching_id: 'match-temps000', statut: 'sur_site', date_planifiee: null, creneau_fin: null, date_debut: null, date_fin: null, checkin_at: h(-1), checkout_at: null, localisation_checkin: 'Entrée principale', preuve: null, created_at: h(-1), updated_at: h(-1) },
  ]
  evenements = {
    'interv-temps000': [
      { id: 'ev-1', intervention_id: 'interv-temps000', type: 'changement_statut', ancien_statut: 'planifiee', nouveau_statut: 'en_route', commentaire: null, localisation: null, operateur_id: 'op-1', created_at: h(-2) },
      { id: 'ev-2', intervention_id: 'interv-temps000', type: 'checkin', ancien_statut: 'en_route', nouveau_statut: 'sur_site', commentaire: null, localisation: 'Entrée principale', operateur_id: null, created_at: h(-1) },
    ],
  }
}

const apiGet = vi.fn(async (path: string) => {
  if (path.startsWith('/api/categories_services')) return { data: [CATEGORIE] }
  if (path.startsWith('/api/clients')) return { data: [CLIENT] }
  if (path.startsWith('/api/prestataires')) return { data: [PRESTATAIRE] }
  if (path.startsWith('/api/demandes')) return { data: demandes }
  if (path.startsWith('/api/matchings')) return { data: matchings }
  if (path.startsWith('/api/sla_config')) return { data: SLA_CONFIG }
  const evMatch = path.match(/^\/api\/interventions\/([^/]+)\/evenements$/)
  if (evMatch) return { data: evenements[evMatch[1]] ?? [] }
  if (path.startsWith('/api/interventions')) return { data: interventions }
  throw new Error(`GET non mocké: ${path}`)
})

const apiPatch = vi.fn(async (path: string, body: any) => {
  const checkinMatch = path.match(/^\/api\/interventions\/([^/]+)\/checkin$/)
  if (checkinMatch) {
    const i = interventions.find((ii) => ii.id === checkinMatch[1])
    if (!i) throw new Error('introuvable')
    i.checkin_at = new Date().toISOString()
    i.statut = 'sur_site'
    i.localisation_checkin = body.localisation_checkin ?? null
    return { data: i }
  }
  throw new Error(`PATCH non mocké: ${path}`)
})

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get:   (path: string) => apiGet(path),
    patch: (path: string, body: unknown) => apiPatch(path, body),
  },
  setApiToken: vi.fn(),
}))

import Interventions from '@/pages/Interventions'

function renderComponent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Interventions />
    </QueryClientProvider>,
  )
}

describe('Interventions — board kanban, SLA, timeline, check-in', () => {
  beforeEach(() => {
    resetState()
    apiGet.mockClear()
    apiPatch.mockClear()
  })

  afterEach(() => cleanup())

  it('place chaque carte dans la bonne colonne avec le bon badge SLA', async () => {
    renderComponent()
    await screen.findAllByText('Plombier Pro · Client Test')

    const colonnePlanifiee = screen.getByText('Planifiée').closest('.panel') as HTMLElement
    expect(within(colonnePlanifiee).getByText('En retard')).toBeInTheDocument()

    const colonneEnRoute = screen.getByText('En route').closest('.panel') as HTMLElement
    expect(within(colonneEnRoute).getByText('À risque')).toBeInTheDocument()

    const colonneSurSite = screen.getByText('Sur site').closest('.panel') as HTMLElement
    expect(within(colonneSurSite).getByText('Dans les temps')).toBeInTheDocument()
  })

  it('liste les alertes en retard puis à risque en haut de page', async () => {
    renderComponent()
    await screen.findByText('En retard (1)')
    expect(screen.getByText('À risque (1)')).toBeInTheDocument()
  })

  it('affiche la timeline horodatée dans le détail', async () => {
    const user = userEvent.setup()
    renderComponent()
    await screen.findAllByText('Plombier Pro · Client Test')

    const carteSurSite = screen.getByText('Dans les temps').closest('button')!
    await user.click(carteSurSite)

    const sheet = await screen.findByRole('dialog')
    await within(sheet).findByText('Check-in')
    expect(within(sheet).getByText(/Planifiée → En route/)).toBeInTheDocument()
    expect(within(sheet).getByText(/Entrée principale/)).toBeInTheDocument()
  })

  it('enregistre un check-in depuis le détail', async () => {
    const user = userEvent.setup()
    renderComponent()
    await screen.findAllByText('Plombier Pro · Client Test')

    const carteEnRoute = screen.getByText('À risque').closest('button')!
    await user.click(carteEnRoute)

    const sheet = await screen.findByRole('dialog')
    await user.type(within(sheet).getByPlaceholderText(/localisation/i), 'Devant le portail bleu')
    await user.click(within(sheet).getByRole('button', { name: /^check-in$/i }))

    expect(apiPatch).toHaveBeenCalledWith('/api/interventions/interv-risque00/checkin', {
      localisation_checkin: 'Devant le portail bleu',
    })
  })
})
