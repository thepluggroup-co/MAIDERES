import React, { useMemo, useState } from 'react'
import { Send, CheckCircle2, XCircle } from 'lucide-react'
import { ModuleHeader, Section, Table, Td, Vide, Chip } from '@/components/erp'
import { Button } from '@/components/ui/button'
import { useDemandes } from '@/hooks/useDemandes'
import type { Demande, NiveauUrgence } from '@/hooks/useDemandes'
import { useClients } from '@/hooks/useClients'
import { useCategories } from '@/hooks/useCategories'
import { usePrestataires } from '@/hooks/usePrestataires'
import type { Prestataire } from '@/hooks/usePrestataires'
import {
  useMatchings, useProposerMatching, useClolturerMatching,
} from '@/hooks/useMatchings'
import type { Matching, MatchingStatut } from '@/hooks/useMatchings'

// ── Libellés & tons ────────────────────────────────────────────────────────────

const URGENCES: { value: NiveauUrgence; label: string; tone: string; poids: number }[] = [
  { value: 'immediate', label: 'Immédiate', tone: 'bg-destructive/12 text-destructive border-destructive/30', poids: 0 },
  { value: 'urgent',    label: 'Urgent',    tone: 'bg-warning/15 text-warning-foreground border-warning/40', poids: 1 },
  { value: 'planifie',  label: 'Planifié',  tone: 'bg-info/12 text-info border-info/30', poids: 2 },
]

const STATUTS_MATCHING: { value: MatchingStatut; label: string; tone: string }[] = [
  { value: 'propose', label: 'Proposé', tone: 'bg-info/12 text-info border-info/30' },
  { value: 'accepte', label: 'Accepté', tone: 'bg-success/12 text-success border-success/30' },
  { value: 'refuse',  label: 'Refusé',  tone: 'bg-destructive/12 text-destructive border-destructive/30' },
  { value: 'realise', label: 'Réalisé', tone: 'bg-success/12 text-success border-success/30' },
  { value: 'echoue',  label: 'Échoué',  tone: 'bg-destructive/12 text-destructive border-destructive/30' },
]

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

/** Tri du dispatch : en retard d'abord, puis urgence (immediate > urgent > planifie), puis ancienneté. */
export function triDispatch(a: Demande, b: Demande): number {
  const ra = enRetard(a) ? 0 : 1
  const rb = enRetard(b) ? 0 : 1
  if (ra !== rb) return ra - rb
  const ua = URGENCES.find((u) => u.value === a.niveau_urgence)?.poids ?? 9
  const ub = URGENCES.find((u) => u.value === b.niveau_urgence)?.poids ?? 9
  if (ua !== ub) return ua - ub
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
}

const OPEN_MATCHING_STATUTS: MatchingStatut[] = ['propose', 'accepte']

// ── Formulaire de clôture (réalisé/échoué + motif) ────────────────────────────
// Identique dans l'esprit à DemandeDetail.tsx : ce module doit pouvoir clôturer
// sans quitter la file de dispatch (le but même de l'écran).

function ClotureForm({ matchingId, onChanged }: { matchingId: string; onChanged: () => void }) {
  const cloturer = useClolturerMatching()
  const [issue, setIssue] = useState<'realise' | 'echoue' | ''>('')
  const [motif, setMotif] = useState('')

  const submit = async () => {
    if (!issue) return
    if (issue === 'echoue' && !motif.trim()) return
    await cloturer.mutateAsync({ id: matchingId, issue, motif_echec: motif.trim() || null })
    setIssue('')
    setMotif('')
    onChanged()
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => setIssue('realise')}
        className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
          issue === 'realise' ? 'border-success bg-success/10 text-success' : 'border-input text-muted-foreground hover:bg-muted/50'
        }`}
      >
        <CheckCircle2 className="h-3.5 w-3.5" /> Réalisé
      </button>
      <button
        type="button"
        onClick={() => setIssue('echoue')}
        className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
          issue === 'echoue' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-input text-muted-foreground hover:bg-muted/50'
        }`}
      >
        <XCircle className="h-3.5 w-3.5" /> Échoué
      </button>
      {issue === 'echoue' && (
        <input
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="Motif *"
          className="h-8 w-40 rounded-md border border-input bg-background px-2 text-xs"
        />
      )}
      {issue && (
        <Button size="sm" className="h-8 text-xs" disabled={issue === 'echoue' && !motif.trim()} onClick={submit}>
          Enregistrer l'issue
        </Button>
      )}
    </div>
  )
}

