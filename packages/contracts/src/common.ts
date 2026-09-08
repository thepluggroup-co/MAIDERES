/**
 * Enveloppes de réponse communes (master prompt §15). `apps/api` ne les
 * suit pas encore à la lettre partout (souvent `{ data }` / `{ error }`
 * sans `meta`/`code` systématiques) — déclarées ici comme la forme cible,
 * déjà compatible avec ce que les routes renvoient aujourd'hui (un
 * consommateur qui ignore `meta`/`code` continue de fonctionner).
 */
import type { ErrorCode } from './enums'

export type ApiSuccess<T> = { data: T }

export type ApiCollection<T> = {
  data: T[]
  meta?: { page: number; pageSize: number; total: number }
}

export type ApiFailure = {
  error: string
  code?: ErrorCode | string
  details?: unknown
}
