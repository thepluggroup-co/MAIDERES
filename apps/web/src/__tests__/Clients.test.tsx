/**
 * Clients.test.tsx
 *
 * Tests d'UI de base sur le module Clients : liste filtrée par recherche,
 * création d'un client avec typologie (NIU requis pour entreprise/
 * organisation), et ouverture de la fiche avec historique des demandes.
 * Mock de `apiClient` uniquement (pas de mock Supabase direct).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ── Fake API en mémoire ───────────────────────────────────────────────────────

const CATEGORIE = { id: 'cat-1', libelle: 'Coiffure', actif: true }

let clients: any[]
let demandes: any[]

function resetState() {
  clients = [
    { id: 'cli-1', profile_id: 'p1', nom: 'Paul Ndongo', telephone: '+237691000001', quartier: 'Bonanjo', type_client: 'particulier', niu: null, whatsapp: '+237691000001', email: null, source: 'whatsapp' },
  ]
  demandes = [
    { id: 'dem-1', client_id: 'cli-1', categorie_id: 'cat-1', description: 'Coupe à domicile', localisation: null, canal: 'web', statut: 'realisee', created_at: new Date().toISOString() },
  ]
}

const apiGet = vi.fn(async (path: string) => {
  if (path.startsWith('/api/categories_services')) return { data: [CATEGORIE] }
  if (path.startsWith('/api/clients'))              return { data: clients }
  if (path.startsWith('/api/demandes'))              return { data: demandes }
  throw new Error(`GET non mocké: ${path}`)
})

const apiPost = vi.fn(async (path: string, body: any) => {
  if (path === '/api/clients') {
    const row = {
      id: `cli-${clients.length + 1}`, profile_id: `p${clients.length + 1}`,
      nom: body.nom, telephone: body.telephone, quartier: body.quartier ?? null,
      type_client: body.type_client, niu: body.niu ?? null,
      whatsapp: body.whatsapp ?? null, email: body.email ?? null, source: body.source,
    }
    clients.push(row)
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

import Clients from '@/pages/Clients'

function renderComponent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Clients />
    </QueryClientProvider>,
  )
}

describe('Clients — liste, création avec typologie, fiche + historique', () => {
  beforeEach(() => {
    resetState()
    apiGet.mockClear()
    apiPost.mockClear()
  })

  afterEach(() => cleanup())

  it('affiche la liste des clients existants', async () => {
    renderComponent()
    await screen.findByText('Paul Ndongo')
    const row = screen.getByText('Paul Ndongo').closest('tr')!
    expect(within(row).getByText('Particulier')).toBeInTheDocument()
    expect(within(row).getByText('Bonanjo')).toBeInTheDocument()
  })

  it('filtre la liste via la recherche', async () => {
    const user = userEvent.setup()
    renderComponent()
    await screen.findByText('Paul Ndongo')

    await user.type(screen.getByPlaceholderText('Rechercher…'), 'inexistant')
    expect(screen.queryByText('Paul Ndongo')).not.toBeInTheDocument()
  })

  it('refuse de créer une entreprise sans NIU, sans appeler l\'API', async () => {
    const user = userEvent.setup()
    renderComponent()
    await screen.findByText('Paul Ndongo')

    const form = screen.getByText('Nouveau client').closest('section')!
    const [typeSelect] = within(form).getAllByRole('combobox')
    await user.selectOptions(typeSelect, 'entreprise')
    await user.type(within(form).getByLabelText(/nom \/ raison sociale/i), 'Kamdem SARL')
    await user.type(within(form).getByLabelText(/téléphone/i), '+237699334455')
    await user.click(within(form).getByRole('button', { name: /enregistrer/i }))

    expect(apiPost).not.toHaveBeenCalled()
  })

  it('crée une entreprise avec NIU renseigné', async () => {
    const user = userEvent.setup()
    renderComponent()
    await screen.findByText('Paul Ndongo')

    const form = screen.getByText('Nouveau client').closest('section')!
    const [typeSelect] = within(form).getAllByRole('combobox')
    await user.selectOptions(typeSelect, 'entreprise')
    await user.type(within(form).getByLabelText(/nom \/ raison sociale/i), 'Kamdem SARL')
    await user.type(within(form).getByLabelText(/téléphone/i), '+237699334455')
    await user.type(within(form).getByLabelText(/niu/i), 'M071523018745B')
    await user.click(within(form).getByRole('button', { name: /enregistrer/i }))

    await screen.findByText('Kamdem SARL')
    expect(apiPost).toHaveBeenCalledWith('/api/clients', expect.objectContaining({
      type_client: 'entreprise', nom: 'Kamdem SARL', niu: 'M071523018745B',
    }))
  })

  it('ouvre la fiche client et affiche l\'historique des demandes', async () => {
    const user = userEvent.setup()
    renderComponent()
    await screen.findByText('Paul Ndongo')

    await user.click(screen.getByText('Paul Ndongo'))

    const sheet = await screen.findByRole('dialog')
    await within(sheet).findByText(/historique des demandes/i)
    expect(within(sheet).getByText('Coiffure')).toBeInTheDocument()
    expect(within(sheet).getByText('Coupe à domicile')).toBeInTheDocument()
  })
})
