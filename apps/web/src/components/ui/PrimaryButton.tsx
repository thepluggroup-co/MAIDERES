/**
 * PrimaryButton — apps/web/src/components/ui/PrimaryButton.tsx
 *
 * Côté ERP, --primary EST déjà le doré (cf. index.css), donc ce composant
 * est un simple alias sémantique de <Button variant="default"> — mais
 * nommé explicitement pour que le code se lise comme la charte se lit
 * ("un seul PrimaryButton par écran"), et pour porter un garde-fou dev qui
 * prévient si plusieurs sont montés en même temps.
 *
 * Limite honnête du garde-fou : il compte les instances montées dans TOUT
 * le DOM, pas "par écran" au sens visuel — un modal + la page derrière
 * comptent comme 2. Utile en dev pour attraper l'oubli le plus courant
 * (deux CTA dorés sur la même page), pas une preuve formelle de conformité.
 */
import * as React from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'

let mountedCount = 0

export const PrimaryButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  (props, ref) => {
    React.useEffect(() => {
      mountedCount += 1
      if (mountedCount > 1 && process.env.NODE_ENV !== 'production') {
        console.warn(
          `[PrimaryButton] ${mountedCount} boutons dorés montés simultanément — règle d'or #2 : un seul par écran.`,
        )
      }
      return () => {
        mountedCount -= 1
      }
    }, [])

    return <Button ref={ref} variant="default" {...props} />
  },
)
PrimaryButton.displayName = 'PrimaryButton'
