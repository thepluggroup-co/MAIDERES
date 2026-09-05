import React, { useState } from 'react'
import { DataTable, StatusBadge, Button, SlideOver } from '@maideres/ui'
import type { Column, StatusMap } from '@maideres/ui'
import { Plus, Pencil, Trash2, Tag, Clock, Percent } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCategories, useCreateCategorie, useUpdateCategorie, useDeleteCategorie,
} from '@/hooks/useCategories'
import type { CategorieService } from '@/hooks/useCategories'
import { useSlaConfig, useUpdateSlaConfig } from '@/hooks/useSlaConfig'
import type { SlaConfig, NiveauUrgence } from '@/hooks/useSlaConfig'
import {
  useCommissionConfig, useCreateCommissionConfig, useUpdateCommissionConfig, useDeleteCommissionConfig,
} from '@/hooks/useCommissionConfig'
import type { CommissionConfig } from '@/hooks/useCommissionConfig'

const ACTIF_MAP: StatusMap = {
  true:  { label: 'Actif',   color: '#3B6D11', bgColor: '#EAF3DE' },
  false: { label: 'Inactif', color: '#5F5E5A', bgColor: '#F1EEE9' },
}

const NIVEAU_LABELS: Record<NiveauUrgence, string> = {
  immediate: 'Immédiat',
  urgent:    'Urgent',
  planifie:  'Planifié',
}

// ══════════════════════════════════════════════════════════════════════════════
// CATÉGORIES DE SERVICES
// ══════════════════════════════════════════════════════════════════════════════

function CategorieForm({ categorie, onClose }: { categorie: CategorieService | null; onClose: () => void }) {
  const create = useCreateCategorie()
  const update = useUpdateCategorie()
  const [libelle, setLibelle] = useState(categorie?.libelle ?? '')
  const [actif, setActif] = useState(categorie?.actif ?? true)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!libelle.trim()) { toast.error('Libellé requis'); return }
    if (categorie) await update.mutateAsync({ id: categorie.id, libelle: libelle.trim(), actif })
    else           await create.mutateAsync({ libelle: libelle.trim(), actif })
    onClose()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="categorie-libelle" className="block text-xs font-medium text-gray-500 mb-1">Libellé *</label>
        <input id="categorie-libelle" value={libelle} onChange={(e) => setLibelle(e.target.value)} required
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
        Catégorie active (visible des clients)
      </label>
      <div className="pt-2 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
        <Button type="submit" loading={create.isPending || update.isPending}>
          {categorie ? 'Enregistrer' : 'Créer la catégorie'}
        </Button>
      </div>
    </form>
  )
}

