/**
 * Demandes.test.tsx
 *
 * Tests d'UI de base sur le module Demandes : liste + saisie rapide (client,
 * catégorie, description, localisation, canal, niveau_urgence, date_souhaitee
 * si planifié), calcul du délai cible côté API (jamais côté front), badge
 * rouge "en retard", filtres catégorie/quartier/statut/canal/urgence.
 * Mock de `apiClient` uniquement.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const CAT_COIFFURE = { id: 'cat-1', libelle: 'Coiffure', actif: true }
const CAT_TAXI = { id: 'cat-2', libelle: 'Taxi', actif: true }
const CLIENT_AKWA = { id: 'cli-1', profile_id: 'p1', nom: 'Paul Ndongo', telephone: '+237691000001', quartier: 'Akwa', type_client: 'particulier', niu: null, whatsapp: null, email: null, source: 'whatsapp' }
const CLIENT_BONANJO = { id: 'cli-2', profile_id: 'p2', nom: 'Marie Essomba', telephone: '+237691000002', quartier: 'Bonanjo', type_client: 'particulier', niu: null, whatsapp: null, email: null, source: 'appel' }

let demandes: any[]

function resetState() {
  demandes = [
    {
      id: 'dem-en-retard-000', client_id: 'cli-1', categorie_id: 'cat-1',
      description: 'Coupe à domicile', localisation: 'Akwa', canal: 'web', statut: 'nouvelle',
      created_at: new Date(Date.now() - 30 * 3_600_000).toISOString(),
      niveau_urgence: 'urgent', date_souhaitee: null,
      delai_cible: new Date(Date.now() - 5 * 3_600_000).toISOString(), // dépassé
    },
    {
      id: 'dem-a-temps-000000', client_id: 'cli-2', categorie_id: 'cat-2',
      description: 'Course aéroport', localisation: 'Bonanjo', canal: 'whatsapp', statut: 'realisee',
      created_at: new Date(Date.now() - 10 * 3_600_000).toISOString(),
      niveau_urgence: 'immediate', date_souhaitee: null,
      delai_cible: new Date(Date.now() - 8 * 3_600_000).toISOString(), // dépassé mais réalisée → pas "en retard"
    },
  ]
}

const apiGet = vi.fn(async (path: string) => {
  if (path.startsWith('/api/categories_services')) return { data: [CAT_COIFFURE, CAT_TAXI] }
  if (path.startsWith('/api/clients')) return { data: [CLIENT_AKWA, CLIENT_BONANJO] }
  if (path.startsWith('/api/demandes')) {
    const url = new URL(`http://x${path}`)
    let result = demandes
    const categorie = url.searchParams.get('categorie')
    const statut = url.searchParams.get('statut')
    const canal = url.searchParams.get('canal')
    const urgence = url.searchParams.get('urgence')
    if (categorie) result = result.filter((d) => d.categorie_id === categorie)
    if (statut) result = result.filter((d) => d.statut === statut)
    if (canal) result = result.filter((d) => d.canal === canal)
    if (urgence) result = result.filter((d) => d.niveau_urgence === urgence)
    return { data: result }
  }
  throw new Error(`GET non mocké: ${path}`)
})

const apiPost = vi.fn(async (path: string, body: any) => {
  if (path === '/api/demandes') {
    if (body.niveau_urgence === 'planifie' && !body.date_souhaitee) {
      throw new Error('date_souhaitee est requise pour une demande planifiée')
    }
    const delaiCible = body.niveau_urgence === 'planifie' && body.date_souhaitee
      ? body.date_souhaitee
      : new Date(Date.now() + 24 * 3_600_000).toISOString() // calculé côté API/trigger, jamais fourni par le front
    const row = {
      id: `dem-${demandes.length + 1}`, client_id: body.client_id, categorie_id: body.categorie_id,
      description: body.description, localisation: body.localisation ?? null, canal: body.canal,
      statut: 'nouvelle', created_at: new Date().toISOString(),
      niveau_urgence: body.niveau_urgence, date_souhaitee: body.date_souhaitee ?? null,
      delai_cible: delaiCible,
    }
    demandes.push(row)
    return { data: row }
  }
  throw new Error(`POST non mocké: ${path}`)
})

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get:  (path: string) => apiGet(path),
    post: (path: string, body: unknown) => apiPost(path, body),
  },
  setApiToken: vi.fn(),
}))

import Demandes from '@/pages/Demandes'

function renderComponent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Demandes />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Demandes — liste, saisie rapide, SLA/retard, filtres', () => {
  beforeEach(() => {
    resetState()
    apiGet.mockClear()
    apiPost.mockClear()
  })

  afterEach(() => cleanup())

  it('affiche la liste et le badge "En retard" uniquement pour la demande concernée', async () => {
    renderComponent()
    await screen.findByText('Coupe à domicile')

    const rowRetard = screen.getByText('Coupe à domicile').closest('tr')!
    expect(within(rowRetard).getByText('En retard')).toBeInTheDocument()

    const rowATemps = screen.getByText('Course aéroport').closest('tr')!
    expect(within(rowATemps).queryByText('En retard')).not.toBeInTheDocument()
  })

  it('crée une demande urgente pour un client existant, avec délai calculé côté API', async () => {
    const user = userEvent.setup()
    renderComponent()
    await screen.findByText('Coupe à domicile')

    const form = screen.getByText('Nouvelle demande').closest('section')!
    await user.type(within(form).getByPlaceholderText(/rechercher un client/i), 'Paul')
    await user.click(await within(form).findByText(/Paul Ndongo/))

    const [categorieSelect] = within(form).getAllByRole('combobox')
    await user.selectOptions(categorieSelect, 'cat-1')
    await user.type(within(form).getByPlaceholderText(/tresses box braids/i), 'Onglerie à domicile')
    await user.click(within(form).getByRole('button', { name: /enregistrer la demande/i }))

    await screen.findByText('Onglerie à domicile')
    expect(apiPost).toHaveBeenCalledWith('/api/demandes', expect.objectContaining({
      client_id: 'cli-1', categorie_id: 'cat-1', niveau_urgence: 'urgent',
    }))
    // delai_cible n'est jamais envoyé par le front — calculé côté API/trigger.
    expect(apiPost.mock.calls[0][1]).not.toHaveProperty('delai_cible')
  })

  it('exige une date souhaitée pour une demande planifiée', async () => {
    const user = userEvent.setup()
    renderComponent()
    await screen.findByText('Coupe à domicile')

    const form = screen.getByText('Nouvelle demande').closest('section')!
    await user.type(within(form).getByPlaceholderText(/rechercher un client/i), 'Paul')
    await user.click(await within(form).findByText(/Paul Ndongo/))

    const [categorieSelect, urgenceSelect] = within(form).getAllByRole('combobox')
    await user.selectOptions(categorieSelect, 'cat-1')
    await user.selectOptions(urgenceSelect, 'planifie')
    await user.type(within(form).getByPlaceholderText(/tresses box braids/i), 'Ménage prévu la semaine prochaine')
    await user.click(within(form).getByRole('button', { name: /enregistrer la demande/i }))

    expect(apiPost).not.toHaveBeenCalled()
  })

  it('filtre par catégorie', async () => {
    const user = userEvent.setup()
    renderComponent()
    await screen.findByText('Coupe à domicile')
    expect(screen.getByText('Course aéroport')).toBeInTheDocument()

    const section = screen.getByText(/^File des demandes/).closest('section')!
    const [categorieSelect] = within(section).getAllByRole('combobox')
    await user.selectOptions(categorieSelect, 'cat-2')

    await screen.findByText('Course aéroport')
    expect(screen.queryByText('Coupe à domicile')).not.toBeInTheDocument()
  })

  it('filtre par urgence', async () => {
    const user = userEvent.setup()
    renderComponent()
    await screen.findByText('Coupe à domicile')

    const section = screen.getByText(/^File des demandes/).closest('section')!
    const selects = within(section).getAllByRole('combobox')
    const urgenceSelect = selects[selects.length - 1]
    await user.selectOptions(urgenceSelect, 'immediate')

    await screen.findByText('Course aéroport')
    expect(screen.queryByText('Coupe à domicile')).not.toBeInTheDocument()
  })
})
