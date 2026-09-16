import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ModuleHeader, Kpi, Section, Table, Td, Vide, Chip } from '@/components/erp'
import { useDemandes } from '@/hooks/useDemandes'
import type { Demande, DemandeStatut, NiveauUrgence } from '@/hooks/useDemandes'
import { useMatchings } from '@/hooks/useMatchings'
import { usePrestataires } from '@/hooks/usePrestataires'
import { useCategories } from '@/hooks/useCategories'
import { useReversements } from '@/hooks/useReversements'
import { useInterventions } from '@/hooks/useInterventions'
import { useTransactions } from '@/hooks/useTransactions'

// ── Libellés & tons (redéfinis localement, comme dans les autres modules —
//    Demandes.tsx, Dispatch.tsx, Interventions.tsx — pas de lib partagée) ────

const STATUTS_DEMANDE: { value: DemandeStatut; label: string; tone: string }[] = [
  { value: 'nouvelle',      label: 'Nouvelle',      tone: 'bg-info/12 text-info border-info/30' },
  { value: 'en_traitement', label: 'En traitement', tone: 'bg-warning/15 text-warning-foreground border-warning/40' },
  { value: 'matchee',       label: 'Matchée',       tone: 'bg-primary/10 text-primary border-primary/25' },
  { value: 'en_cours',      label: 'Intervention en cours', tone: 'bg-primary/10 text-primary border-primary/25' },
  { value: 'realisee',      label: 'Réalisée',      tone: 'bg-success/12 text-success border-success/30' },
  { value: 'annulee',       label: 'Annulée',       tone: 'bg-muted text-muted-foreground border-border' },
]

