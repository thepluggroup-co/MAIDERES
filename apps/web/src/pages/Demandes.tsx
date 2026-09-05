import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { StatusMap } from '@maideres/ui'
import { UserPlus } from 'lucide-react'
import { ModuleHeader, Section, Table, Td, Vide, Chip } from '@/components/erp'
import { Champ, Sel, Txt } from '@/components/erp-form'
import { Button } from '@/components/ui/button'
import { useDemandes, useCreateDemande } from '@/hooks/useDemandes'
import type { Demande, DemandeCanal, DemandeStatut, NiveauUrgence } from '@/hooks/useDemandes'
import { useClients, useCreateClient } from '@/hooks/useClients'
import { useCategories } from '@/hooks/useCategories'

// ── Libellés & tons ────────────────────────────────────────────────────────────
// Conservé pour DemandeDetail.tsx (import existant de DEMANDE_STATUS_MAP,
// forme StatusMap de @maideres/ui — ce module reste sur ses propres Chip/ton
// ci-dessous pour son propre rendu, cf. Clients.tsx/Prestataires.tsx).

export const DEMANDE_STATUS_MAP: StatusMap = {
  nouvelle:      { label: 'Nouvelle',      color: '#854F0B', bgColor: '#FAEEDA' },
  en_traitement: { label: 'En traitement', color: '#185FA5', bgColor: '#E6F1FB' },
  matchee:       { label: 'Matchée',       color: '#185FA5', bgColor: '#E6F1FB' },
  realisee:      { label: 'Réalisée',      color: '#3B6D11', bgColor: '#EAF3DE' },
  annulee:       { label: 'Annulée',       color: '#A32D2D', bgColor: '#FCEBEB' },
}

const STATUTS_DEMANDE: { value: DemandeStatut; label: string; tone: string }[] = [
  { value: 'nouvelle',      label: 'Nouvelle',      tone: 'bg-info/12 text-info border-info/30' },
  { value: 'en_traitement', label: 'En traitement', tone: 'bg-warning/15 text-warning-foreground border-warning/40' },
  { value: 'matchee',       label: 'Matchée',       tone: 'bg-primary/10 text-primary border-primary/25' },
  { value: 'realisee',      label: 'Réalisée',      tone: 'bg-success/12 text-success border-success/30' },
  { value: 'annulee',       label: 'Annulée',       tone: 'bg-muted text-muted-foreground border-border' },
]

const URGENCES: { value: NiveauUrgence; label: string; tone: string }[] = [
  { value: 'immediate', label: 'Immédiate', tone: 'bg-destructive/12 text-destructive border-destructive/30' },
  { value: 'urgent',    label: 'Urgent',    tone: 'bg-warning/15 text-warning-foreground border-warning/40' },
  { value: 'planifie',  label: 'Planifié',  tone: 'bg-info/12 text-info border-info/30' },
]

const CANAL_LABELS: Record<DemandeCanal, string> = { web: 'Web', whatsapp: 'WhatsApp', manuel: 'Manuel' }

const libelle = (list: { value: string; label: string }[], v: string | null | undefined) =>
  v ? (list.find((x) => x.value === v)?.label ?? v) : '—'

const ton = (list: { value: string; label: string; tone: string }[], v: string | null | undefined) =>
  (v ? list.find((x) => x.value === v)?.tone : undefined) ?? 'bg-muted text-muted-foreground border-border'

/** En retard : délai cible dépassé et la demande n'est ni réalisée ni annulée. */
const enRetard = (d: Demande) =>
  Boolean(d.delai_cible) && new Date(d.delai_cible!).getTime() < Date.now() &&
  d.statut !== 'realisee' && d.statut !== 'annulee'

function resteAvantDelai(delai: string | null): string {
  if (!delai) return '—'
  const diff = new Date(delai).getTime() - Date.now()
  const abs = Math.abs(diff)
  const h = Math.floor(abs / 3_600_000)
  const m = Math.floor((abs % 3_600_000) / 60_000)
  const texte = h >= 24 ? `${Math.floor(h / 24)} j ${h % 24} h` : h > 0 ? `${h} h ${m} min` : `${m} min`
  return diff < 0 ? `retard ${texte}` : `dans ${texte}`
}