// ── Prestataires pertinents pour la demande sélectionnée ──────────────────────

function candidatsPertinents(
  demande: Demande, prestataires: Prestataire[], matchings: Matching[], quartierClient: string | null | undefined,
): Prestataire[] {
  const dejaProposes = new Set(
    matchings.filter((m) => m.demande_id === demande.id && OPEN_MATCHING_STATUTS.includes(m.statut)).map((m) => m.prestataire_id),
  )
  return prestataires
    .filter((p) => p.categories.includes(demande.categorie_id))
    .filter((p) => !dejaProposes.has(p.id))
    .sort((a, b) => {
      const aMemeQuartier = quartierClient && a.quartier === quartierClient ? 1 : 0
      const bMemeQuartier = quartierClient && b.quartier === quartierClient ? 1 : 0
      if (aMemeQuartier !== bMemeQuartier) return bMemeQuartier - aMemeQuartier
      return Number(b.note_moyenne) - Number(a.note_moyenne)
    })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Dispatch() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [, bump] = useState(0)
  const onChanged = () => bump((n) => n + 1)

  const { data: demandesBrutes = [] } = useDemandes()
  const { data: clients = [] } = useClients()
  const { data: categories = [] } = useCategories()
  const { data: prestataires = [] } = usePrestataires({ statut: 'actif' })
  const { data: matchings = [] } = useMatchings()
  const proposer = useProposerMatching()

  const catLabel = useMemo(() => new Map(categories.map((c) => [c.id, c.libelle])), [categories])
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])
  const prestataireById = useMemo(() => new Map(prestataires.map((p) => [p.id, p])), [prestataires])

  const fileDispatch = useMemo(
    () => demandesBrutes.filter((d) => d.statut === 'nouvelle' || d.statut === 'en_traitement').sort(triDispatch),
    [demandesBrutes],
  )

  const demandeSelectionnee = fileDispatch.find((d) => d.id === selectedId) ?? null
  const clientSelectionne = demandeSelectionnee ? clientById.get(demandeSelectionnee.client_id) : undefined

  const candidats = useMemo(() => {
    if (!demandeSelectionnee) return []
    return candidatsPertinents(demandeSelectionnee, prestataires, matchings, clientSelectionne?.quartier)
  }, [demandeSelectionnee, prestataires, matchings, clientSelectionne])

  const matchingsEnCours = useMemo(
    () => matchings
      .filter((m) => OPEN_MATCHING_STATUTS.includes(m.statut))
      .filter((m) => demandesBrutes.some((d) => d.id === m.demande_id))
      .sort((a, b) => b.proposed_at.localeCompare(a.proposed_at)),
    [matchings, demandesBrutes],
  )

  return (
    <div className="space-y-4 lg:space-y-5">
      <ModuleHeader
        titre="Dispatch"
        sous="File priorisée : demandes en retard d'abord, puis par niveau d'urgence et ancienneté."
      />

      <Section titre={`File de dispatch (${fileDispatch.length})`}>
        <Table head={['Réf.', 'Client', 'Service', 'Quartier', 'Urgence', 'Délai', '']}>
          {fileDispatch.length === 0 ? (
            <Vide texte="File vide — toutes les demandes sont affectées." colSpan={7} />
          ) : (
            fileDispatch.map((d) => {
              const retard = enRetard(d)
              const client = clientById.get(d.client_id)
              return (
                <tr key={d.id} className={`${retard ? 'bg-destructive/5' : ''} ${d.id === selectedId ? 'bg-primary/5' : ''}`}>
                  <Td className="cell-num font-semibold">{d.id.slice(0, 8).toUpperCase()}</Td>
                  <Td>{client?.nom ?? '—'}</Td>
                  <Td>
                    <span className="block">{catLabel.get(d.categorie_id) ?? d.categorie_id}</span>
                    <span className="block max-w-xs truncate text-xs text-muted-foreground">{d.description}</span>
                  </Td>
                  <Td className="text-muted-foreground">{client?.quartier ?? '—'}</Td>
                  <Td><Chip tone={ton(URGENCES, d.niveau_urgence)}>{libelle(URGENCES, d.niveau_urgence)}</Chip></Td>
                  <Td className={retard ? 'font-semibold text-destructive' : ''}>{resteAvantDelai(d.delai_cible)}</Td>
                  <Td>
                    <Button size="sm" variant={d.id === selectedId ? 'secondary' : 'outline'} className="h-7 text-xs"
                      onClick={() => setSelectedId(d.id === selectedId ? null : d.id)}>
                      {d.id === selectedId ? 'Fermer' : 'Dispatcher'}
                    </Button>
                  </Td>
                </tr>
              )
            })
          )}
        </Table>
      </Section>

      {demandeSelectionnee && (
        <Section titre={`Prestataires pertinents — ${catLabel.get(demandeSelectionnee.categorie_id) ?? ''}`}>
          <Table head={['Prestataire', 'Quartier', 'Note', '']}>
            {candidats.length === 0 ? (
              <Vide texte="Aucun prestataire actif disponible sur cette catégorie." colSpan={4} />
            ) : (
              candidats.map((p) => (
                <tr key={p.id}>
                  <Td className="font-medium">{p.nom}</Td>
                  <Td className="text-muted-foreground">
                    {p.quartier ?? '—'}
                    {clientSelectionne?.quartier && p.quartier === clientSelectionne.quartier && (
                      <span className="ml-1.5 text-success font-medium">· même quartier</span>
                    )}
                  </Td>
                  <Td className="cell-num">{Number(p.note_moyenne).toFixed(1)}</Td>
                  <Td>
                    <Button
                      size="sm" className="h-7 text-xs"
                      disabled={proposer.isPending}
                      onClick={() => proposer.mutate({ demande_id: demandeSelectionnee.id, prestataire_id: p.id })}
                    >
                      <Send className="mr-1 h-3 w-3" /> Proposer
                    </Button>
                  </Td>
                </tr>
              ))
            )}
          </Table>
        </Section>
      )}

      <Section titre={`Affectations en cours (${matchingsEnCours.length})`}>
        <Table head={['Demande', 'Prestataire', 'Statut', 'Proposé le', 'Action']}>
          {matchingsEnCours.length === 0 ? (
            <Vide texte="Aucune affectation en cours." colSpan={5} />
          ) : (
            matchingsEnCours.map((m) => (
              <tr key={m.id}>
                <Td className="cell-num font-semibold">{m.demande_id.slice(0, 8).toUpperCase()}</Td>
                <Td>{prestataireById.get(m.prestataire_id)?.nom ?? '—'}</Td>
                <Td><Chip tone={ton(STATUTS_MATCHING, m.statut)}>{libelle(STATUTS_MATCHING, m.statut)}</Chip></Td>
                <Td className="text-xs text-muted-foreground">{new Date(m.proposed_at).toLocaleString('fr-FR')}</Td>
                <Td>
                  {m.statut === 'accepte' ? (
                    <ClotureForm matchingId={m.id} onChanged={onChanged} />
                  ) : (
                    <span className="text-xs text-muted-foreground">En attente de réponse du prestataire</span>
                  )}
                </Td>
              </tr>
            ))
          )}
        </Table>
      </Section>
    </div>
  )
}
