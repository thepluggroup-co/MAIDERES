/**
 * ParametresMetier.test.tsx
 *
 * Tests d'UI de base sur le module Paramètres (categories_services /
 * sla_config / commission_config) : rendu des 3 sections à partir de
 * données API mockées, création d'une catégorie, édition inline d'un délai
 * SLA, création d'une règle de commission. Mock de `apiClient` uniquement
 * (pas de mock Supabase direct dans ce composant, cf. hooks/use*).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: () => ({ children, initial, animate, exit, transition, whileHover, ...rest }: any) =>
      <div {...rest}>{children}</div>,
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// ── Fake API en mémoire ───────────────────────────────────────────────────────

let categories: any[]
let slaConfigs: any[]
let commissionConfigs: any[]

function resetState() {
  categories = [{ id: 'cat-1', libelle: 'Coiffure', actif: true }]
  slaConfigs = [
    { id: 'sla-1', niveau_urgence: 'immediate', delai_heures: 2, seuil_alerte_heures: 1, created_at: new Date().toISOString() },
    { id: 'sla-2', niveau_urgence: 'urgent', delai_heures: 24, seuil_alerte_heures: 12, created_at: new Date().toISOString() },
    { id: 'sla-3', niveau_urgence: 'planifie', delai_heures: 72, seuil_alerte_heures: 48, created_at: new Date().toISOString() },
  ]
  commissionConfigs = [
    { id: 'com-1', categorie_id: null, type: 'pourcentage', valeur: '15', actif: true, created_at: new Date().toISOString() },
  ]
}

const apiGet = vi.fn(async (path: string) => {
  if (path.startsWith('/api/categories_services')) return { data: categories }
  if (path.startsWith('/api/sla_config'))          return { data: slaConfigs }
  if (path.startsWith('/api/commission_config'))   return { data: commissionConfigs }
  throw new Error(`GET non mocké: ${path}`)
})

const apiPost = vi.fn(async (path: string, body: any) => {
  if (path === '/api/categories_services') {
    const row = { id: `cat-${categories.length + 1}`, libelle: body.libelle, actif: body.actif ?? true }
    categories.push(row)
    return { data: row }
  }
  if (path === '/api/commission_config') {
    const row = {
      id: `com-${commissionConfigs.length + 1}`, categorie_id: body.categorie_id ?? null,
      type: body.type, valeur: String(body.valeur), actif: body.actif ?? true, created_at: new Date().toISOString(),
    }
    commissionConfigs.push(row)
    return { data: row }
  }
  throw new Error(`POST non mocké: ${path}`)
})

const apiPatch = vi.fn(async (path: string, body: any) => {
  const slaMatch = path.match(/^\/api\/sla_config\/([^/]+)$/)
  if (slaMatch) {
    const row = slaConfigs.find((s) => s.id === slaMatch[1])
    if (!row) throw new Error('introuvable')
    Object.assign(row, body)
    return { data: row }
  }
  throw new Error(`PATCH non mocké: ${path}`)
})

const apiDelete = vi.fn(async (path: string) => {
  const catMatch = path.match(/^\/api\/categories_services\/([^/]+)$/)
  if (catMatch) {
    categories = categories.filter((c) => c.id !== catMatch[1])
    return { success: true }
  }
  throw new Error(`DELETE non mocké: ${path}`)
})

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get:    (path: string) => apiGet(path),
    post:   (path: string, body: unknown) => apiPost(path, body),
    patch:  (path: string, body: unknown) => apiPatch(path, body),
    delete: (path: string) => apiDelete(path),
  },
  setApiToken: vi.fn(),
}))

vi.stubGlobal('confirm', vi.fn(() => true))

import { ParametresMetier } from '@/features/admin'

function renderComponent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ParametresMetier />
    </QueryClientProvider>,
  )
}

describe('ParametresMetier — categories_services / sla_config / commission_config', () => {
  beforeEach(() => {
    resetState()
    apiGet.mockClear()
    apiPost.mockClear()
    apiPatch.mockClear()
    apiDelete.mockClear()
  })

  afterEach(() => cleanup())

  it('affiche les 3 sections alimentées par les hooks API (pas de valeur en dur)', async () => {
    renderComponent()

    await screen.findByText('Catégories de services')
    await screen.findByText('Coiffure')

    await screen.findByText("Délais SLA par niveau d'urgence")
    await screen.findByText('Immédiat')
    expect(screen.getByText('2 h')).toBeInTheDocument()
    expect(screen.getByText('24 h')).toBeInTheDocument()
    expect(screen.getByText('72 h')).toBeInTheDocument()

    await screen.findByText('Commissions')
    await screen.findByText('Règle globale')
    expect(screen.getByText('15 %')).toBeInTheDocument()
  })

  it('crée une nouvelle catégorie via le formulaire', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('Catégories de services')
    await user.click(screen.getByRole('button', { name: /nouvelle catégorie/i }))

    const dialog = await screen.findByRole('dialog', { name: /nouvelle catégorie/i })
    await user.type(within(dialog).getByLabelText(/libellé/i), 'Taxi')
    await user.click(within(dialog).getByRole('button', { name: /créer la catégorie/i }))

    await screen.findByText('Taxi')
    expect(apiPost).toHaveBeenCalledWith('/api/categories_services', expect.objectContaining({ libelle: 'Taxi' }))
  })

  it('modifie un délai SLA en ligne', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('Immédiat')
    const row = screen.getByText('Immédiat').closest('tr')!
    await user.click(within(row).getByTitle(/modifier/i))

    const delaiInput = within(row).getAllByRole('spinbutton')[0]
    await user.clear(delaiInput)
    await user.type(delaiInput, '3')
    await user.click(within(row).getByRole('button', { name: /enregistrer/i }))

    expect(apiPatch).toHaveBeenCalledWith('/api/sla_config/sla-1', expect.objectContaining({ delai_heures: 3 }))
  })

  it('refuse un seuil d\'alerte supérieur ou égal au délai cible, sans appeler l\'API', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('Immédiat')
    const row = screen.getByText('Immédiat').closest('tr')!
    await user.click(within(row).getByTitle(/modifier/i))

    const [delaiInput, seuilInput] = within(row).getAllByRole('spinbutton')
    await user.clear(delaiInput)
    await user.type(delaiInput, '2')
    await user.clear(seuilInput)
    await user.type(seuilInput, '5') // >= délai : invalide
    await user.click(within(row).getByRole('button', { name: /enregistrer/i }))

    expect(apiPatch).not.toHaveBeenCalled()
  })

  it('crée une règle de commission de catégorie', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('Commissions')
    await user.click(screen.getByRole('button', { name: /nouvelle règle/i }))

    const dialog = await screen.findByRole('dialog', { name: /nouvelle règle de commission/i })
    const [porteeSelect] = within(dialog).getAllByRole('combobox')
    await user.selectOptions(porteeSelect, 'cat-1')
    await user.type(within(dialog).getByLabelText(/valeur/i), '20')
    await user.click(within(dialog).getByRole('button', { name: /créer la règle/i }))

    await screen.findByText('20 %')
    expect(apiPost).toHaveBeenCalledWith('/api/commission_config', expect.objectContaining({ categorie_id: 'cat-1', valeur: 20 }))
  })
})
