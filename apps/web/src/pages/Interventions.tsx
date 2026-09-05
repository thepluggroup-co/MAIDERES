import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Clock3, LogIn, LogOut, CalendarClock } from 'lucide-react'
import { Chip } from '@/components/erp'
import { Txt } from '@/components/erp-form'
import { Button } from '@/components/ui/button'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  useInterventions, useInterventionEvenements, useCheckin, useCheckout,
  useUpdateInterventionStatut, useReporterIntervention,
} from '@/hooks/useInterventions'
import type { Intervention, StatutIntervention, TypeEvenement } from '@/hooks/useInterventions'
import { useMatchings } from '@/hooks/useMatchings'
import { useDemandes } from '@/hooks/useDemandes'
import type { Demande, NiveauUrgence } from '@/hooks/useDemandes'
import { usePrestataires } from '@/hooks/usePrestataires'
import { useClients } from '@/hooks/useClients'
import { useCategories } from '@/hooks/useCategories'
import { useSlaConfig } from '@/hooks/useSlaConfig'

// ── Libellés & tons ────────────────────────────────────────────────────────────

const COLONNES: { statut: StatutIntervention; label: string }[] = [
  { statut: 'planifiee', label: 'Planifiée' },
  { statut: 'en_route',  label: 'En route' },
  { statut: 'sur_site',  label: 'Sur site' },
  { statut: 'en_cours',  label: 'En cours' },
]

const STATUTS_INTERVENTION: { value: StatutIntervention; label: string; tone: string }[] = [
  { value: 'planifiee', label: 'Planifiée', tone: 'bg-info/12 text-info border-info/30' },
  { value: 'en_route',  label: 'En route',  tone: 'bg-warning/15 text-warning-foreground border-warning/40' },
  { value: 'sur_site',  label: 'Sur site',  tone: 'bg-warning/15 text-warning-foreground border-warning/40' },
  { value: 'en_cours',  label: 'En cours',  tone: 'bg-primary/10 text-primary border-primary/25' },
  { value: 'realisee',  label: 'Réalisée',  tone: 'bg-success/12 text-success border-success/30' },
  { value: 'echouee',   label: 'Échouée',   tone: 'bg-destructive/12 text-destructive border-destructive/30' },
  { value: 'reportee',  label: 'Reportée',  tone: 'bg-muted text-muted-foreground border-border' },
  { value: 'annulee',   label: 'Annulée',   tone: 'bg-muted text-muted-foreground border-border' },
]

const URGENCES: { value: NiveauUrgence; label: string; poids: number }[] = [
  { value: 'immediate', label: 'Immédiate', poids: 0 },
  { value: 'urgent',    label: 'Urgent',    poids: 1 },
  { value: 'planifie',  label: 'Planifié',  poids: 2 },
]

const TRANSITIONS: Partial<Record<StatutIntervention, StatutIntervention[]>> = {
  planifiee: ['en_route', 'sur_site'],
  en_route:  ['sur_site'],
  sur_site:  ['en_cours'],
  en_cours:  ['realisee', 'echouee'],
}

const libelle = (list: { value: string; label: string }[], v: string | null | undefined) =>
  v ? (list.find((x) => x.value === v)?.label ?? v) : '—'

const ton = (list: { value: string; label: string; tone: string }[], v: string | null | undefined) =>
  (v ? list.find((x) => x.value === v)?.tone : undefined) ?? 'bg-muted text-muted-foreground border-border'

function resteAvantDelai(delai: string | null | undefined): string {
  if (!delai) return '—'
  const diff = new Date(delai).getTime() - Date.now()
  const abs = Math.abs(diff)
  const hh = Math.floor(abs / 3_600_000)
  const mm = Math.floor((abs % 3_600_000) / 60_000)
  const texte = hh >= 24 ? `${Math.floor(hh / 24)} j ${hh % 24} h` : hh > 0 ? `${hh} h ${mm} min` : `${mm} min`
  return diff < 0 ? `retard ${texte}` : `dans ${texte}`
}

// ── SLA (délais paramétrables via sla_config, jamais en dur) ─────────────────

type EtatSla = 'retard' | 'alerte' | 'ok'

