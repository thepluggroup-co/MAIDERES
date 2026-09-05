'use client'

import Link from 'next/link'
import { Menu, UserCircle, X } from 'lucide-react'
import { useState } from 'react'
import { MaideresLogo } from '@/components/ui/BrandLogo'

const NAV_LINKS = [
  { href: '/suivi', label: 'Suivre ma demande' },
]

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const whatsapp = '237695884528'

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      <div className="bg-brand-magenta text-white">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-end px-4 text-xs font-semibold sm:px-6 lg:px-8">
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <Link key={link.label} href={link.href} className="hover:text-brand-gold-light">{link.label}</Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="shrink-0">
            <MaideresLogo size={36} variant="color" />
          </Link>

          <div className="flex-1" />

          <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="hidden items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-gray-50 md:flex">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-green-200 bg-green-50 text-green-600">W</span>
            <span className="leading-tight">
              <span className="block font-black text-brand-ink">WhatsApp</span>
              <span className="text-xs text-gray-500">+237 695884528</span>
            </span>
          </a>

          <Link href="/compte/login" className="hidden items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-gray-50 md:flex">
            <UserCircle size={25} className="text-brand-ink" />
            <span className="leading-tight">
              <span className="block font-black text-brand-ink">Mon compte</span>
              <span className="text-xs text-gray-500">Se connecter</span>
            </span>
          </Link>

          <button onClick={() => setMobileOpen((value) => !value)} className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 lg:hidden" aria-label="Menu">
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-b border-gray-200 bg-white px-4 py-4 lg:hidden">
          <nav className="mt-1 grid gap-2">
            {NAV_LINKS.map((link) => (
              <Link key={link.label} href={link.href} onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 text-sm font-bold text-brand-ink hover:bg-brand-magenta-light">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}
