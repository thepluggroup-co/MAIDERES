/**
 * operatorFlow.test.tsx
 *
 * Parcours opérateur complet dans la Console : créer une demande → proposer
 * un prestataire (matching) → clôturer la mission avec une issue.
 *
 * L'acceptation du matching (propose → accepte) est une action du
 * prestataire, hors de cette console (Phase 4 / apps/shop). Le fake API
 * simule ici que le prestataire a accepté entre-temps, pour pouvoir
 * exercer l'écran de clôture réservé à l'opérateur.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: () => ({ children, initial, animate, exit, transition, whileHover, ...rest }: any) =>
      <div {...rest}>{children}</div>,
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'op-1', email: 'operateur@maideres.cm' },
    role: 'operateur',
    displayName: 'Opérateur Test',
    signOut: vi.fn(),
  }),
}))

// ── Fake API en mémoire ───────────────────────────────────────────────────────

const CATEGORIE = { id: 'cat-1', libelle: 'Coiffure', actif: true }
const CLIENT = { id: 'cli-1', profile_id: 'profile-cli-1', nom: 'Paul Ndongo', telephone: '+237691000001', quartier: 'Bonanjo' }
const PRESTATAIRE = {
  id: 'pres-1', profile_id: 'profile-pres-1', nom: 'Aïcha Mballa', telephone: '+237690000001',
  categories: ['cat-1'], quartier: 'Bonanjo', geoloc_lat: null, geoloc_lng: null,
  statut: 'actif', note_moyenne: '4.50', taux_commission: '15.00', date_recrutement: null,
}

let demandes: any[]
let matchings: any[]

function resetState() {
  demandes = []
  matchings = []
}

const apiGet = vi.fn(async (path: string) => {
  if (path.startsWith('/api/categories_services')) return { data: [CATEGORIE] }
  if (path.startsWith('/api/clients')) return { data: [CLIENT] }
  if (path.startsWith('/api/prestataires')) return { data: [PRESTATAIRE] }
  if (path.match(/^\/api\/demandes\/[^/?]+$/)) {
    const id = path.split('/').pop()
    const found = demandes.find((d) => d.id === id)
    if (!found) throw new Error('Demande introuvable')
    return { data: found }
  }
  if (path.startsWith('/api/demandes')) return { data: demandes }
  if (path.startsWith('/api/matchings')) {
    const url = new URL(`http://x${path}`)
    const demandeId = url.searchParams.get('demande_id')
    return { data: demandeId ? matchings.filter((m) => m.demande_id === demandeId) : matchings }
  }
  throw new Error(`GET non mocké: ${path}`)
})

const apiPost = vi.fn(async (path: string, body: any) => {
  if (path === '/api/demandes') {
    const demande = {
      id: `dem-${demandes.length + 1}`,
      client_id: body.client_id,
      categorie_id: body.categorie_id,
      description: body.description,
      localisation: body.localisation ?? null,
      canal: body.canal,
      statut: 'nouvelle',
      created_at: new Date().toISOString(),
    }
    demandes.push(demande)
    return { data: demande }
  }
  if (path === '/api/matchings') {
    const matching = {
      id: `match-${matchings.length + 1}`,
      demande_id: body.demande_id,
      prestataire_id: body.prestataire_id,
      operateur_id: 'op-1',
      statut: 'propose',
      motif_echec: null,
      proposed_at: new Date().toISOString(),
      closed_at: null,
    }
    matchings.push(matching)
    const demande = demandes.find((d) => d.id === body.demande_id)
    if (demande && demande.statut === 'nouvelle') demande.statut = 'en_traitement'

    // Simule l'acceptation du prestataire (hors console opérateur — Phase 4).
    matching.statut = 'accepte'
    if (demande) demande.statut = 'matchee'

    return { data: matching }
  }
  throw new Error(`POST non mocké: ${path}`)
})

const apiPatch = vi.fn(async (path: string, body: any) => {
  const cloturerMatch = path.match(/^\/api\/matchings\/([^/]+)\/cloturer$/)
  if (cloturerMatch) {
    const matching = matchings.find((m) => m.id === cloturerMatch[1])
    if (!matching) throw new Error('Matching introuvable')
    matching.statut = body.issue
    matching.motif_echec = body.motif_echec ?? null
    matching.closed_at = new Date().toISOString()
    const demande = demandes.find((d) => d.id === matching.demande_id)
    if (demande) demande.statut = body.issue === 'realise' ? 'realisee' : 'en_traitement'
    return { data: matching }
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

// ── Rendu ──────────────────────────────────────────────────────────────────────

import Demandes from '@/pages/Demandes'
import DemandeDetail from '@/pages/DemandeDetail'

function renderConsole() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/demandes']}>
        <Routes>
          <Route path="/demandes" element={<Demandes />} />
          <Route path="/demandes/:id" element={<DemandeDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Parcours opérateur — créer une demande → matcher → clôturer', () => {
  beforeEach(() => {
    resetState()
    apiGet.mockClear()
    apiPost.mockClear()
    apiPatch.mockClear()
  })

  afterEach(() => cleanup())

  it('mène le parcours complet de bout en bout', async () => {
    const user = userEvent.setup()
    renderConsole()

    // 1. Créer une demande ──────────────────────────────────────────────────
    await screen.findByText(/^File des demandes/)
    const form = screen.getByText('Nouvelle demande').closest('section')!
    await user.type(within(form).getByPlaceholderText(/rechercher un client/i), 'Paul')
    await user.click(await within(form).findByText(/Paul Ndongo/))

    const [categorieSelect] = within(form).getAllByRole('combobox')
    await user.selectOptions(categorieSelect, CATEGORIE.id)
    await user.type(form.querySelector('textarea')!, 'Coupe + brushing à domicile')
    await user.click(within(form).getByRole('button', { name: /enregistrer la demande/i }))

    // La demande apparaît dans la file
    await screen.findByText('Coupe + brushing à domicile')
    expect(demandes).toHaveLength(1)
    expect(apiPost).toHaveBeenCalledWith('/api/demandes', expect.objectContaining({ client_id: CLIENT.id, categorie_id: CATEGORIE.id }))

    // 2. Ouvrir la demande et proposer un prestataire ───────────────────────
    await user.click(screen.getByText('Coupe + brushing à domicile'))

    await screen.findByText('Aïcha Mballa')
    await user.click(screen.getByRole('button', { name: /proposer/i }))

    await screen.findByText('Accepté')
    expect(matchings).toHaveLength(1)
    expect(matchings[0].statut).toBe('accepte')

    // 3. Clôturer avec issue "réalisé" ───────────────────────────────────────
    await user.click(screen.getByRole('button', { name: /^réalisé$/i }))
    await user.click(screen.getByRole('button', { name: /confirmer la clôture/i }))

    await screen.findByText('Réalisé')
    expect(matchings[0].statut).toBe('realise')
    expect(demandes[0].statut).toBe('realisee')
    expect(apiPatch).toHaveBeenCalledWith(
      `/api/matchings/${matchings[0].id}/cloturer`,
      expect.objectContaining({ issue: 'realise' }),
    )
  })

  it("un matching en attente d'acceptation n'affiche pas le formulaire de clôture", async () => {
    // Matching resté au statut 'propose' — le formulaire de clôture ne doit pas apparaître
    // (il n'est visible que pour un matching 'accepte').
    demandes = [{
      id: 'dem-x', client_id: CLIENT.id, categorie_id: CATEGORIE.id,
      description: 'Test statut propose', localisation: null, canal: 'manuel',
      statut: 'en_traitement', created_at: new Date().toISOString(),
    }]
    matchings = [{
      id: 'match-x', demande_id: 'dem-x', prestataire_id: PRESTATAIRE.id, operateur_id: 'op-1',
      statut: 'propose', motif_echec: null, proposed_at: new Date().toISOString(), closed_at: null,
    }]

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/demandes/dem-x']}>
          <Routes>
            <Route path="/demandes/:id" element={<DemandeDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await screen.findByText('Proposé')
    expect(screen.queryByRole('button', { name: /confirmer la clôture/i })).not.toBeInTheDocument()
  })
})
