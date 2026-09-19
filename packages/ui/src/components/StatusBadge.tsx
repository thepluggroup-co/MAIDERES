/**
 * StatusBadge — packages/ui/src/components/StatusBadge.tsx
 *
 * ⚠️ Correction sur ma propre erreur de la première version de ce fichier
 * (commit fa4ad2c) : j'avais renommé StatusConfig/StatusMap et changé le
 * rendu (classes Tailwind au lieu de color/bgColor inline), ce qui cassait
 * la compilation de Demandes.tsx, DemandeDetail.tsx et ParametresMetier.tsx
 * — ces trois fichiers utilisent déjà `StatusMap` avec la forme originale
 * {label, color, bgColor} et leurs propres maps locales. Je n'avais pas
 * vérifié ces usages avant de réécrire un type partagé activement importé
 * ailleurs — erreur de méthode de ma part, corrigée ici.
 *
 * Ce qui change réellement par rapport à l'original (fa4ad2c annulé) :
 *  - Suppression de STOCK/BON/CREDIT/ORDER/SHOP_COMMANDE_STATUS_MAP et de
 *    COMBINED_MAP (résidus FORGE-TAFDIL, hors domaine MAIDERES — cf. audit
 *    étape 1). Ce sont ces maps de fallback, pas le composant lui-même,
 *    qui posaient un vrai risque : un <StatusBadge status="annulee" />
 *    sans `map` explicite pouvait tomber sur SHOP_COMMANDE_STATUS_MAP au
 *    lieu d'un statut MAIDERES.
 *  - `StatusConfig` gagne un champ `icon` OPTIONNEL (règle charte :
 *    couleur + libellé + icône). Les maps existantes (qui n'en définissent
 *    pas) continuent de compiler et de s'afficher à l'identique — aucune
 *    régression visuelle. Seules les nouvelles maps ci-dessous en fournissent.
 *  - Le fallback par défaut (sans `map`) devient {} → "Inconnu" plutôt que
 *    de risquer une collision avec un statut d'un autre domaine.
 *
 * Ce qui NE change PAS : StatusBadgeProps, le rendu color/bgColor inline,
 * le nom et la forme de StatusMap — donc zéro changement requis dans
 * Demandes.tsx / DemandeDetail.tsx / ParametresMetier.tsx.
 *
 * ⚠️ Note de fusion (1f4b6c5, commit "marquer l'échantillon pilote") :
 * un correctif minimal parallèle avait ajouté `export` au type StatusMap
 * de l'ancienne architecture (bucket) sans la corriger sur le fond — leur
 * propre message de commit signalait explicitement que le problème
 * 'color' absent de StatusDef restait à traiter. C'est fait ici : cette
 * version (color/bgColor, rétrocompatible) est celle qui reste après
 * fusion, conflit résolu en sa faveur pour cette raison.
 */
import React from 'react'
import type { LucideIcon } from 'lucide-react'

export interface StatusConfig {
  label: string
  color: string
  bgColor: string
  icon?: LucideIcon
}

export type StatusMap = Record<string, StatusConfig>

export interface StatusBadgeProps {
  status: string
  map?: StatusMap
  className?: string
}

const DEFAULT_STATUS: StatusConfig = { label: 'Inconnu', color: '#5F5E5A', bgColor: '#F1EEE9' }

export function StatusBadge({ status, map, className }: StatusBadgeProps) {
  const resolvedMap = map ?? {}
  const config = resolvedMap[status] ?? DEFAULT_STATUS
  const Icon = config.icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${className ?? ''}`}
      style={{ color: config.color, backgroundColor: config.bgColor }}
    >
      {Icon && <Icon className="size-3.5" aria-hidden="true" />}
      {config.label}
    </span>
  )
}
