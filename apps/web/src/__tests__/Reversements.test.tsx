/**
 * Reversements.test.tsx
 *
 * Tests d'UI de base sur le module Reversements : le montant net affiché pour
 * un reversement dû (montant_service − commission_montant, jamais en dur) est
 * correct, et le passage dû → payé fonctionne (statut mis à jour, action
 * disponible uniquement pour les reversements 'en_attente'). Mock de
 * `apiClient` uniquement.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const PRESTATAIRE = {
  id: 'pre-1', profile_id: 'pp1', nom: 'Plombier Pro', telephone: '+237690000001',
  categories: ['cat-1'], quartier: 'Akwa', geoloc_lat: null, geoloc_lng: null,
  statut: 'actif', note_moyenne: '4.5', taux_commission: null, date_recrutement: null,
}

const CLIENT = { id: 'cli-1', profile_id: 'p1', nom: 'Client Test', telephone: '+237691000001', quartier: 'Akwa', type_client: 'particulier', niu: null, whatsapp: null, email: null, source: 'whatsapp' }

const DEMANDE = {
  id: 'dem-1', client_id: 'cli-1', categorie_id: 'cat-1', description: 'Fuite',
  localisation: null, canal: 'web', statut: 'realisee', created_at: '', niveau_urgence: 'urgent',
  date_souhaitee: null, delai_cible: null,
}

const MATCHING = {
  id: 'match-1', demande_id: 'dem-1', prestataire_id: 'pre-1', operateur_id: 'op-1',
  statut: 'realise', motif_echec: null, proposed_at: '', closed_at: null,
}

const INTERVENTION_DUE = {
  id: 'interv-due0', matching_id: 'match-1', statut: 'realisee', date_planifiee: null,
  creneau_fin: null, date_debut: null, date_fin: null, checkin_at: null, checkout_at: null,
  localisation_checkin: null, preuve: null, created_at: '', updated_at: '',
}
const MATCHING_2 = { ...MATCHING, id: 'match-2', demande_id: 'dem-1' }
const INTERVENTION_PAYEE = { ...INTERVENTION_DUE, id: 'interv-paye0', matching_id: 'match-2' }

const TRANSACTION_DUE = {
  id: 'tx-due0', matching_id: 'match-1', montant_service: 10_000, commission_taux: '15.00',
  commission_montant: 1_500, statut_paiement: 'en_attente', ref_notchpay: null, created_at: '',
}
const TRANSACTION_PAYEE = { ...TRANSACTION_DUE, id: 'tx-paye0', matching_id: 'match-2', commission_montant: 900, montant_service: 6_000 }

let reversements: any[]

function resetState() {
  reversements = [
    { id: 'rev-du00000', prestataire_id: 'pre-1', montant: 0, statut: 'en_attente', ref: 'intervention:interv-due0', date_paiement: null, created_at: '' },
    { id: 'rev-paye0000', prestataire_id: 'pre-1', montant: 5_100, statut: 'traite', ref: 'intervention:interv-paye0', date_paiement: '2026-01-01T10:00:00.000Z', created_at: '' },
  ]
}

const apiGet = vi.fn(async (path: string) => {
  if (path.startsWith('/api/prestataires')) return { data: [PRESTATAIRE] }
  if (path.startsWith('/api/clients')) return { data: [CLIENT] }
  if (path.startsWith('/api/demandes')) return { data: [DEMANDE] }
  if (path.startsWith('/api/matchings')) return { data: [MATCHING, MATCHING_2] }
  if (path.startsWith('/api/interventions')) return { data: [INTERVENTION_DUE, INTERVENTION_PAYEE] }
  if (path.startsWith('/api/transactions')) return { data: [TRANSACTION_DUE, TRANSACTION_PAYEE] }
  if (path.startsWith('/api/reversements')) return { data: reversements }
  throw new Error(`GET non mocké: ${path}`)
})

const apiPatch = vi.fn(async (path: string, _body: unknown) => {
  const match = path.match(/^\/api\/reversements\/([^/]+)\/marquer-paye$/)
  if (match) {
    const r = reversements.find((x) => x.id === match[1])
    if (!r) throw new Error('introuvable')
    r.statut = 'traite'
    r.montant = 8_500
    r.date_paiement = new Date().toISOString()
    return { data: r }
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

import Reversements from '@/pages/Reversements'

function renderComponent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Reversements />
    </QueryClientProvider>,
  )
}

describe('Reversements — montant net, statut, marquage payé', () => {
  beforeEach(() => {
    resetState()
    apiGet.mockClear()
    apiPatch.mockClear()
  })

  afterEach(() => cleanup())

  it('affiche le montant net dû calculé (montant_service − commission_montant)', async () => {
    renderComponent()
    const lignes = await screen.findAllByRole('row')
    const ligneDue = lignes.find((r) => within(r).queryByText('Dû'))!
    expect(within(ligneDue).getByText(/8\s500\sFCFA/)).toBeInTheDocument()
    expect(within(ligneDue).getByText(/1\s500\sFCFA/)).toBeInTheDocument()
  })

  it('affiche le montant persisté et la date pour un reversement déjà payé, sans action', async () => {
    renderComponent()
    const lignes = await screen.findAllByRole('row')
    const lignePaye = lignes.find((r) => within(r).queryByText('Payé'))!
    expect(within(lignePaye).getByText(/5\s100\sFCFA/)).toBeInTheDocument()
    expect(within(lignePaye).queryByRole('button', { name: /marquer payé/i })).not.toBeInTheDocument()
  })

  it('marque un reversement dû comme payé', async () => {
    const user = userEvent.setup()
    renderComponent()
    const lignes = await screen.findAllByRole('row')
    const ligneDue = lignes.find((r) => within(r).queryByText('Dû'))!

    await user.click(within(ligneDue).getByRole('button', { name: /marquer payé/i }))

    expect(apiPatch).toHaveBeenCalledWith('/api/reversements/rev-du00000/marquer-paye', {})
  })

  it('calcule les KPI À reverser et Déjà reversé à partir des reversements affichés', async () => {
    renderComponent()
    await screen.findAllByRole('row')

    const kpiAReverser = screen.getByText('À reverser').closest('.panel') as HTMLElement
    expect(within(kpiAReverser).getByText(/8\s500\sFCFA/)).toBeInTheDocument()

    const kpiDejaReverse = screen.getByText('Déjà reversé').closest('.panel') as HTMLElement
    expect(within(kpiDejaReverse).getByText(/5\s100\sFCFA/)).toBeInTheDocument()
  })
})
