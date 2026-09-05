import React, { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader, StatusBadge, Button, EmptyState } from '@maideres/ui'
import type { StatusMap } from '@maideres/ui'
import { ArrowLeft, Send, CheckCircle2, XCircle, SearchX } from 'lucide-react'
import { useDemande } from '@/hooks/useDemandes'
import { useClients } from '@/hooks/useClients'
import { useCategories } from '@/hooks/useCategories'
import { usePrestataires } from '@/hooks/usePrestataires'
import {
  useMatchings, useProposerMatching, useClolturerMatching,
} from '@/hooks/useMatchings'
import type { MatchingStatut } from '@/hooks/useMatchings'
import { DEMANDE_STATUS_MAP } from './Demandes'

const MATCHING_STATUS_MAP: StatusMap = {
  propose: { label: 'Proposé',  color: '#854F0B', bgColor: '#FAEEDA' },
  accepte: { label: 'Accepté',  color: '#185FA5', bgColor: '#E6F1FB' },
  refuse:  { label: 'Refusé',   color: '#A32D2D', bgColor: '#FCEBEB' },
  realise: { label: 'Réalisé',  color: '#3B6D11', bgColor: '#EAF3DE' },
  echoue:  { label: 'Échoué',   color: '#A32D2D', bgColor: '#FCEBEB' },
}

const OPEN_MATCHING_STATUTS: MatchingStatut[] = ['propose', 'accepte']

function ClotureForm({ matchingId }: { matchingId: string }) {
  const cloturer = useClolturerMatching()
  const [issue, setIssue] = useState<'realise' | 'echoue' | ''>('')
  const [motif, setMotif] = useState('')

  const submit = async () => {
    if (!issue) return
    if (issue === 'echoue' && !motif.trim()) return
    await cloturer.mutateAsync({ id: matchingId, issue, motif_echec: motif.trim() || null })
    setIssue('')
    setMotif('')
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
      <p className="text-xs font-medium text-gray-500">Enregistrer l'issue de la mission</p>
      <div className="flex gap-2">
        <button
          onClick={() => setIssue('realise')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
            issue === 'realise' ? 'bg-green-50 border-green-300 text-green-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Réalisé
        </button>
        <button
          onClick={() => setIssue('echoue')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
            issue === 'echoue' ? 'bg-red-50 border-red-300 text-red-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          <XCircle className="h-3.5 w-3.5" /> Échoué
        </button>
      </div>
      {issue === 'echoue' && (
        <input
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="Motif de l'échec *"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
        />
      )}
      {issue && (
        <Button
          size="sm"
          onClick={submit}
          loading={cloturer.isPending}
          disabled={issue === 'echoue' && !motif.trim()}
        >
          Confirmer la clôture
        </Button>
      )}
    </div>
  )
}

export default function DemandeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: demande, isLoading } = useDemande(id ?? null)
  const { data: clients = [] } = useClients()
  const { data: categories = [] } = useCategories()
  const { data: prestataires = [] } = usePrestataires({ statut: 'actif' })
  const { data: matchings = [] } = useMatchings({ demande_id: id })
  const proposer = useProposerMatching()

  const client = useMemo(() => clients.find((c) => c.id === demande?.client_id), [clients, demande])
  const categorie = useMemo(() => categories.find((c) => c.id === demande?.categorie_id), [categories, demande])

  const prestatairesPertinents = useMemo(() => {
    if (!demande) return []
    const dejaProposes = new Set(matchings.filter((m) => OPEN_MATCHING_STATUTS.includes(m.statut)).map((m) => m.prestataire_id))
    return prestataires
      .filter((p) => p.categories.includes(demande.categorie_id))
      .filter((p) => !dejaProposes.has(p.id))
      .sort((a, b) => {
        const aMemeQuartier = client?.quartier && a.quartier === client.quartier ? 1 : 0
        const bMemeQuartier = client?.quartier && b.quartier === client.quartier ? 1 : 0
        if (aMemeQuartier !== bMemeQuartier) return bMemeQuartier - aMemeQuartier
        return Number(b.note_moyenne) - Number(a.note_moyenne)
      })
  }, [prestataires, demande, matchings, client])

  const matchingsTries = useMemo(
    () => [...matchings].sort((a, b) => b.proposed_at.localeCompare(a.proposed_at)),
    [matchings],
  )

  if (isLoading) return <p className="text-sm text-gray-400">Chargement…</p>
  if (!demande) {
    return (
      <EmptyState
        icon={<SearchX className="h-8 w-8" />}
        title="Demande introuvable"
        description="Cette demande n'existe pas ou n'est plus accessible."
      />
    )
  }

  const peutProposer = demande.statut === 'nouvelle' || demande.statut === 'en_traitement'

  return (
    <div>
      <button onClick={() => navigate('/demandes')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#A82D7E] mb-3">
        <ArrowLeft className="h-4 w-4" /> Retour à la file
      </button>

      <PageHeader
        title={categorie?.libelle ?? 'Demande'}
        subtitle={`Créée le ${new Date(demande.created_at).toLocaleString('fr-FR')}`}
        actions={<StatusBadge status={demande.statut} map={DEMANDE_STATUS_MAP} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Détail demande + client ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Description</h2>
            <p className="text-sm text-foreground">{demande.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-400">Localisation</span><p className="font-medium text-foreground">{demande.localisation ?? '—'}</p></div>
            <div><span className="text-gray-400">Canal</span><p className="font-medium text-foreground capitalize">{demande.canal}</p></div>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Client</h2>
            <p className="text-sm font-medium text-foreground">{client?.nom ?? '—'}</p>
            <p className="text-xs text-gray-500">{client?.telephone} {client?.quartier ? `— ${client.quartier}` : ''}</p>
          </div>
        </div>

        {/* ── Matching ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Matchings</h2>

          {matchingsTries.length === 0 ? (
            <p className="text-sm text-gray-400 mb-4">Aucun prestataire proposé pour l'instant.</p>
          ) : (
            <ul className="space-y-3 mb-4">
              {matchingsTries.map((m) => {
                const p = prestataires.find((pp) => pp.id === m.prestataire_id)
                return (
                  <li key={m.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{p?.nom ?? m.prestataire_id}</span>
                      <StatusBadge status={m.statut} map={MATCHING_STATUS_MAP} />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Proposé le {new Date(m.proposed_at).toLocaleString('fr-FR')}</p>
                    {m.motif_echec && <p className="text-xs text-red-600 mt-1">Motif : {m.motif_echec}</p>}
                    {m.statut === 'accepte' && <ClotureForm matchingId={m.id} />}
                  </li>
                )
              })}
            </ul>
          )}

          {peutProposer && (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Prestataires pertinents ({prestatairesPertinents.length})
              </h3>
              {prestatairesPertinents.length === 0 ? (
                <p className="text-sm text-gray-400">Aucun prestataire actif disponible pour cette catégorie.</p>
              ) : (
                <ul className="space-y-2 max-h-96 overflow-y-auto">
                  {prestatairesPertinents.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 border border-gray-100 rounded-lg p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.nom}</p>
                        <p className="text-xs text-gray-500">
                          {p.quartier ?? '—'} · note {Number(p.note_moyenne).toFixed(1)}
                          {client?.quartier && p.quartier === client.quartier && (
                            <span className="ml-1.5 text-green-600 font-medium">· même quartier</span>
                          )}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => proposer.mutate({ demande_id: demande.id, prestataire_id: p.id })}
                        loading={proposer.isPending}
                      >
                        <Send className="h-3.5 w-3.5 mr-1" /> Proposer
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