function CategoriesSection() {
  const { data: categories = [], isLoading } = useCategories()
  const deleteCategorie = useDeleteCategorie()
  const [editing, setEditing] = useState<CategorieService | 'new' | null>(null)

  const columns: Column<CategorieService>[] = [
    { id: 'libelle', header: 'Libellé', accessor: 'libelle' },
    {
      id: 'actif', header: 'Statut', accessor: (r) => String(r.actif),
      render: (v) => <StatusBadge status={v as string} map={ACTIF_MAP} />,
    },
    {
      id: 'actions', header: 'Actions', accessor: 'id', sortable: false, csvSkip: true,
      render: (_v, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setEditing(row)} className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100" title="Modifier">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => { if (confirm(`Supprimer la catégorie "${row.libelle}" ?`)) deleteCategorie.mutate(row.id) }}
            className="p-1.5 rounded-md text-destructive hover:bg-destructive/10" title="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm text-foreground">Catégories de services</h2>
        </div>
        <Button size="sm" onClick={() => setEditing('new')}><Plus className="h-3.5 w-3.5 mr-1" /> Nouvelle catégorie</Button>
      </div>
      <div className="p-0">
        <DataTable columns={columns} data={categories} loading={isLoading} keyField="id" emptyMessage="Aucune catégorie" />
      </div>

      <SlideOver
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nouvelle catégorie' : 'Modifier la catégorie'}
      >
        {editing !== null && (
          <CategorieForm categorie={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
        )}
      </SlideOver>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SLA — délai cible par niveau d'urgence
// ══════════════════════════════════════════════════════════════════════════════

function SlaRow({ config }: { config: SlaConfig }) {
  const update = useUpdateSlaConfig()
  const [editing, setEditing] = useState(false)
  const [delai, setDelai] = useState(String(config.delai_heures))
  const [seuil, setSeuil] = useState(String(config.seuil_alerte_heures))

  const save = async () => {
    const delaiHeures = Number(delai)
    const seuilHeures = Number(seuil)
    if (!Number.isFinite(delaiHeures) || delaiHeures <= 0) { toast.error('Délai invalide'); return }
    if (!Number.isFinite(seuilHeures) || seuilHeures < 0 || seuilHeures >= delaiHeures) {
      toast.error('Le seuil d\'alerte doit être inférieur au délai cible')
      return
    }
    await update.mutateAsync({ id: config.id, delai_heures: delaiHeures, seuil_alerte_heures: seuilHeures })
    setEditing(false)
  }

  return (
    <tr className="border-b border-gray-50 last:border-0">
      <td className="px-4 py-3 text-sm font-medium text-foreground">{NIVEAU_LABELS[config.niveau_urgence]}</td>
      <td className="px-4 py-3">
        {editing ? (
          <input type="number" min={1} value={delai} onChange={(e) => setDelai(e.target.value)}
            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
        ) : (
          <span className="text-sm">{config.delai_heures} h</span>
        )}
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <input type="number" min={0} value={seuil} onChange={(e) => setSeuil(e.target.value)}
            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
        ) : (
          <span className="text-sm">{config.seuil_alerte_heures} h</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {editing ? (
          <div className="flex justify-end gap-2">
            <Button size="xs" variant="secondary" onClick={() => setEditing(false)}>Annuler</Button>
            <Button size="xs" onClick={save} loading={update.isPending}>Enregistrer</Button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100" title="Modifier">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </tr>
  )
}

function SlaSection() {
  const { data: configs = [], isLoading } = useSlaConfig()

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <Clock className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-sm text-foreground">Délais SLA par niveau d'urgence</h2>
      </div>
      <p className="px-5 pt-3 text-xs text-muted-foreground">
        Délai cible = date de création + délai. Seuil d'alerte = nombre d'heures avant l'échéance à partir duquel une demande passe à l'état "alerte".
      </p>
      <div className="overflow-x-auto p-5 pt-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Niveau d'urgence</th>
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Délai cible</th>
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Seuil d'alerte</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => <SlaRow key={config.id} config={config} />)}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// COMMISSIONS
// ══════════════════════════════════════════════════════════════════════════════

function CommissionForm({ config, onClose }: { config: CommissionConfig | null; onClose: () => void }) {
  const { data: categories = [] } = useCategories()
  const create = useCreateCommissionConfig()
  const update = useUpdateCommissionConfig()

  const [categorieId, setCategorieId] = useState(config?.categorie_id ?? '')
  const [type, setType] = useState<'pourcentage' | 'montant_fixe'>(config?.type ?? 'pourcentage')
  const [valeur, setValeur] = useState(config?.valeur ?? '')
  const [actif, setActif] = useState(config?.actif ?? true)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const valeurNum = Number(valeur)
    if (!Number.isFinite(valeurNum) || valeurNum < 0) { toast.error('Valeur invalide'); return }
    if (type === 'pourcentage' && valeurNum > 100) { toast.error('Un pourcentage ne peut pas dépasser 100'); return }

    if (config) {
      await update.mutateAsync({ id: config.id, type, valeur: valeurNum, actif })
    } else {
      await create.mutateAsync({ categorie_id: categorieId || null, type, valeur: valeurNum, actif })
    }
    onClose()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {!config && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Portée</label>
          <select value={categorieId} onChange={(e) => setCategorieId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">Règle globale (toutes catégories)</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="pourcentage">Pourcentage</option>
          <option value="montant_fixe">Montant fixe (FCFA)</option>
        </select>
      </div>
      <div>
        <label htmlFor="commission-valeur" className="block text-xs font-medium text-gray-500 mb-1">
          Valeur {type === 'pourcentage' ? '(%)' : '(FCFA)'} *
        </label>
        <input id="commission-valeur" type="number" min={0} max={type === 'pourcentage' ? 100 : undefined} value={valeur}
          onChange={(e) => setValeur(e.target.value)} required
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
        Règle active
      </label>
      <div className="pt-2 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
        <Button type="submit" loading={create.isPending || update.isPending}>
          {config ? 'Enregistrer' : 'Créer la règle'}
        </Button>
      </div>
    </form>
  )
}

function CommissionSection() {
  const { data: configs = [], isLoading } = useCommissionConfig()
  const { data: categories = [] } = useCategories()
  const deleteConfig = useDeleteCommissionConfig()
  const [editing, setEditing] = useState<CommissionConfig | 'new' | null>(null)

  const catLabel = React.useMemo(() => new Map(categories.map((c) => [c.id, c.libelle])), [categories])

  const columns: Column<CommissionConfig>[] = [
    { id: 'portee', header: 'Portée', accessor: (r) => r.categorie_id ? (catLabel.get(r.categorie_id) ?? r.categorie_id) : 'Règle globale' },
    { id: 'type', header: 'Type', accessor: (r) => r.type === 'pourcentage' ? 'Pourcentage' : 'Montant fixe' },
    { id: 'valeur', header: 'Valeur', accessor: (r) => r.type === 'pourcentage' ? `${r.valeur} %` : `${Number(r.valeur).toLocaleString('fr-FR')} FCFA` },
    {
      id: 'actif', header: 'Statut', accessor: (r) => String(r.actif),
      render: (v) => <StatusBadge status={v as string} map={ACTIF_MAP} />,
    },
    {
      id: 'actions', header: 'Actions', accessor: 'id', sortable: false, csvSkip: true,
      render: (_v, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setEditing(row)} className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100" title="Modifier">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => { if (confirm('Supprimer cette règle de commission ?')) deleteConfig.mutate(row.id) }}
            className="p-1.5 rounded-md text-destructive hover:bg-destructive/10" title="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Percent className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm text-foreground">Commissions</h2>
        </div>
        <Button size="sm" onClick={() => setEditing('new')}><Plus className="h-3.5 w-3.5 mr-1" /> Nouvelle règle</Button>
      </div>
      <p className="px-5 pt-3 text-xs text-muted-foreground">
        Ordre de résolution appliqué au calcul (public.calculer_commission) : override par prestataire, puis règle de catégorie, puis règle globale.
      </p>
      <div className="pt-3">
        <DataTable columns={columns} data={configs} loading={isLoading} keyField="id" emptyMessage="Aucune règle de commission" />
      </div>

      <SlideOver
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nouvelle règle de commission' : 'Modifier la règle'}
      >
        {editing !== null && (
          <CommissionForm config={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
        )}
      </SlideOver>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════════════════════

export function ParametresMetier() {
  return (
    <div className="space-y-6">
      <CategoriesSection />
      <SlaSection />
      <CommissionSection />
    </div>
  )
}
