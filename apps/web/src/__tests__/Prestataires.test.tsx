/**
 * Prestataires.test.tsx
 *
 * Tests d'UI de base sur le module Prestataires : annuaire filtrable par
 * catégorie + quartier, onboarding, validation de statut (en_attente →
 * actif → suspendu), note_moyenne et commission (override / règle par
 * défaut) visibles. Mock de `apiClient` uniquement.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const CAT_COIFFURE = { id: 'cat-1', libelle: 'Coiffure', actif: true }
const CAT_TAXI      = { id: 'cat-2', libelle: 'Taxi', actif: true }

let prestataires: any[]
const commissionConfig = [
  { id: 'com-1', categorie_id: null, type: 'pourcentage', valeur: '10', actif: true, created_at: new Date().toISOString() },
]

function resetState() {
  prestataires = [
    {
      id: 'pre-1', profile_id: 'p1', nom: 'Aïcha Mballa', telephone: '+237690000001',
      categories: ['cat-1'], quartier: 'Akwa', geoloc_lat: null, geoloc_lng: null,
      statut: 'actif', note_moyenne: '4.50', taux_commission: null, date_recrutement: null,
    },
    {
      id: 'pre-2', profile_id: 'p2', nom: 'Marc Taxi', telephone: '+237690000002',
      categories: ['cat-2'], quartier: 'Bonanjo', geoloc_lat: null, geoloc_lng: null,
      statut: 'actif', note_moyenne: '4.00', taux_commission: '20', date_recrutement: null,
    },
  ]
}

const apiGet = vi.fn(async (path: string) => {
  if (path.startsWith('/api/categories_services')) return { data: [CAT_COIFFURE, CAT_TAXI] }
  if (path.startsWith('/api/commission_config')) return { data: commissionConfig }
  if (path.startsWith('/api/prestataires')) {
    const url = new URL(`http://x${path}`)
    let result = prestataires
    const categorie = url.searchParams.get('categorie')
    const quartier = url.searchParams.get('quartier')
    const statut = url.searchParams.get('statut')
    if (categorie) result = result.filter((p) => p.categories.includes(categorie))
    if (quartier) result = result.filter((p) => p.quartier === quartier)
    if (statut) result = result.filter((p) => p.statut === statut)
    return { data: result }
  }
  throw new Error(`GET non mocké: ${path}`)
})

const apiPost = vi.fn(async (path: string, body: any) => {
  if (path === '/api/prestataires') {
    const row = {
      id: `pre-${prestataires.length + 1}`, profile_id: `p${prestataires.length + 1}`,
      nom: body.nom, telephone: body.telephone, categories: body.categories ?? [],
      quartier: body.quartier ?? null, geoloc_lat: body.geoloc_lat ?? null, geoloc_lng: body.geoloc_lng ?? null,
      statut: 'en_attente', note_moyenne: '0.00', taux_commission: null, date_recrutement: new Date().toISOString(),
    }
    prestataires.push(row)
    return { data: row }
  }
  throw new Error(`POST non mocké: ${path}`)
})

const apiPatch = vi.fn(async (path: string, body: any) => {
  const statutMatch = path.match(/^\/api\/prestataires\/([^/]+)\/statut$/)
  if (statutMatch) {
    const p = prestataires.find((pp) => pp.id === statutMatch[1])
    if (!p) throw new Error('introuvable')
    p.statut = body.statut
    return { data: p }
  }
  const genericMatch = path.match(/^\/api\/prestataires\/([^/]+)$/)
  if (genericMatch) {
    const p = prestataires.find((pp) => pp.id === genericMatch[1])
    if (!p) throw new Error('introuvable')
    if (body.taux_commission !== undefined) p.taux_commission = body.taux_commission === null ? null : String(body.taux_commission)
    return { data: p }
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

import Prestataires from '@/pages/Prestataires'

function renderComponent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Prestataires />
    </QueryClientProvider>,
  )
}

describe('Prestataires — annuaire, onboarding, validation de statut, filtres', () => {
  beforeEach(() => {
    resetState()
    apiGet.mockClear()
    apiPost.mockClear()
    apiPatch.mockClear()
  })

  afterEach(() => cleanup())

  it('affiche la liste avec note moyenne et commission (override / règle par défaut)', async () => {
    renderComponent()
    await screen.findByText('Aïcha Mballa')

    const row1 = screen.getByText('Aïcha Mballa').closest('tr')!
    expect(within(row1).getByText('4.5')).toBeInTheDocument()
    await within(row1).findByText(/10 % \(règle par défaut\)/)

    const row2 = screen.getByText('Marc Taxi').closest('tr')!
    await within(row2).findByText(/20 % \(override\)/)
  })

  it('onboarde un nouveau prestataire', async () => {
    const user = userEvent.setup()
    renderComponent()
    await screen.findByText('Aïcha Mballa')

    const form = screen.getByText('Enregistrer un prestataire').closest('section')!
    await user.type(within(form).getByLabelText(/nom complet/i), 'Nouveau Prestataire')
    await user.type(within(form).getByLabelText(/téléphone/i), '+237690000009')
    await user.click(await within(form).findByRole('button', { name: 'Coiffure' }))
    await user.click(within(form).getByRole('button', { name: /ajouter au réseau/i }))

    await screen.findByText('Nouveau Prestataire')
    expect(apiPost).toHaveBeenCalledWith('/api/prestataires', expect.objectContaining({
      nom: 'Nouveau Prestataire', categories: ['cat-1'],
    }))
    const row = screen.getByText('Nouveau Prestataire').closest('tr')!
    expect(within(row).getByText('En attente')).toBeInTheDocument()
  })

  it('valide le statut en_attente → actif puis suspend', async () => {
    const user = userEvent.setup()
    prestataires.push({
      id: 'pre-3', profile_id: 'p3', nom: 'Candidat Test', telephone: '+237690000003',
      categories: [], quartier: null, geoloc_lat: null, geoloc_lng: null,
      statut: 'en_attente', note_moyenne: '0.00', taux_commission: null, date_recrutement: null,
    })
    renderComponent()
    await screen.findByText('Candidat Test')

    const row = screen.getByText('Candidat Test').closest('tr')!
    await user.click(within(row).getByRole('button', { name: /valider/i }))

    await within(row).findByText('Actif')
    expect(apiPatch).toHaveBeenCalledWith('/api/prestataires/pre-3/statut', { statut: 'actif' })

    await user.click(within(row).getByRole('button', { name: /suspendre/i }))
    await within(row).findByText('Suspendu')
  })

  it('filtre par catégorie', async () => {
    const user = userEvent.setup()
    renderComponent()
    await screen.findByText('Aïcha Mballa')
    expect(screen.getByText('Marc Taxi')).toBeInTheDocument()

    const section = screen.getByText(/^Réseau/).closest('section')!
    const [categorieSelect] = within(section).getAllByRole('combobox')
    await user.selectOptions(categorieSelect, 'cat-1')

    await screen.findByText('Aïcha Mballa')
    expect(screen.queryByText('Marc Taxi')).not.toBeInTheDocument()
  })

  it('filtre par quartier', async () => {
    const user = userEvent.setup()
    renderComponent()
    await screen.findByText('Aïcha Mballa')

    const section = screen.getByText(/^Réseau/).closest('section')!
    const [, quartierSelect] = within(section).getAllByRole('combobox')
    await user.selectOptions(quartierSelect, 'Bonanjo')

    await screen.findByText('Marc Taxi')
    expect(screen.queryByText('Aïcha Mballa')).not.toBeInTheDocument()
  })
})
