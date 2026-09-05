interface IconProps {
  size?: number
  variant?: 'color' | 'white'
  className?: string
}

interface LogoProps extends IconProps {
  title?: string
  subtitle?: string
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
      <img src="/maideres-icon.svg" alt="MAIDERES" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </span>
  )
}

export function MaideresLogo({ size = 32, className, subtitle }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <img src="/maideres-icon.svg" alt="" style={{ width: size, height: size }} />
      <span className="leading-tight">
        <span className="text-sm font-bold tracking-[0.08em] text-foreground">
          <span className="text-[#254C8C]">MAI</span>
          <span className="text-[#A82D7E]">DERES</span>
        </span>
        {subtitle && <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{subtitle}</span>}
      </span>
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
    </div>
  )
}