const URGENCES: { value: NiveauUrgence; label: string; tone: string; poids: number }[] = [
  { value: 'immediate', label: 'Immédiate', tone: 'bg-destructive/12 text-destructive border-destructive/30', poids: 0 },
  { value: 'urgent',    label: 'Urgent',    tone: 'bg-warning/15 text-warning-foreground border-warning/40', poids: 1 },
  { value: 'planifie',  label: 'Planifié',  tone: 'bg-info/12 text-info border-info/30', poids: 2 },
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

function formatDuree(ms: number): string {
  const heures = ms / 3_600_000
  if (heures < 1) return `${Math.round(ms / 60_000)} min`
  if (heures < 48) return `${heures.toFixed(1)} h`
  return `${(heures / 24).toFixed(1)} j`
}

const xaf = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`

/** File prioritaire : en retard d'abord, puis urgence, puis ancienneté — même tri que Dispatch. */
function triPrioritaire(a: Demande, b: Demande): number {
  const ra = enRetard(a) ? 0 : 1
  const rb = enRetard(b) ? 0 : 1
  if (ra !== rb) return ra - rb
  const ua = URGENCES.find((u) => u.value === a.niveau_urgence)?.poids ?? 9
  const ub = URGENCES.find((u) => u.value === b.niveau_urgence)?.poids ?? 9
  if (ua !== ub) return ua - ub
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
}

// ── Commissions dues : même résolution que Reversements.tsx (ref bootstrap
//    'intervention:<id>' amorcé par le trigger 0009 → transaction liée →
//    commission_montant déjà calculée par public.calculer_commission, 0011 —
//    jamais recalculée ici). ────────────────────────────────────────────────
const REF_INTERVENTION = /^intervention:(.+)$/

function useCommissionsDues() {
  const { data: reversements = [] } = useReversements({ statut: 'en_attente' })
  const { data: interventions = [] } = useInterventions()
  const { data: matchings = [] } = useMatchings()
  const { data: transactions = [] } = useTransactions()

  const interventionById = useMemo(() => new Map(interventions.map((i) => [i.id, i])), [interventions])
  const transactionByMatching = useMemo(() => new Map(transactions.map((t) => [t.matching_id, t])), [transactions])

  return useMemo(() => {
    let commission = 0
    let net = 0
    for (const r of reversements) {
      const interventionId = r.ref?.match(REF_INTERVENTION)?.[1]
      const intervention = interventionId ? interventionById.get(interventionId) : undefined
      const transaction = intervention ? transactionByMatching.get(intervention.matching_id) : undefined
      if (!transaction) continue
      commission += transaction.commission_montant
      net += transaction.montant_service - transaction.commission_montant
    }
    return { commission, net }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reversements, interventions, matchings, transactions])
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: demandes = [], isLoading: loadingDemandes } = useDemandes()
  const { data: matchings = [], isLoading: loadingMatchings } = useMatchings()
  const { data: prestataires = [] } = usePrestataires()
  const { data: categories = [] } = useCategories()
  const { commission: commissionsDues, net: aReverser } = useCommissionsDues()

  const loading = loadingDemandes || loadingMatchings

  const kpis = useMemo(() => {
    const enRetardList = demandes.filter(enRetard)
    const aDispatcherList = demandes.filter((d) => d.statut === 'nouvelle' || d.statut === 'en_traitement')

    const debutMois = new Date()
    debutMois.setDate(1)
    debutMois.setHours(0, 0, 0, 0)
    const demandesRealisees = demandes.filter((d) => d.statut === 'realisee')
    const realiseesCeMois = demandesRealisees.filter((d) => {
      const m = matchings.find((mm) => mm.demande_id === d.id && mm.statut === 'realise' && mm.closed_at)
      return m?.closed_at ? new Date(m.closed_at).getTime() >= debutMois.getTime() : false
    })

    const matchingsClotures = matchings.filter((m) => m.statut === 'realise' || m.statut === 'echoue')
    const tauxReussite = matchingsClotures.length
      ? Math.round((matchings.filter((m) => m.statut === 'realise').length / matchingsClotures.length) * 100)
      : null

    const delais: number[] = []
    for (const d of demandesRealisees) {
      const m = matchings.find((mm) => mm.demande_id === d.id && mm.statut === 'realise' && mm.closed_at)
      if (m?.closed_at) delais.push(new Date(m.closed_at).getTime() - new Date(d.created_at).getTime())
    }
    const delaiMoyen = delais.length ? delais.reduce((a, b) => a + b, 0) / delais.length : null

    const catLabel = new Map(categories.map((c) => [c.id, c.libelle]))
    const parCategorie = new Map<string, number>()
    for (const d of demandes) {
      const label = catLabel.get(d.categorie_id) ?? d.categorie_id
      parCategorie.set(label, (parCategorie.get(label) ?? 0) + 1)
    }
    const topCategories = [...parCategorie.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

    const prestataireNom = new Map(prestataires.map((p) => [p.id, p.nom]))
    const parPrestataire = new Map<string, number>()
    for (const m of matchings) {
      if (m.statut !== 'realise') continue
      const label = prestataireNom.get(m.prestataire_id) ?? m.prestataire_id
      parPrestataire.set(label, (parPrestataire.get(label) ?? 0) + 1)
    }
    const topPrestataires = [...parPrestataire.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

    return { enRetardList, aDispatcherList, realiseesCeMois, tauxReussite, delaiMoyen, topCategories, topPrestataires }
  }, [demandes, matchings, categories, prestataires])

  const filePrioritaire = useMemo(
    () => [...kpis.aDispatcherList].sort(triPrioritaire).slice(0, 8),
    [kpis.aDispatcherList],
  )

  return (
    <div className="space-y-4 lg:space-y-5">
      <ModuleHeader
        titre="Tableau de bord"
        sous="Vue opérationnelle du jour — SLA, dispatch et flux financiers."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi
          label="Demandes en retard"
          valeur={loading ? '—' : String(kpis.enRetardList.length)}
          detail="Délai cible dépassé"
          ton={kpis.enRetardList.length ? 'alerte' : 'neutre'}
        />
        <Kpi
          label="À dispatcher"
          valeur={loading ? '—' : String(kpis.aDispatcherList.length)}
          detail="Nouvelles + en traitement"
        />
        <Kpi
          label="Réalisées ce mois"
          valeur={loading ? '—' : String(kpis.realiseesCeMois.length)}
          detail="Interventions clôturées"
          ton="succes"
        />
        <Kpi
          label="Commissions dues"
          valeur={xaf(commissionsDues)}
          detail={`À reverser : ${xaf(aReverser)}`}
        />
        <Kpi
          label="Taux de matching réussi"
          valeur={kpis.tauxReussite === null ? '—' : `${kpis.tauxReussite} %`}
          detail="Matchings clôturés (réalisé / échoué)"
        />
        <Kpi
          label="Délai moyen de traitement"
          valeur={kpis.delaiMoyen === null ? '—' : formatDuree(kpis.delaiMoyen)}
          detail="Création → réalisation"
        />
      </div>

      <Section
        titre="File prioritaire"
        actions={
          <Link to="/dispatch" className="text-xs font-semibold text-primary hover:underline">
            Ouvrir le dispatch
          </Link>
        }
      >
        <Table head={['Référence', 'Urgence', 'Statut', 'Délai', 'Créée le']}>
          {filePrioritaire.length === 0 ? (
            <Vide texte="Aucune demande à dispatcher." colSpan={5} />
          ) : (
            filePrioritaire.map((d) => (
              <tr key={d.id} className={enRetard(d) ? 'bg-destructive/5' : ''}>
                <Td className="cell-num font-semibold">{d.id.slice(0, 8).toUpperCase()}</Td>
                <Td><Chip tone={ton(URGENCES, d.niveau_urgence)}>{libelle(URGENCES, d.niveau_urgence)}</Chip></Td>
                <Td><Chip tone={ton(STATUTS_DEMANDE, d.statut)}>{libelle(STATUTS_DEMANDE, d.statut)}</Chip></Td>
                <Td className={enRetard(d) ? 'font-semibold text-destructive' : ''}>{resteAvantDelai(d.delai_cible)}</Td>
                <Td className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString('fr-FR')}</Td>
              </tr>
            ))
          )}
        </Table>
      </Section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Section titre="Top catégories">
          {kpis.topCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune demande pour l'instant.</p>
          ) : (
            <ul className="space-y-2">
              {kpis.topCategories.map(([label, count]) => (
                <li key={label} className="flex items-center justify-between text-sm">
                  <span>{label}</span>
                  <span className="cell-num font-semibold">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section titre="Top prestataires (missions réalisées)">
          {kpis.topPrestataires.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune mission réalisée pour l'instant.</p>
          ) : (
            <ul className="space-y-2">
              {kpis.topPrestataires.map(([label, count]) => (
                <li key={label} className="flex items-center justify-between text-sm">
                  <span>{label}</span>
                  <span className="cell-num font-semibold">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section titre="Répartition par statut">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STATUTS_DEMANDE.map((s) => {
            const n = demandes.filter((d) => d.statut === s.value).length
            const pct = demandes.length ? Math.round((n / demandes.length) * 100) : 0
            return (
              <li key={s.value} className="rounded border border-border px-3 py-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{s.label}</span>
                  <span className="cell-num font-semibold">{n}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      </Section>
    </div>
  )
}
