import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const inputCls =
  'h-10 w-full rounded-md border border-input bg-background px-2.5 text-base outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/25 sm:h-9 sm:text-sm'

export function Champ({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('block space-y-1', className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}

export function Txt(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />
}

export function Sel(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputCls, props.className)} />
}
