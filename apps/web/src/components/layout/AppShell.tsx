import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close mobile drawer on resize to desktop
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 1024) setMobileOpen(false) }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-muted/40">
      {/* ── Desktop sidebar — toujours pleine largeur, pas de mode replié (absent de la maquette) ── */}
      <div className="hidden h-full lg:flex">
        <Sidebar />
      </div>

      {/* ── Mobile sidebar drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-foreground/50 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              key="mobile-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
            >
              <div className="relative h-full">
                <button
                  aria-label="Fermer le menu"
                  onClick={() => setMobileOpen(false)}
                  className="absolute right-2 top-2 z-10 rounded-md p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent"
                >
                  <X className="size-4" />
                </button>
                <Sidebar onNavigate={() => setMobileOpen(false)} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onMobileMenuToggle={() => setMobileOpen((v) => !v)} />

        <main className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
