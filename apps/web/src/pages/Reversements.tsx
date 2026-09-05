import React, { useMemo, useState } from 'react'
import { ModuleHeader, Kpi, Table, Td, Vide, Chip } from '@/components/erp'
import { Sel } from '@/components/erp-form'
import { Button } from '@/components/ui/button'
import { useReversements, useMarquerReversementPaye } from '@/hooks/useReversements'
import type { Reversement, ReversementStatut } from '@/hooks/useReversements'
import { usePrestataires } from '@/hooks/usePrestataires'
import { useInterventions } from '@/hooks/useInterventions'
import { useMatchings } from '@/hooks/useMatchings'
import { useDemandes } from '@/hooks/useDemandes'
import { useTransactions } from '@/hooks/useTransactions'

// ── Libellés & tons ────────────────────────────────────────────────────────────

const TONS: Record<ReversementStatut, string> = {
  en_attente: 'bg-warning/15 text-warning-foreground border-warning/40',
  traite:     'bg-success/12 text-success border-success/30',
  echoue:     'bg-destructive/12 text-destructive border-destructive/30',
}
const LABELS: Record<ReversementStatut, string> = { en_attente: 'Dû', traite: 'Payé', echoue: 'Échoué' }

const xaf = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`

// ── Résolution du contexte (demande / net / commission) ──────────────────────
//
// reversements n'a pas de matching_id direct : le trigger sync_intervention_statut
// (0009) l'amorce avec ref='intervention:<id>', seul pointeur vers la transaction
// qui porte montant_service/commission_montant (déjà calculée par
// public.calculer_commission, 0011 — jamais recalculée ici). `ref` n'est jamais
// réécrit par l'API, donc ce lien reste valable même après paiement.
const REF_INTERVENTION = /^intervention:(.+)$/

function useContexteReversement() {
  const { data: interventions = [] } = useInterventions()
  const { data: matchings = [] } = useMatchings()
  const { data: demandes = [] } = useDemandes()
  const { data: transactions = [] } = useTransactions()

  const interventionById = useMemo(() => new Map(interventions.map((i) => [i.id, i])), [interventions])
  const matchingById = useMemo(() => new Map(matchings.map((m) => [m.id, m])), [matchings])
  const demandeById = useMemo(() => new Map(demandes.map((d) => [d.id, d])), [demandes])
  const transactionByMatching = useMemo(() => new Map(transactions.map((t) => [t.matching_id, t])), [transactions])

  return (r: Reversement) => {
    const interventionId = r.ref?.match(REF_INTERVENTION)?.[1]
    const intervention = interventionId ? interventionById.get(interventionId) : undefined
    const matching = intervention ? matchingById.get(intervention.matching_id) : undefined
    const demande = matching ? demandeById.get(matching.demande_id) : undefined
    const transaction = matching ? transactionByMatching.get(matching.id) : undefined

    // Payé : le montant net a déjà été calculé et persisté côté serveur au
    // marquage (voir PATCH /:id/marquer-paye) — on l'affiche tel quel plutôt
    // que de le recalculer. Dû : aperçu calculé à la volée pour l'affichage.
    const montantNet = r.statut === 'en_attente'
      ? (transaction ? transaction.montant_service - transaction.commission_montant : null)
      : r.montant
    const commission = transaction?.commission_montant ?? null

    return {
      reference: demande ? demande.id.slice(0, 8).toUpperCase() : '—',
      montantNet,
      commission,
    }
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Reversements() {
  const [filtre, setFiltre] = useState<'tous' | ReversementStatut>('tous')

  const { data: reversements = [], isLoading } = useReversements()
  const { data: prestataires = [] } = usePrestataires()
  const marquerPaye = useMarquerReversementPaye()
  const contexteDe = useContexteReversement()

  const prestataireById = useMemo(() => new Map(prestataires.map((p) => [p.id, p])), [prestataires])

  const dus = useMemo(() => reversements.filter((r) => r.statut === 'en_attente'), [reversements])
  const payes = useMemo(() => reversements.filter((r) => r.statut === 'traite'), [reversements])

  const sommeNet = (list: Reversement[]) =>
    list.reduce((t, r) => t + (contexteDe(r).montantNet ?? 0), 0)
  const sommeCommission = (list: Reversement[]) =>
    list.reduce((t, r) => t + (contexteDe(r).commission ?? 0), 0)

  const liste = filtre === 'tous' ? reversements : reversements.filter((r) => r.statut === filtre)

  return (
    <div className="space-y-4 lg:space-y-5">
      <ModuleHeader
        titre="Reversements"
        sous="Généré automatiquement à la réalisation d'une intervention, selon la règle de commission de la catégorie."
        actions={
          <Sel
            className="w-40"
            value={filtre}
            onChange={(e) => setFiltre(e.target.value as typeof filtre)}
          >
            <option value="tous">Tous</option>
            <option value="en_attente">Dus</option>
            <option value="traite">Payés</option>
            <option value="echoue">Échoués</option>
          </Sel>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="À reverser"
          valeur={xaf(sommeNet(dus))}
          detail={`${dus.length} reversement(s) dû(s)`}
          ton="alerte"
        />
        <Kpi
          label="Commissions dues"
          valeur={xaf(sommeCommission(dus))}
          detail="Marge à encaisser"
        />
        <Kpi
          label="Déjà reversé"
          valeur={xaf(sommeNet(payes))}
          detail={`${payes.length} paiement(s)`}
          ton="succes"
        />
        <Kpi
          label="Commissions encaissées"
          valeur={xaf(sommeCommission(payes))}
          detail="Sur interventions payées"
          ton="succes"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <Table head={['Demande', 'Prestataire', 'Montant net', 'Commission', 'Statut', 'Payé le', '']}>
          {liste.length === 0 ? (
            <Vide texte="Aucun reversement pour ce filtre." colSpan={7} />
          ) : (
            liste.map((r) => {
              const c = contexteDe(r)
              return (
                <tr key={r.id}>
                  <Td className="font-semibold">{c.reference}</Td>
                  <Td>{prestataireById.get(r.prestataire_id)?.nom ?? '—'}</Td>
                  <Td className="cell-num">{c.montantNet !== null ? xaf(c.montantNet) : '—'}</Td>
                  <Td className="cell-num">{c.commission !== null ? xaf(c.commission) : '—'}</Td>
                  <Td>
                    <Chip tone={TONS[r.statut]}>{LABELS[r.statut]}</Chip>
                  </Td>
                  <Td className="text-xs text-muted-foreground">
                    {r.date_paiement ? new Date(r.date_paiement).toLocaleString('fr-FR') : '—'}
                  </Td>
                  <Td>
                    {r.statut === 'en_attente' && (
                      <Button
                        size="sm"
                        disabled={marquerPaye.isPending || c.montantNet === null}
                        onClick={() => marquerPaye.mutate(r.id)}
                      >
                        Marquer payé
                      </Button>
                    )}
                  </Td>
                </tr>
              )
            })
          )}
        </Table>
      )}
    </div>
  )
}
