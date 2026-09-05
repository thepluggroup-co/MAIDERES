'use client'

interface IconProps {
  size?: number
  variant?: 'color' | 'white'
  className?: string
}

interface LogoProps extends IconProps {
  showText?: boolean
}

export function MaideresIcon({ size = 40, variant = 'color', className }: IconProps) {
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/maideres-icon.svg" alt="MAIDERES" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </span>
  )
}

export function MaideresLogo({ size = 32, variant = 'color', className }: LogoProps) {
  const light = variant === 'white'
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/maideres-icon.svg" alt="" style={{ width: size, height: size }} />
      <span className="font-display text-sm font-bold tracking-[0.06em]">
        <span className={light ? 'text-white' : 'text-brand-indigo'}>MAI</span>
        <span className={light ? 'text-white/70' : 'text-brand-magenta'}>DERES</span>
      </span>
    </span>
  )
}

export function MaideresHeaderLogo({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/maideres-icon.svg" alt="MAIDERES" style={{ width: 32, height: 32 }} />
      <span className="font-display text-sm font-bold tracking-[0.06em]">
        <span className="text-brand-indigo">MAI</span>
        <span className="text-brand-magenta">DERES</span>
        {label && <span className="ml-1 font-sans text-xs font-medium text-brand-ink-soft">{label}</span>}
      </span>
    </span>
  )
}
