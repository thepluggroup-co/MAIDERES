/**
 * StatusBadge — remplace packages/ui/src/components/StatusBadge.tsx
 *
 * Écarts corrigés vs l'ancienne version (audit étape 1) :
 *  - Statuts réels (mirroir de packages/contracts/src/enums.ts, lui-même
 *    mirroir de packages/db/src/schema.pg.ts) au lieu de stock/bon/crédit/
 *    commande boutique, qui n'existent pas dans le métier MAIDERES.
 *  - Couleurs issues des tokens de la charte (--success/--warning/--info/
 *    --destructive, déjà définis dans apps/web/src/index.css) au lieu de
 *    hex codés en dur.
 *  - Icône systématique : règle absolue de la charte "couleur + libellé +
 *    icône toujours ensemble". Il n'y a plus de façon d'afficher le badge
 *    sans les trois.
 *
 * ⚠️ Point ouvert, pas tranché ici : la charte définit 4 états (succès/
 * attente/cours/litige) mais plusieurs statuts réels sont des annulations
 * ou reports neutres (ex. demande 'annulee', intervention 'reportee') —
 * ni un succès, ni une erreur. Je les mappe sur un 5e bucket "neutre" qui
 * réutilise --secondary/--muted (déjà dans les tokens, aucune nouvelle
 * couleur introduite) plutôt que de forcer un faux "litige". À valider :
 * est-ce que ça convient, ou faut-il une vraie couleur "neutre" dans la
 * charte ?
 */
import React from 'react'
import { CheckCircle2, Clock3, Loader2, AlertTriangle, MinusCircle, type LucideIcon } from 'lucide-react'

export type StatusBucket = 'succes' | 'attente' | 'cours' | 'litige' | 'neutre'

const BUCKET_STYLE: Record<StatusBucket, { className: string; icon: LucideIcon }> = {
  succes:  { className: 'bg-success text-success-foreground',   icon: CheckCircle2 },
  attente: { className: 'bg-warning text-warning-foreground',   icon: Clock3 },
  cours:   { className: 'bg-info text-info-foreground',         icon: Loader2 },
  litige:  { className: 'bg-destructive text-destructive-foreground', icon: AlertTriangle },
  neutre:  { className: 'bg-secondary text-secondary-foreground', icon: MinusCircle },
}

interface StatusDef { label: string; bucket: StatusBucket }
type StatusMap = Record<string, StatusDef>

// ─── Demandes (packages/contracts/src/enums.ts → DemandeStatutSchema) ────
export const DEMANDE_STATUS_MAP: StatusMap = {
  nouvelle:      { label: 'Nouvelle',      bucket: 'attente' },
  en_traitement: { label: 'En traitement', bucket: 'cours' },
  matchee:       { label: 'Matchée',       bucket: 'cours' },
  en_cours:      { label: 'En cours',      bucket: 'cours' },
  realisee:      { label: 'Réalisée',      bucket: 'succes' },
  annulee:       { label: 'Annulée',       bucket: 'neutre' },
}

// ─── Matching (MatchingStatutSchema) ──────────────────────────────────────
export const MATCHING_STATUS_MAP: StatusMap = {
  propose:  { label: 'Proposé',  bucket: 'attente' },
  accepte:  { label: 'Accepté',  bucket: 'cours' },
  refuse:   { label: 'Refusé',   bucket: 'litige' },
  realise:  { label: 'Réalisé',  bucket: 'succes' },
  echoue:   { label: 'Échoué',   bucket: 'litige' },
}

// ─── Interventions (StatutInterventionSchema) ─────────────────────────────
export const INTERVENTION_STATUS_MAP: StatusMap = {
  planifiee: { label: 'Planifiée', bucket: 'attente' },
  en_route:  { label: 'En route',  bucket: 'cours' },
  sur_site:  { label: 'Sur site',  bucket: 'cours' },
  en_cours:  { label: 'En cours',  bucket: 'cours' },
  realisee:  { label: 'Réalisée',  bucket: 'succes' },
  echouee:   { label: 'Échouée',   bucket: 'litige' },
  reportee:  { label: 'Reportée',  bucket: 'neutre' },
  annulee:   { label: 'Annulée',   bucket: 'neutre' },
}

// ─── Paiements (PaiementStatutSchema) ─────────────────────────────────────
export const PAIEMENT_STATUS_MAP: StatusMap = {
  en_attente: { label: 'En attente', bucket: 'attente' },
  paye:       { label: 'Payé',       bucket: 'succes' },
  echoue:     { label: 'Échoué',     bucket: 'litige' },
  rembourse:  { label: 'Remboursé',  bucket: 'neutre' },
}

// ─── Reversements (ReversementStatutSchema) ───────────────────────────────
export const REVERSEMENT_STATUS_MAP: StatusMap = {
  en_attente: { label: 'En attente', bucket: 'attente' },
  traite:     { label: 'Traité',     bucket: 'succes' },
  echoue:     { label: 'Échoué',     bucket: 'litige' },
}

// ─── Prestataires (PrestataireStatutSchema) ───────────────────────────────
export const PRESTATAIRE_STATUS_MAP: StatusMap = {
  en_attente: { label: 'En attente', bucket: 'attente' },
  actif:      { label: 'Actif',      bucket: 'succes' },
  suspendu:   { label: 'Suspendu',   bucket: 'litige' },
}

// ─── Notifications (NotifStatutSchema) ────────────────────────────────────
export const NOTIF_STATUS_MAP: StatusMap = {
  en_attente: { label: 'En attente', bucket: 'attente' },
  envoye:     { label: 'Envoyé',     bucket: 'succes' },
  echoue:     { label: 'Échoué',     bucket: 'litige' },
}

export interface StatusBadgeProps {
  status: string
  map: StatusMap // explicite et obligatoire : jamais de map "combinée" implicite
  className?: string
}

export function StatusBadge({ status, map, className }: StatusBadgeProps) {
  const def = map[status] ?? { label: status, bucket: 'neutre' as const }
  const { className: bucketClass, icon: Icon } = BUCKET_STYLE[def.bucket]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${bucketClass} ${className ?? ''}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {def.label}
    </span>
  )
}

// Usage : <StatusBadge status={demande.statut} map={DEMANDE_STATUS_MAP} />
