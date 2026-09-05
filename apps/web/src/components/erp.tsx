import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function ModuleHeader({
  titre,
  sous,
  actions,
}: {
  titre: string
  sous?: string
  actions?: ReactNode
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)] gap-3 border-b border-border pb-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-lg font-bold sm:text-xl">
          <span className="h-5 w-[3px] shrink-0 rounded-full bg-accent" />
          <span className="truncate">{titre}</span>
        </h1>
        {sous && <p className="mt-1 text-sm text-muted-foreground">{sous}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 [&_button]:min-h-9">{actions}</div>}
    </header>
  )
}

export function Kpi({
  label,
  valeur,
  detail,
  ton,
}: {
  label: string
  valeur: string
  detail?: string
  ton?: 'neutre' | 'alerte' | 'succes'
}) {
  return (
    <div className="panel px-3.5 py-3 sm:px-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'cell-num mt-1.5 text-2xl font-bold',
          ton === 'alerte' && 'text-destructive',
          ton === 'succes' && 'text-success',
        )}
      >
        {valeur}
      </p>
      {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
    </div>
  )
}

export function Chip({ children, tone }: { children: ReactNode; tone: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-semibold',
        tone,
      )}
    >
      {children}
    </span>
  )
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left">
            {head.map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  )
}

export function Td({
  children,
  className,
  colSpan,
}: {
  children?: ReactNode
  className?: string
  colSpan?: number
}) {
  return (
    <td colSpan={colSpan} className={cn('px-3 py-2.5 align-middle sm:py-2', className)}>
      {children}
    </td>
  )
}

export function Vide({ texte, colSpan }: { texte: string; colSpan: number }) {
  return (
    <tr>
      <Td colSpan={colSpan} className="py-8 text-center text-sm text-muted-foreground">
        {texte}
      </Td>
    </tr>
  )
}

export function Section({
  titre,
  children,
  actions,
}: {
  titre: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className="panel p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          {titre}
        </h2>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}
