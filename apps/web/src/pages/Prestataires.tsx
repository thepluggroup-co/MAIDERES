import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ModuleHeader, Section, Table, Td, Vide, Kpi, Chip } from '@/components/erp'
import { Champ, Txt, Sel } from '@/components/erp-form'
import { Button } from '@/components/ui/button'
import {
  usePrestataires, useCreatePrestataire, useUpdatePrestataire, useUpdatePrestataireStatut,
} from '@/hooks/usePrestataires'
import type { Prestataire, PrestataireStatut } from '@/hooks/usePrestataires'
import { useCategories } from '@/hooks/useCategories'
import { useCommissionConfig } from '@/hooks/useCommissionConfig'

// ── Libellés & tons (adaptés au schéma backend : 3 statuts, pas de "vérifié") ──

const STATUTS_PRESTATAIRE: { value: PrestataireStatut; label: string; tone: string }[] = [
  { value: 'en_attente', label: 'En attente', tone: 'bg-warning/15 text-warning-foreground border-warning/40' },
  { value: 'actif',      label: 'Actif',      tone: 'bg-success/12 text-success border-success/30' },
  { value: 'suspendu',   label: 'Suspendu',   tone: 'bg-destructive/12 text-destructive border-destructive/30' },
]

const libelle = (list: { value: string; label: string }[], v: string | null | undefined) =>
  v ? (list.find((x) => x.value === v)?.label ?? v) : '—'

const ton = (list: { value: string; label: string; tone: string }[], v: string | null | undefined) =>
  (v ? list.find((x) => x.value === v)?.tone : undefined) ?? 'bg-muted text-muted-foreground border-border'

/** Seule transition d'activation existante côté backend : en_attente → actif (suspendu hors parcours). */
const PROCHAINE: Partial<Record<PrestataireStatut, { cible: PrestataireStatut; label: string }>> = {
  en_attente: { cible: 'actif', label: 'Valider (en_attente → actif)' },
  suspendu:   { cible: 'actif', label: 'Réactiver' },
}

// ── Formulaire d'onboarding ──────────────────────────────────────────────────

const vide = {
  nom: '', telephone: '', quartier: '', geoloc_lat: '', geoloc_lng: '',
}

