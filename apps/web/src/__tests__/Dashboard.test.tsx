/**
 * Dashboard.test.tsx
 *
 * Tests d'UI de base sur le Tableau de bord : les compteurs (en retard, à
 * dispatcher, réalisées ce mois, commissions dues, taux de matching réussi)
 * sont calculés à partir des données API — jamais en dur — et la file
 * prioritaire trie en retard avant urgence. Mock de `apiClient` uniquement.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const CATEGORIE_1 = { id: 'cat-1', libelle: 'Plomberie', actif: true }
const CATEGORIE_2 = { id: 'cat-2', libelle: 'Électricité', actif: true }

const PRESTATAIRE_1 = {
  id: 'pre-1', profile_id: 'pp1', nom: 'Plombier Pro', telephone: '+237690000001',
  categories: ['cat-1'], quartier: 'Akwa', geoloc_lat: null, geoloc_lng: null,
  statut: 'actif', note_moyenne: '4.5', taux_commission: null, date_recrutement: null,
}
const PRESTATAIRE_2 = { ...PRESTATAIRE_1, id: 'pre-2', nom: 'Électricien Pro', categories: ['cat-2'] }

const h = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString()
const ilYA = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString()

const debutMoisPlus1h = () => {
  const d = new Date()
  d.setDate(1)
  d.setHours(1, 0, 0, 0)
  return d.toISOString()
}

const DEMANDES = [
  // En retard ET à dispatcher (nouvelle) — doit primer sur l'urgence dans le tri.
  { id: 'dem-dispatch1', client_id: 'cli-1', categorie_id: 'cat-1', description: 'Fuite', localisation: null, canal: 'web', statut: 'nouvelle', created_at: ilYA(2), niveau_urgence: 'urgent', date_souhaitee: null, delai_cible: h(-1) },
  // À dispatcher, urgence plus haute (immediate) mais pas en retard.
  { id: 'dem-dispatch2', client_id: 'cli-1', categorie_id: 'cat-2', description: 'Panne', localisation: null, canal: 'web', statut: 'en_traitement', created_at: ilYA(1), niveau_urgence: 'immediate', date_souhaitee: null, delai_cible: h(5) },
  // Matchée et en retard (ne compte pas dans "à dispatcher").
  { id: 'dem-retard', client_id: 'cli-1', categorie_id: 'cat-1', description: 'Chauffe-eau', localisation: null, canal: 'web', statut: 'matchee', created_at: ilYA(3), niveau_urgence: 'urgent', date_souhaitee: null, delai_cible: h(-2) },
  // Réalisée ce mois-ci.
  { id: 'dem-realisee-mois', client_id: 'cli-1', categorie_id: 'cat-1', description: 'Robinet', localisation: null, canal: 'web', statut: 'realisee', created_at: ilYA(10), niveau_urgence: 'planifie', date_souhaitee: null, delai_cible: null },
  { id: 'dem-realisee-mois2', client_id: 'cli-1', categorie_id: 'cat-1', description: 'Joint', localisation: null, canal: 'web', statut: 'realisee', created_at: ilYA(9), niveau_urgence: 'planifie', date_souhaitee: null, delai_cible: null },
  // Réalisée il y a 2 mois — ne compte pas dans "réalisées ce mois".
  { id: 'dem-realisee-avant', client_id: 'cli-1', categorie_id: 'cat-2', description: 'Prise', localisation: null, canal: 'web', statut: 'realisee', created_at: ilYA(70), niveau_urgence: 'planifie', date_souhaitee: null, delai_cible: null },
  // Échouée (pour le taux de matching réussi).
  { id: 'dem-echec', client_id: 'cli-1', categorie_id: 'cat-1', description: 'Câblage', localisation: null, canal: 'web', statut: 'annulee', created_at: ilYA(15), niveau_urgence: 'planifie', date_souhaitee: null, delai_cible: null },
]

const MATCHINGS = [
  { id: 'match-realise-mois', demande_id: 'dem-realisee-mois', prestataire_id: 'pre-1', operateur_id: 'op-1', statut: 'realise', motif_echec: null, proposed_at: ilYA(10), closed_at: debutMoisPlus1h() },
  { id: 'match-realise-mois2', demande_id: 'dem-realisee-mois2', prestataire_id: 'pre-1', operateur_id: 'op-1', statut: 'realise', motif_echec: null, proposed_at: ilYA(9), closed_at: debutMoisPlus1h() },
  { id: 'match-realise-avant', demande_id: 'dem-realisee-avant', prestataire_id: 'pre-2', operateur_id: 'op-1', statut: 'realise', motif_echec: null, proposed_at: ilYA(70), closed_at: ilYA(69) },
  { id: 'match-echec', demande_id: 'dem-echec', prestataire_id: 'pre-1', operateur_id: 'op-1', statut: 'echoue', motif_echec: 'Injoignable', proposed_at: ilYA(15), closed_at: ilYA(14) },
]

const INTERVENTIONS = [
  { id: 'interv-due', matching_id: 'match-realise-mois', statut: 'realisee', date_planifiee: null, creneau_fin: null, date_debut: null, date_fin: null, checkin_at: null, checkout_at: null, localisation_checkin: null, preuve: null, created_at: '', updated_at: '' },
]

const TRANSACTIONS = [
  { id: 'tx-1', matching_id: 'match-realise-mois', montant_service: 10_000, commission_taux: '15.00', commission_montant: 1_500, statut_paiement: 'en_attente', ref_notchpay: null, created_at: '' },
]

const REVERSEMENTS = [
  { id: 'rev-1', prestataire_id: 'pre-1', montant: 0, statut: 'en_attente', ref: 'intervention:interv-due', date_paiement: null, created_at: '' },
]

const apiGet = vi.fn(async (path: string) => {
  if (path.startsWith('/api/categories_services')) return { data: [CATEGORIE_1, CATEGORIE_2] }
  if (path.startsWith('/api/prestataires')) return { data: [PRESTATAIRE_1, PRESTATAIRE_2] }
  if (path.startsWith('/api/demandes')) return { data: DEMANDES }
  if (path.startsWith('/api/matchings')) return { data: MATCHINGS }
  if (path.startsWith('/api/interventions')) return { data: INTERVENTIONS }
  if (path.startsWith('/api/transactions')) return { data: TRANSACTIONS }
  if (path.startsWith('/api/reversements')) return { data: REVERSEMENTS }
  throw new Error(`GET non mocké: ${path}`)
})

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: (path: string) => apiGet(path) },
  setApiToken: vi.fn(),
}))

import Dashboard from '@/pages/Dashboard'

function renderComponent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Dashboard — KPI réels, file prioritaire, classements', () => {
  beforeEach(() => {
    apiGet.mockClear()
  })

  afterEach(() => cleanup())

  it('affiche les compteurs en retard / à dispatcher / réalisées ce mois', async () => {
    renderComponent()

    const kpiRetard = screen.getByText('Demandes en retard').closest('.panel') as HTMLElement
    expect(await within(kpiRetard).findByText('2')).toBeInTheDocument()

    const kpiDispatch = screen.getByText('À dispatcher').closest('.panel') as HTMLElement
    expect(await within(kpiDispatch).findByText('2')).toBeInTheDocument()

    const kpiMois = screen.getByText('Réalisées ce mois').closest('.panel') as HTMLElement
    expect(await within(kpiMois).findByText('2')).toBeInTheDocument()
  })

  it('calcule les commissions dues et le montant à reverser via la transaction liée', async () => {
    renderComponent()

    const kpiCommissions = screen.getByText('Commissions dues').closest('.panel') as HTMLElement
    expect(await within(kpiCommissions).findByText(/1\s500\sFCFA/)).toBeInTheDocument()
    expect(within(kpiCommissions).getByText(/8\s500\sFCFA/)).toBeInTheDocument()
  })

  it('calcule le taux de matching réussi (réalisé / clôturés)', async () => {
    renderComponent()

    // 3 réalisés, 1 échoué → 75 %.
    const kpiTaux = screen.getByText('Taux de matching réussi').closest('.panel') as HTMLElement
    expect(await within(kpiTaux).findByText('75 %')).toBeInTheDocument()
  })

  it('trie la file prioritaire : en retard prime sur le niveau d\'urgence', async () => {
    renderComponent()
    await screen.findByText('Urgent')

    const lignes = screen.getAllByRole('row')
    const lignesDonnees = lignes.filter((r) => within(r).queryByText(/Urgent|Immédiate/))

    expect(lignesDonnees).toHaveLength(2)
    expect(within(lignesDonnees[0]).getByText('Urgent')).toBeInTheDocument()
    expect(within(lignesDonnees[1]).getByText('Immédiate')).toBeInTheDocument()
  })

  it('classe les top catégories et top prestataires par nombre décroissant', async () => {
    renderComponent()

    const catSection = screen.getByText('Top catégories').closest('.panel') as HTMLElement
    const catItems = await within(catSection).findAllByRole('listitem')
    expect(catItems[0]).toHaveTextContent('Plomberie')
    expect(catItems[0]).toHaveTextContent('5')

    const prestSection = screen.getByText('Top prestataires (missions réalisées)').closest('.panel') as HTMLElement
    const prestItems = await within(prestSection).findAllByRole('listitem')
    expect(prestItems[0]).toHaveTextContent('Plombier Pro')
    expect(prestItems[0]).toHaveTextContent('2')
  })
})
