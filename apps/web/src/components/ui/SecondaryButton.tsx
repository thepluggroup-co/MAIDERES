/**
 * SecondaryButton — apps/web/src/components/ui/SecondaryButton.tsx
 * "Outline indigo" (charte). Pas variant="outline" tel quel : celui-ci
 * hover vers --accent (indigo pâle côté ERP, ok) mais son bord au repos
 * suit --input (neutre), pas l'indigo de marque. On force explicitement
 * la couleur via --ring (déjà = #254C8C indigo dans index.css).
 */
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

export interface SecondaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

export const SecondaryButton = React.forwardRef<HTMLButtonElement, SecondaryButtonProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md h-9 px-4 py-2 text-sm font-medium',
          'border border-[var(--ring)] text-[var(--ring)] bg-transparent',
          'hover:bg-[var(--ring)]/10 transition-colors cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:pointer-events-none disabled:opacity-50',
          className,
        )}
        {...props}
      />
    )
  },
)
SecondaryButton.displayName = 'SecondaryButton'