function OnboardingForm({ onChanged }: { onChanged: () => void }) {
  const { data: categories = [] } = useCategories()
  const create = useCreatePrestataire()
  const [f, setF] = useState(vide)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const toggleCategorie = (id: string) => {
    setSelectedCategories((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id])
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.nom.trim() || !f.telephone.trim()) {
      toast.error('Nom et téléphone obligatoires')
      return
    }
    await create.mutateAsync({
      nom: f.nom.trim(),
      telephone: f.telephone.trim(),
      categories: selectedCategories,
      quartier: f.quartier.trim() || null,
      geoloc_lat: f.geoloc_lat ? Number(f.geoloc_lat) : null,
      geoloc_lng: f.geoloc_lng ? Number(f.geoloc_lng) : null,
    })
    setF(vide)
    setSelectedCategories([])
    // Nudge explicite du parent — cf. Clients.tsx pour le contexte : dans cet
    // environnement, l'invalidation déclenchée par un composant tiers ne
    // suffit pas toujours à re-render la liste sans un changement d'état
    // dans le composant qui la lit.
    onChanged()
  }

  return (
    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={submit}>
      <Champ label="Nom complet">
        <Txt value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />
      </Champ>
      <Champ label="Téléphone">
        <Txt inputMode="tel" value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} />
      </Champ>
      <Champ label="Quartier de base">
        <Txt value={f.quartier} onChange={(e) => setF({ ...f, quartier: e.target.value })} />
      </Champ>
      {/* Pas de <Champ> ici : c'est un groupe de boutons indépendants (choix multiple),
          pas un unique contrôle de formulaire — <Champ> les enveloppe dans un <label>,
          ce qui casse le calcul du nom accessible de chaque bouton (un <label> n'est
          censé qualifier qu'un seul contrôle). */}
      <div className="sm:col-span-2 lg:col-span-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Métiers / services
        </span>
        <div className="mt-1 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleCategorie(c.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedCategories.includes(c.id)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background text-foreground'
              }`}
            >
              {c.libelle}
            </button>
          ))}
        </div>
      </div>
      <Champ label="Latitude (optionnel)">
        <Txt type="number" inputMode="decimal" step="0.0001" value={f.geoloc_lat} onChange={(e) => setF({ ...f, geoloc_lat: e.target.value })} />
      </Champ>
      <Champ label="Longitude (optionnel)">
        <Txt type="number" inputMode="decimal" step="0.0001" value={f.geoloc_lng} onChange={(e) => setF({ ...f, geoloc_lng: e.target.value })} />
      </Champ>
      <div className="flex items-end sm:col-span-2 lg:col-span-3">
        <Button type="submit" className="w-full sm:w-auto" disabled={create.isPending}>
          Ajouter au réseau
        </Button>
      </div>
    </form>
  )
}

// ── Actions de validation de statut ───────────────────────────────────────────

function ActionsValidation({ p, onChanged }: { p: Prestataire; onChanged: () => void }) {
  const updateStatut = useUpdatePrestataireStatut()
  const suivant = PROCHAINE[p.statut]
  const set = (statut: PrestataireStatut) =>
    updateStatut.mutate({ id: p.id, statut }, { onSuccess: onChanged })
  return (
    <div className="flex flex-wrap gap-1.5">
      {suivant && (
        <Button size="sm" className="h-8 text-xs" onClick={() => set(suivant.cible)}>
          {suivant.label}
        </Button>
      )}
      {p.statut !== 'suspendu' && (
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => set('suspendu')}>
          Suspendre
        </Button>
      )}
    </div>
  )
}

// ── Résolution de la commission effective (aucune valeur en dur) ─────────────

function useCommissionAffichee(p: Prestataire) {
  const { data: regles = [] } = useCommissionConfig()
  return useMemo(() => {
    if (p.taux_commission !== null) return `${Number(p.taux_commission)} % (override)`
    const parCategorie = regles.find((r) => r.actif && r.categorie_id && p.categories.includes(r.categorie_id))
    const globale = regles.find((r) => r.actif && r.categorie_id === null)
    const regle = parCategorie ?? globale
    if (!regle) return 'Aucune règle définie'
    const valeur = regle.type === 'pourcentage' ? `${Number(regle.valeur)} %` : `${Number(regle.valeur).toLocaleString('fr-FR')} FCFA`
    return `${valeur} (règle par défaut)`
  }, [p, regles])
}

function CommissionCell({ p, onChanged }: { p: Prestataire; onChanged: () => void }) {
  const affichee = useCommissionAffichee(p)
  const update = useUpdatePrestataire()
  const [edition, setEdition] = useState(false)
  const [valeur, setValeur] = useState(p.taux_commission ?? '')

  if (!edition) {
    return (
      <div className="flex items-center gap-1.5">
        <span>{affichee}</span>
        <button type="button" title="Modifier la commission" onClick={() => { setValeur(p.taux_commission ?? ''); setEdition(true) }}
          className="text-[11px] font-medium text-primary hover:underline">
          modifier
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number" min={0} max={100} step="0.1" value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        placeholder="défaut"
        className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm"
      />
      <Button size="sm" className="h-8 text-xs" onClick={async () => {
        await update.mutateAsync({ id: p.id, taux_commission: valeur === '' ? null : Number(valeur) })
        setEdition(false)
        onChanged()
      }}>
        Enregistrer
      </Button>
      <button type="button" className="text-[11px] text-muted-foreground hover:underline" onClick={() => setEdition(false)}>
        Annuler
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Prestataires() {
  const [categorieFilter, setCategorieFilter] = useState('tous')
  const [quartierFilter, setQuartierFilter] = useState('tous')
  const [statutFilter, setStatutFilter] = useState<'tous' | PrestataireStatut>('tous')
  const [recherche, setRecherche] = useState('')
  const [detail, setDetail] = useState<string | null>(null)
  const [, bump] = useState(0)
  const onChanged = () => bump((n) => n + 1)

  const { data: categories = [] } = useCategories()
  const { data: prestataires = [], isLoading } = usePrestataires({
    categorie: categorieFilter === 'tous' ? undefined : categorieFilter,
    quartier:  quartierFilter === 'tous' ? undefined : quartierFilter,
    statut:    statutFilter === 'tous' ? undefined : statutFilter,
  })

  const catLabel = useMemo(() => new Map(categories.map((c) => [c.id, c.libelle])), [categories])
  const quartiers = useMemo(
    () => [...new Set(prestataires.map((p) => p.quartier).filter((q): q is string => Boolean(q)))].sort(),
    [prestataires],
  )
  const compte = (s: PrestataireStatut) => prestataires.filter((p) => p.statut === s).length

  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    if (!q) return prestataires
    return prestataires.filter((p) =>
      `${p.nom} ${p.telephone} ${p.quartier ?? ''}`.toLowerCase().includes(q),
    )
  }, [prestataires, recherche])

  const fiche = prestataires.find((p) => p.id === detail) ?? null

  return (
    <div className="space-y-4 lg:space-y-5">
      <ModuleHeader titre="Prestataires" sous={`${compte('actif')} actifs · ${prestataires.length} fiches au total`} />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Kpi label="En attente" valeur={String(compte('en_attente'))} detail="À valider" ton="alerte" />
        <Kpi label="Actifs" valeur={String(compte('actif'))} ton="succes" />
        <Kpi label="Suspendus" valeur={String(compte('suspendu'))} detail="Hors réseau" />
        <Kpi label="Total" valeur={String(prestataires.length)} />
      </div>

      <Section titre="Enregistrer un prestataire">
        <OnboardingForm onChanged={onChanged} />
      </Section>

      <Section titre={`Réseau (${liste.length})`}>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <Txt placeholder="Rechercher nom, téléphone, quartier…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          <Sel value={categorieFilter} onChange={(e) => setCategorieFilter(e.target.value)}>
            <option value="tous">Tous les métiers</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
          </Sel>
          <Sel value={quartierFilter} onChange={(e) => setQuartierFilter(e.target.value)}>
            <option value="tous">Tous les quartiers</option>
            {quartiers.map((q) => <option key={q} value={q}>{q}</option>)}
          </Sel>
        </div>
        <div className="mt-3">
          <Sel value={statutFilter} onChange={(e) => setStatutFilter(e.target.value as 'tous' | PrestataireStatut)} className="w-full sm:w-64">
            <option value="tous">Tous les statuts</option>
            {STATUTS_PRESTATAIRE.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Sel>
        </div>

        <Table head={['Nom', 'Métiers', 'Contact', 'Quartier', 'Note', 'Commission', 'Statut', 'Validation', '']}>
          {isLoading && <Vide texte="Chargement…" colSpan={9} />}
          {!isLoading && liste.map((p) => (
            <tr key={p.id}>
              <Td className="font-medium">{p.nom}</Td>
              <Td>{p.categories.map((id) => catLabel.get(id) ?? id).join(', ') || '—'}</Td>
              <Td className="cell-num">{p.telephone}</Td>
              <Td className="text-muted-foreground">{p.quartier ?? '—'}</Td>
              <Td className="cell-num">{Number(p.note_moyenne).toFixed(1)}</Td>
              <Td><CommissionCell p={p} onChanged={onChanged} /></Td>
              <Td><Chip tone={ton(STATUTS_PRESTATAIRE, p.statut)}>{libelle(STATUTS_PRESTATAIRE, p.statut)}</Chip></Td>
              <Td><ActionsValidation p={p} onChanged={onChanged} /></Td>
              <Td>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setDetail(p.id === detail ? null : p.id)}>
                  Profil
                </Button>
              </Td>
            </tr>
          ))}
          {!isLoading && liste.length === 0 && <Vide texte="Aucun prestataire." colSpan={9} />}
        </Table>
      </Section>

      {fiche && (
        <Section
          titre={`Profil · ${fiche.nom}`}
          actions={<Button size="sm" variant="ghost" onClick={() => setDetail(null)}>Fermer</Button>}
        >
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Métiers', fiche.categories.map((id) => catLabel.get(id) ?? id).join(', ') || '—'],
              ['Téléphone', fiche.telephone],
              ['Quartier de base', fiche.quartier ?? '—'],
              ['Coordonnées', fiche.geoloc_lat !== null && fiche.geoloc_lng !== null ? `${fiche.geoloc_lat.toFixed(4)}, ${fiche.geoloc_lng.toFixed(4)}` : 'à géolocaliser'],
              ['Note moyenne', `${Number(fiche.note_moyenne).toFixed(1)} / 5`],
              ['Statut', libelle(STATUTS_PRESTATAIRE, fiche.statut)],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
                <dd className="mt-0.5 wrap-break-word text-sm">{v}</dd>
              </div>
            ))}
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Commission</dt>
              <dd className="mt-0.5 wrap-break-word text-sm"><CommissionCell p={fiche} onChanged={onChanged} /></dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-3">
            <ActionsValidation p={fiche} onChanged={onChanged} />
          </div>
        </Section>
      )}
    </div>
  )
}