const SLA_TONE: Record<EtatSla, string> = {
  retard: 'bg-destructive/12 text-destructive border-destructive/30',
  alerte: 'bg-warning/15 text-warning-foreground border-warning/40',
  ok:     'bg-success/12 text-success border-success/30',
}
const SLA_LABEL: Record<EtatSla, string> = { retard: 'En retard', alerte: 'À risque', ok: 'Dans les temps' }
const SLA_POIDS: Record<EtatSla, number> = { retard: 0, alerte: 1, ok: 2 }

function useSlaEtat() {
  const { data: slaConfig = [] } = useSlaConfig()
  return (demande: Demande | undefined): EtatSla | null => {
    if (!demande?.delai_cible) return null
    const restantMs = new Date(demande.delai_cible).getTime() - Date.now()
    if (restantMs < 0) return 'retard'
    const cfg = slaConfig.find((s) => s.niveau_urgence === demande.niveau_urgence)
    const seuilMs = (cfg?.seuil_alerte_heures ?? 0) * 3_600_000
    return restantMs <= seuilMs ? 'alerte' : 'ok'
  }
}

// ── Timeline ───────────────────────────────────────────────────────────────────

const TYPE_EVENEMENT_LABEL: Record<TypeEvenement, string> = {
  changement_statut: 'Changement de statut', note: 'Note', checkin: 'Check-in', checkout: 'Check-out', retard: 'Alerte retard',
}

function Timeline({ interventionId }: { interventionId: string }) {
  const { data: evenements = [], isLoading } = useInterventionEvenements(interventionId)
  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>
  if (evenements.length === 0) return <p className="text-sm text-muted-foreground">Aucun événement pour l'instant.</p>
  return (
    <ol className="space-y-3 border-l border-border pl-4">
      {evenements.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
          <p className="text-sm font-medium">
            {TYPE_EVENEMENT_LABEL[e.type]}
            {e.nouveau_statut && (
              <span className="ml-1.5 font-normal text-muted-foreground">
                {e.ancien_statut ? `${libelle(STATUTS_INTERVENTION, e.ancien_statut)} → ` : ''}{libelle(STATUTS_INTERVENTION, e.nouveau_statut)}
              </span>
            )}
          </p>
          {e.commentaire && <p className="text-xs text-muted-foreground">{e.commentaire}</p>}
          {e.localisation && <p className="text-xs text-muted-foreground">📍 {e.localisation}</p>}
          <p className="text-[11px] text-muted-foreground">{new Date(e.created_at).toLocaleString('fr-FR')}</p>
        </li>
      ))}
    </ol>
  )
}

// ── Détail + actions ───────────────────────────────────────────────────────────

