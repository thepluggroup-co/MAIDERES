import React, { useState, useRef, useEffect } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { Bell, Search, Wifi, WifiOff, Menu, Settings, LogOut, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { OfflineBanner } from '@maideres/ui'

const ROUTE_LABELS: Record<string, string> = {
  dashboard:      'Tableau de bord',
  demandes:       'Demandes',
  dispatch:       'Dispatch',
  interventions:  'Interventions',
  reversements:   'Reversements',
  clients:        'Clients',
  prestataires:   'Prestataires',
  account:        'Mon compte',
  admin:          'Paramètres',
}

// ── Notification panel ─────────────────────────────────────────────────────────
// Alimenté par notifications_log (Phase 6) une fois le back-office métier en place.

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute right-0 top-full mt-2 w-96 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Notifications</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <Bell className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Aucune notification</p>
        </div>
      </div>
    </div>
  )
}

// ── User dropdown ──────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  admin:       'Admin (Patron)',
  superviseur: 'Superviseur',
  operateur:   'Opérateur',
  technicien:  'Technicien',
}

function UserDropdown({ email, displayName, onClose }: { email: string; displayName: string; onClose: () => void }) {
  const navigate  = useNavigate()
  const { signOut, role } = useAuth()

  const go = (path: string) => { navigate(path); onClose() }
  const handleSignOut = async () => { onClose(); await signOut(); navigate('/login') }

  const roleLabel = ROLE_LABELS[role ?? ''] ?? (role ?? 'Utilisateur')

  return (
    <div
      className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-4 py-3 border-b border-border">
        <p className="text-sm font-semibold truncate">{displayName}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{email}</p>
        <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary/10 text-primary">
          {roleLabel}
        </span>
      </div>
      <div className="py-1">
        <button onClick={() => go('/account')}
          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-foreground/80 hover:bg-accent hover:text-accent-foreground transition-colors">
          <Settings className="h-3.5 w-3.5 text-muted-foreground" /> Mon compte
        </button>
        <button onClick={handleSignOut}
          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors">
          <LogOut className="h-3.5 w-3.5" /> Déconnexion
        </button>
      </div>
    </div>
  )
}

// ── TopBar ─────────────────────────────────────────────────────────────────────

interface TopBarProps {
  onMobileMenuToggle: () => void
}

export function TopBar({ onMobileMenuToggle }: TopBarProps) {
  const { user, role, displayName: authName } = useAuth()
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [showNotifs, setShowNotifs] = useState(false)
  const [showUser, setShowUser]     = useState(false)

  const notifsRef = useRef<HTMLDivElement>(null)
  const userRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onOnline  = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) setShowNotifs(false)
      if (userRef.current   && !userRef.current.contains(e.target as Node))   setShowUser(false)
    }
    if (showNotifs || showUser) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [showNotifs, showUser])

  // Close dropdowns on route change
  useEffect(() => {
    setShowNotifs(false)
    setShowUser(false)
  }, [location.pathname])

  const breadcrumbs = [
    { label: 'MAIDERES', path: '/' },
    ...segments.map((seg, i) => ({
      label: ROUTE_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1),
      path: '/' + segments.slice(0, i + 1).join('/'),
    })),
  ]

  const email       = user?.email ?? ''
  const displayName = authName ?? email.split('@')[0] ?? 'Utilisateur'
  const initial     = displayName.charAt(0).toUpperCase()

  return (
    <>
      <header className="shrink-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-4 lg:px-5">
        {/* Mobile: hamburger */}
        <button
          onClick={onMobileMenuToggle}
          className="flex lg:hidden items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb */}
        <nav className="hidden md:flex items-center gap-1 text-sm flex-1 min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={crumb.path}>
              {i > 0 && <span className="text-muted-foreground/50 mx-1">/</span>}
              {i === breadcrumbs.length - 1 ? (
                <span className="font-semibold text-foreground truncate">{crumb.label}</span>
              ) : (
                <Link to={crumb.path} className="text-muted-foreground hover:text-primary transition-colors truncate">
                  {crumb.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Search */}
        <div className="relative flex-1 max-w-xs md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Rechercher..."
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-secondary text-secondary-foreground border border-transparent rounded-md
              placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
              focus:bg-background transition-colors"
          />
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* WiFi status */}
          <div
            className="flex items-center justify-center w-8 h-8 rounded-md"
            title={isOnline ? 'Connecté' : 'Hors ligne'}
          >
            {isOnline
              ? <Wifi    className="h-4 w-4 text-success" />
              : <WifiOff className="h-4 w-4 text-destructive" />}
          </div>

          {/* Notifications bell */}
          <div ref={notifsRef} className="relative">
            <button
              onClick={() => { setShowNotifs((v) => !v); setShowUser(false) }}
              className="relative flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
            </button>
            {showNotifs && <NotificationsPanel onClose={() => setShowNotifs(false)} />}
          </div>

          {/* User avatar */}
          <div ref={userRef} className="relative">
            <button
              onClick={() => { setShowUser((v) => !v); setShowNotifs(false) }}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-semibold shrink-0"
              title={`${email}${role ? ` — ${ROLE_LABELS[role] ?? role}` : ''}`}
              aria-label="Menu utilisateur"
            >
              {initial}
            </button>
            {showUser && (
              <UserDropdown email={email} displayName={displayName} onClose={() => setShowUser(false)} />
            )}
          </div>
        </div>
      </header>

      {/* Offline banner flows directly below the sticky header */}
      <OfflineBanner />
    </>
  )
}