// ── Formulaire de saisie rapide ───────────────────────────────────────────────
// Pas de budget_indicatif ni de quartier propres à la demande : ces champs de
// la maquette Lovable n'ont pas de colonne équivalente sur `demandes` (le
// quartier vit sur `clients`, déjà exploité pour le filtre plus bas ; aucune
// colonne budget n'existe côté backend — omis plutôt qu'inventé).

const vide = {
  categorieId: '', description: '', localisation: '', canal: 'manuel' as DemandeCanal,
  niveauUrgence: 'urgent' as NiveauUrgence, dateSouhaitee: '',
}

function QuickCreateForm({ onChanged }: { onChanged: () => void }) {
  const { data: categories = [] } = useCategories()
  const { data: clients = [] } = useClients()
  const createDemande = useCreateDemande()
  const createClient = useCreateClient()

  const [clientId, setClientId] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [newClient, setNewClient] = useState(false)
  const [newClientNom, setNewClientNom] = useState('')
  const [newClientTel, setNewClientTel] = useState('')
  const [newClientQuartier, setNewClientQuartier] = useState('')

  const [f, setF] = useState(vide)

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase()
    if (!q) return clients.slice(0, 8)
    return clients.filter((c) => c.nom.toLowerCase().includes(q) || c.telephone.includes(q)).slice(0, 8)
  }, [clients, clientSearch])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.categorieId || !f.description.trim()) {
      toast.error('Catégorie et description requises')
      return
    }
    if (f.niveauUrgence === 'planifie' && !f.dateSouhaitee) {
      toast.error('Date souhaitée requise pour une demande planifiée')
      return
    }

    let finalClientId = clientId
    if (newClient) {
      if (!newClientNom.trim() || !newClientTel.trim()) {
        toast.error('Nom et téléphone du client requis')
        return
      }
      const SOURCE_PAR_CANAL: Record<DemandeCanal, 'whatsapp' | 'appel' | 'ecommerce'> = {
        whatsapp: 'whatsapp', web: 'ecommerce', manuel: 'appel',
      }
      const res = await createClient.mutateAsync({
        nom: newClientNom.trim(),
        telephone: newClientTel.trim(),
        quartier: newClientQuartier.trim() || null,
        type_client: 'particulier',
        source: SOURCE_PAR_CANAL[f.canal],
      })
      finalClientId = res.data.id
    }

    if (!finalClientId) {
      toast.error('Sélectionnez ou créez un client')
      return
    }

    await createDemande.mutateAsync({
      client_id: finalClientId,
      categorie_id: f.categorieId,
      description: f.description.trim(),
      localisation: f.localisation.trim() || null,
      canal: f.canal,
      niveau_urgence: f.niveauUrgence,
      date_souhaitee: f.niveauUrgence === 'planifie' && f.dateSouhaitee ? new Date(f.dateSouhaitee).toISOString() : null,
    })
    setF(vide)
    setClientId('')
    setClientSearch('')
    setNewClient(false)
    setNewClientNom('')
    setNewClientTel('')
    setNewClientQuartier('')
    onChanged()
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
      {/* Pas de <Champ> ici : un input de recherche + une liste de boutons ne
          sont pas "un seul contrôle" — cf. le même correctif sur Prestataires.tsx
          (un <label> autour de plusieurs contrôles casse leur nom accessible). */}
      <div className="md:col-span-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Client</span>
          <button
            type="button"
            onClick={() => setNewClient((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            <UserPlus className="h-3 w-3" /> {newClient ? 'Choisir un client existant' : 'Nouveau client'}
          </button>
        </div>

        {newClient ? (
          <div className="mt-1 grid gap-2 rounded-md border border-input p-3 sm:grid-cols-3">
            <Txt placeholder="Nom *" value={newClientNom} onChange={(e) => setNewClientNom(e.target.value)} />
            <Txt placeholder="Téléphone *" value={newClientTel} onChange={(e) => setNewClientTel(e.target.value)} />
            <Txt placeholder="Quartier" value={newClientQuartier} onChange={(e) => setNewClientQuartier(e.target.value)} />
          </div>
        ) : (
          <div className="mt-1">
            <Txt
              placeholder="Rechercher un client (nom ou téléphone)…"
              value={clientSearch}
              onChange={(e) => { setClientSearch(e.target.value); setClientId('') }}
            />
            <div className="mt-1.5 max-h-32 overflow-y-auto rounded-md border border-border divide-y divide-border">
              {filteredClients.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">Aucun résultat</p>
              )}
              {filteredClients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setClientId(c.id); setClientSearch(`${c.nom} — ${c.telephone}`) }}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-muted/50 ${clientId === c.id ? 'bg-accent font-medium' : ''}`}
                >
                  {c.nom} — {c.telephone}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Champ label="Catégorie de service">
        <Sel required value={f.categorieId} onChange={(e) => setF({ ...f, categorieId: e.target.value })}>
          <option value="">— Sélectionner —</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
        </Sel>
      </Champ>

      <Champ label="Niveau d'urgence">
        <Sel value={f.niveauUrgence} onChange={(e) => setF({ ...f, niveauUrgence: e.target.value as NiveauUrgence })}>
          {URGENCES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
        </Sel>
      </Champ>

      {f.niveauUrgence === 'planifie' ? (
        <Champ label="Date souhaitée">
          <Txt type="datetime-local" required value={f.dateSouhaitee} onChange={(e) => setF({ ...f, dateSouhaitee: e.target.value })} />
        </Champ>
      ) : (
        <Champ label="Canal">
          <Sel value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value as DemandeCanal })}>
            {(['manuel', 'whatsapp', 'web'] as DemandeCanal[]).map((c) => <option key={c} value={c}>{CANAL_LABELS[c]}</option>)}
          </Sel>
        </Champ>
      )}

      <Champ label="Description du besoin" className="md:col-span-3">
        <textarea
          required
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
          rows={3}
          placeholder="Ex. tresses box braids à domicile, samedi matin avant 10h"
          className="h-auto min-h-20 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-base outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/25 sm:text-sm"
        />
      </Champ>

      <Champ label="Localisation" className="md:col-span-2">
        <Txt value={f.localisation} onChange={(e) => setF({ ...f, localisation: e.target.value })} />
      </Champ>

      {f.niveauUrgence === 'planifie' && (
        <Champ label="Canal">
          <Sel value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value as DemandeCanal })}>
            {(['manuel', 'whatsapp', 'web'] as DemandeCanal[]).map((c) => <option key={c} value={c}>{CANAL_LABELS[c]}</option>)}
          </Sel>
        </Champ>
      )}

      <div className="md:col-span-3">
        <Button type="submit" disabled={createDemande.isPending || createClient.isPending}>
          Enregistrer la demande
        </Button>
      </div>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Demandes() {
  const navigate = useNavigate()
  const [categorieFilter, setCategorieFilter] = useState('tous')
  const [quartierFilter, setQuartierFilter] = useState('tous')
  const [statutFilter, setStatutFilter] = useState<'tous' | DemandeStatut>('tous')
  const [canalFilter, setCanalFilter] = useState<'tous' | DemandeCanal>('tous')
  const [urgenceFilter, setUrgenceFilter] = useState<'tous' | NiveauUrgence>('tous')
  const [, bump] = useState(0)
  const onChanged = () => bump((n) => n + 1)

  const { data: categories = [] } = useCategories()
  const { data: clients = [] } = useClients()
  const { data: demandes = [], isLoading } = useDemandes({
    categorie: categorieFilter === 'tous' ? undefined : categorieFilter,
    statut:    statutFilter === 'tous' ? undefined : statutFilter,
    canal:     canalFilter === 'tous' ? undefined : canalFilter,
    urgence:   urgenceFilter === 'tous' ? undefined : urgenceFilter,
  })

  const catLabel = useMemo(() => new Map(categories.map((c) => [c.id, c.libelle])), [categories])
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])
  const quartiers = useMemo(
    () => [...new Set(clients.map((c) => c.quartier).filter((q): q is string => Boolean(q)))].sort(),
    [clients],
  )

  const liste = useMemo(() => {
    if (quartierFilter === 'tous') return demandes
    return demandes.filter((d) => clientById.get(d.client_id)?.quartier === quartierFilter)
  }, [demandes, quartierFilter, clientById])

  const enRetardCount = liste.filter(enRetard).length

  return (
    <div className="space-y-4 lg:space-y-5">
      <ModuleHeader
        titre="Demandes"
        sous={`${liste.length} demande${liste.length > 1 ? 's' : ''}${enRetardCount ? ` · ${enRetardCount} en retard` : ''}`}
      />

      <Section titre="Nouvelle demande">
        <QuickCreateForm onChanged={onChanged} />
      </Section>

      <Section titre={`File des demandes (${liste.length})`}>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <Sel value={categorieFilter} onChange={(e) => setCategorieFilter(e.target.value)}>
            <option value="tous">Toutes catégories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
          </Sel>
          <Sel value={quartierFilter} onChange={(e) => setQuartierFilter(e.target.value)}>
            <option value="tous">Tous quartiers</option>
            {quartiers.map((q) => <option key={q} value={q}>{q}</option>)}
          </Sel>
          <Sel value={statutFilter} onChange={(e) => setStatutFilter(e.target.value as 'tous' | DemandeStatut)}>
            <option value="tous">Tous statuts</option>
            {STATUTS_DEMANDE.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Sel>
          <Sel value={canalFilter} onChange={(e) => setCanalFilter(e.target.value as 'tous' | DemandeCanal)}>
            <option value="tous">Tous canaux</option>
            {(['web', 'whatsapp', 'manuel'] as DemandeCanal[]).map((c) => <option key={c} value={c}>{CANAL_LABELS[c]}</option>)}
          </Sel>
          <Sel value={urgenceFilter} onChange={(e) => setUrgenceFilter(e.target.value as 'tous' | NiveauUrgence)}>
            <option value="tous">Toutes urgences</option>
            {URGENCES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </Sel>
        </div>

        <Table head={['Réf.', 'Client', 'Service', 'Urgence', 'Délai cible', 'Canal', 'Statut', 'Créée le']}>
          {isLoading && <Vide texte="Chargement…" colSpan={8} />}
          {!isLoading && liste.map((d) => {
            const retard = enRetard(d)
            return (
              <tr
                key={d.id}
                onClick={() => navigate(`/demandes/${d.id}`)}
                className={`cursor-pointer hover:bg-muted/40 ${retard ? 'bg-destructive/5' : ''}`}
              >
                <Td className="cell-num font-semibold">
                  <div className="flex items-center gap-1.5">
                    {d.id.slice(0, 8).toUpperCase()}
                    {retard && <Chip tone="bg-destructive text-destructive-foreground border-destructive">En retard</Chip>}
                  </div>
                </Td>
                <Td>{clientById.get(d.client_id)?.nom ?? '—'}</Td>
                <Td>
                  <span className="block">{catLabel.get(d.categorie_id) ?? d.categorie_id}</span>
                  <span className="block max-w-xs truncate text-xs text-muted-foreground">{d.description}</span>
                </Td>
                <Td><Chip tone={ton(URGENCES, d.niveau_urgence)}>{libelle(URGENCES, d.niveau_urgence)}</Chip></Td>
                <Td className={retard ? 'font-semibold text-destructive' : ''}>{resteAvantDelai(d.delai_cible)}</Td>
                <Td className="text-muted-foreground">{CANAL_LABELS[d.canal]}</Td>
                <Td><Chip tone={ton(STATUTS_DEMANDE, d.statut)}>{libelle(STATUTS_DEMANDE, d.statut)}</Chip></Td>
                <Td className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString('fr-FR')}</Td>
              </tr>
            )
          })}
          {!isLoading && liste.length === 0 && <Vide texte="Aucune demande ne correspond à ces filtres." colSpan={8} />}
        </Table>
      </Section>
    </div>
  )
}
