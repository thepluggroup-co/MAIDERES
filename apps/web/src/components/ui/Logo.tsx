/**
 * Logo — apps/web/src/components/ui/Logo.tsx (remplace le fichier existant)
 *
 * Ce qui ne change pas : MaideresIcon (SVG déjà pixel-parfait, cf. audit).
 * Ce qui change : ajout des variantes horizontale/verticale + tagline
 * (manquantes dans la version initiale), et un garde-fou dev pour la zone
 * de protection (taille mini 32px écran, cf. charte).
 *
 * Recommandation, à valider par toi : je garde le wordmark dessiné en code
 * (texte coloré, comme avant) plutôt que d'incruster le PNG officiel que tu
 * as fourni. Raison : le code scale net à toute taille, se recolore pour
 * un fond sombre, et n'a pas l'artefact de détourage du PNG. Le PNG reste
 * disponible via <MaideresLogoLockupOfficial /> plus bas si tu préfères la
 * fidélité pixel exacte au fichier fourni pour certains usages (hero,
 * documents exportés) — les deux options sont dans ce fichier, à toi de
 * choisir où tu utilises laquelle.
 */
import React from 'react'

interface IconProps {
  size?: number
  variant?: 'color' | 'white'
  className?: string
}

function warnIfTooSmall(size: number) {
  if (process.env.NODE_ENV !== 'production' && size < 32) {
    console.warn(`[Logo] taille ${size}px < 32px — sous la zone de protection minimale de la charte (écran).`)
  }
}

export function MaideresIcon({ size = 40, variant = 'color', className }: IconProps) {
  warnIfTooSmall(size)
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        backgroundColor: variant === 'white' ? '#ffffff' : 'transparent',
        borderRadius: variant === 'white' ? 8 : 0,
        padding: variant === 'white' ? size * 0.12 : 0,
      }}
    >
      <img src="/maideres-icon.svg" alt="MAIDERES" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </span>
  )
}

interface LogoProps extends IconProps {
  orientation?: 'horizontal' | 'vertical'
  tagline?: boolean
}

const TAGLINE = 'Tous les services près de chez vous'

export function MaideresLogo({ size = 32, className, orientation = 'horizontal', tagline = false }: LogoProps) {
  warnIfTooSmall(size)
  const wordmark = (
    <span className="leading-tight">
      <span className="text-sm font-bold tracking-[0.08em] text-foreground">
        <span className="text-[#254C8C]">MAI</span>
        <span className="text-[#A82D7E]">DERES</span>
      </span>
      {tagline && (
        <span className="block text-[9px] font-semibold uppercase tracking-wider text-[#254C8C]">{TAGLINE}</span>
      )}
    </span>
  )
  return (
    <span
      className={`inline-flex ${orientation === 'vertical' ? 'flex-col items-center gap-1.5 text-center' : 'items-center gap-2'} ${className ?? ''}`}
    >
      <img src="/maideres-icon.svg" alt="" style={{ width: size, height: size }} />
      {wordmark}
    </span>
  )
}

export function MaideresLogoHero({ variant = 'color' }: Pick<IconProps, 'variant'>) {
  const dark = variant === 'white'
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/95 p-2.5 shadow-sm">
        <img src="/maideres-icon.svg" alt="" style={{ width: '100%', height: '100%' }} />
      </span>
      <span className="text-xl font-bold tracking-[0.1em]">
        <span className={dark ? 'text-[#A9C2E8]' : 'text-[#254C8C]'}>MAI</span>
        <span className={dark ? 'text-[#EFB3D9]' : 'text-[#A82D7E]'}>DERES</span>
      </span>
      <span className={`text-[10px] font-semibold uppercase tracking-widest ${dark ? 'text-white/70' : 'text-[#254C8C]'}`}>
        {TAGLINE}
      </span>
    </div>
  )
}

/**
 * Fidélité pixel exacte au fichier officiel fourni — à copier dans
 * apps/web/public/ (et idéalement demander la source vectorielle au
 * designer/à Lovable pour ne plus dépendre d'un PNG détouré).
 */
export function MaideresLogoLockupOfficial({ width = 200, className }: { width?: number; className?: string }) {
  warnIfTooSmall(width)
  return (
    <img
      src="/maideres-lockup-officiel.png"
      alt="MAIDERES — Tous les services près de chez vous"
      style={{ width, height: 'auto' }}
      className={className}
    />
  )
}