function DetailIntervention({ intervention }: { intervention: Intervention }) {
  const checkin = useCheckin()
  const checkout = useCheckout()
  const updateStatut = useUpdateInterventionStatut()
  const reporter = useReporterIntervention()

  const [localisation, setLocalisation] = useState('')
  const [nouveauStatut, setNouveauStatut] = useState('')
  const [issue, setIssue] = useState<'realise' | 'echoue' | ''>('')
  const [dateReport, setDateReport] = useState('')
  const [commentaireReport, setCommentaireReport] = useState('')

  const prochains = TRANSITIONS[intervention.statut] ?? []
  const peutClore = intervention.statut === 'en_cours'
  const peutReporter = !['realisee', 'echouee', 'annulee'].includes(intervention.statut)

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Journal</h3>
        <Timeline interventionId={intervention.id} />
      </div>

      {!intervention.checkin_at && (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-medium text-muted-foreground">Check-in</p>
          <Txt placeholder="Localisation (note libre, pas de GPS)" value={localisation} onChange={(e) => setLocalisation(e.target.value)} />
          <Button size="sm" disabled={checkin.isPending} onClick={() => checkin.mutate({ id: intervention.id, localisation_checkin: localisation.trim() || null })}>
            <LogIn className="mr-1.5 h-3.5 w-3.5" /> Check-in
          </Button>
        </div>
      )}

      {intervention.checkin_at && !intervention.checkout_at && (
        <div className="border-t border-border pt-4">
          <Button size="sm" variant="outline" disabled={checkout.isPending} onClick={() => checkout.mutate(intervention.id)}>
            <LogOut className="mr-1.5 h-3.5 w-3.5" /> Check-out
          </Button>
        </div>
      )}

      {prochains.length > 0 && (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-medium text-muted-foreground">Changer le statut</p>
          <div className="flex flex-wrap gap-1.5">
            {prochains.map((s) => (
              <Button key={s} size="sm" variant="outline" className="h-8 text-xs"
                disabled={updateStatut.isPending}
                onClick={() => updateStatut.mutate({ id: intervention.id, statut: s })}
              >
                {libelle(STATUTS_INTERVENTION, s)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {peutClore && (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-medium text-muted-foreground">Clôturer la mission</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setIssue('realise')}
              className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium ${issue === 'realise' ? 'border-success bg-success/10 text-success' : 'border-input text-muted-foreground'}`}>
              Réalisée
            </button>
            <button type="button" onClick={() => setIssue('echoue')}
              className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium ${issue === 'echoue' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-input text-muted-foreground'}`}>
              Échouée
            </button>
          </div>
          {issue && (
            <Button size="sm" disabled={updateStatut.isPending}
              onClick={() => updateStatut.mutate({ id: intervention.id, statut: issue === 'realise' ? 'realisee' : 'echouee' })}
            >
              Confirmer
            </Button>
          )}
        </div>
      )}

      {peutReporter && (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-medium text-muted-foreground">Reporter l'intervention</p>
          <Txt type="datetime-local" value={dateReport} onChange={(e) => setDateReport(e.target.value)} />
          <Txt placeholder="Motif du report (optionnel)" value={commentaireReport} onChange={(e) => setCommentaireReport(e.target.value)} />
          <Button size="sm" variant="outline" disabled={reporter.isPending || !dateReport} onClick={() => {
            if (!dateReport) { toast.error('Nouvelle date requise'); return }
            reporter.mutate({
              id: intervention.id,
              date_planifiee: new Date(dateReport).toISOString(),
              commentaire: commentaireReport.trim() || null,
            })
            setDateReport('')
            setCommentaireReport('')
          }}>
            <CalendarClock className="mr-1.5 h-3.5 w-3.5" /> Reporter
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Carte kanban ───────────────────────────────────────────────────────────────

function Carte({ intervention, demande, prestataireNom, clientNom, categorieLabel, slaEtat, onOpen }: {
  intervention: Intervention
  demande: Demande | undefined
  prestataireNom: string
  clientNom: string
  categorieLabel: string
  slaEtat: EtatSla | null
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="panel w-full space-y-2 p-3 text-left transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="cell-num text-xs font-semibold text-muted-foreground">{intervention.id.slice(0, 8).toUpperCase()}</span>
        {slaEtat && <Chip tone={SLA_TONE[slaEtat]}>{SLA_LABEL[slaEtat]}</Chip>}
      </div>
      <p className="text-sm font-semibold">{categorieLabel}</p>
      <p className="text-xs text-muted-foreground">{prestataireNom} · {clientNom}</p>
      {demande && (
        <p className={`flex items-center gap-1 text-xs ${slaEtat === 'retard' ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
          {slaEtat === 'retard' ? <AlertTriangle className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
          {resteAvantDelai(demande.delai_cible)}
        </p>
      )}
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Interventions() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: interventions = [], isLoading } = useInterventions()
  const { data: matchings = [] } = useMatchings()
  const { data: demandes = [] } = useDemandes()
  const { data: prestataires = [] } = usePrestataires()
  const { data: clients = [] } = useClients()
  const { data: categories = [] } = useCategories()
  const slaEtatDe = useSlaEtat()

  const matchingById = useMemo(() => new Map(matchings.map((m) => [m.id, m])), [matchings])
  const demandeById = useMemo(() => new Map(demandes.map((d) => [d.id, d])), [demandes])
  const prestataireById = useMemo(() => new Map(prestataires.map((p) => [p.id, p])), [prestataires])
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])
  const catLabel = useMemo(() => new Map(categories.map((c) => [c.id, c.libelle])), [categories])

  const contexte = (intervention: Intervention) => {
    const matching = matchingById.get(intervention.matching_id)
    const demande = matching ? demandeById.get(matching.demande_id) : undefined
    const prestataire = matching ? prestataireById.get(matching.prestataire_id) : undefined
    const client = demande ? clientById.get(demande.client_id) : undefined
    return { matching, demande, prestataire, client }
  }

  const triCarte = (a: Intervention, b: Intervention) => {
    const { demande: da } = contexte(a)
    const { demande: db } = contexte(b)
    const sa = SLA_POIDS[slaEtatDe(da) ?? 'ok']
    const sb = SLA_POIDS[slaEtatDe(db) ?? 'ok']
    if (sa !== sb) return sa - sb
    const ua = URGENCES.find((u) => u.value === da?.niveau_urgence)?.poids ?? 9
    const ub = URGENCES.find((u) => u.value === db?.niveau_urgence)?.poids ?? 9
    if (ua !== ub) return ua - ub
    return new Date(da?.created_at ?? a.created_at).getTime() - new Date(db?.created_at ?? b.created_at).getTime()
  }

  const parColonne = useMemo(() => {
    const map = new Map<StatutIntervention, Intervention[]>()
    for (const col of COLONNES) map.set(col.statut, [])
    for (const i of interventions) {
      if (map.has(i.statut)) map.get(i.statut)!.push(i)
    }
    for (const col of COLONNES) map.get(col.statut)!.sort(triCarte)
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interventions, matchings, demandes])

  const alertes = useMemo(() => {
    const actives = interventions.filter((i) => COLONNES.some((c) => c.statut === i.statut))
    const enRetard = actives.filter((i) => slaEtatDe(contexte(i).demande) === 'retard').sort(triCarte)
    const aRisque = actives.filter((i) => slaEtatDe(contexte(i).demande) === 'alerte').sort(triCarte)
    return { enRetard, aRisque }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interventions, matchings, demandes])

  const selected = interventions.find((i) => i.id === selectedId) ?? null
  const selectedCtx = selected ? contexte(selected) : null

  return (
    <div className="space-y-4 lg:space-y-5">
      <div className="border-b border-border pb-4">
        <h1 className="flex items-center gap-2 text-lg font-bold sm:text-xl">
          <span className="h-5 w-[3px] shrink-0 rounded-full bg-accent" />
          Interventions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Suivi terrain — check-in, check-out et clôture. Aucune géolocalisation ni notification ici.
        </p>
      </div>

      {(alertes.enRetard.length > 0 || alertes.aRisque.length > 0) && (
        <div className="panel space-y-3 p-3.5 sm:p-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Alertes SLA</h2>
          {alertes.enRetard.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-destructive">En retard ({alertes.enRetard.length})</p>
              <div className="flex flex-wrap gap-2">
                {alertes.enRetard.map((i) => {
                  const { demande } = contexte(i)
                  return (
                    <button key={i.id} type="button" onClick={() => setSelectedId(i.id)}
                      className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10">
                      {catLabel.get(demande?.categorie_id ?? '') ?? i.id.slice(0, 8)} · {resteAvantDelai(demande?.delai_cible)}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {alertes.aRisque.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-warning-foreground">À risque ({alertes.aRisque.length})</p>
              <div className="flex flex-wrap gap-2">
                {alertes.aRisque.map((i) => {
                  const { demande } = contexte(i)
                  return (
                    <button key={i.id} type="button" onClick={() => setSelectedId(i.id)}
                      className="rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs text-warning-foreground hover:bg-warning/20">
                      {catLabel.get(demande?.categorie_id ?? '') ?? i.id.slice(0, 8)} · {resteAvantDelai(demande?.delai_cible)}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {COLONNES.map((col) => {
            const cartes = parColonne.get(col.statut) ?? []
            return (
              <div key={col.statut} className="panel min-h-[200px] p-3">
                <div className="mb-2.5 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col.label}</h3>
                  <span className="cell-num rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">{cartes.length}</span>
                </div>
                <div className="space-y-2">
                  {cartes.length === 0 && <p className="text-xs text-muted-foreground">Aucune intervention.</p>}
                  {cartes.map((i) => {
                    const { demande, prestataire, client } = contexte(i)
                    return (
                      <Carte
                        key={i.id}
                        intervention={i}
                        demande={demande}
                        prestataireNom={prestataire?.nom ?? '—'}
                        clientNom={client?.nom ?? '—'}
                        categorieLabel={catLabel.get(demande?.categorie_id ?? '') ?? '—'}
                        slaEtat={slaEtatDe(demande)}
                        onOpen={() => setSelectedId(i.id)}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selectedCtx ? (catLabel.get(selectedCtx.demande?.categorie_id ?? '') ?? 'Intervention') : ''}</SheetTitle>
            <SheetDescription>
              {selectedCtx?.prestataire?.nom ?? '—'} · {selectedCtx?.client?.nom ?? '—'}
              {selected && <span className="ml-1.5"><Chip tone={ton(STATUTS_INTERVENTION, selected.statut)}>{libelle(STATUTS_INTERVENTION, selected.statut)}</Chip></span>}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            {selected && <DetailIntervention intervention={selected} />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
