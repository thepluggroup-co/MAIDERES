import React, { lazy, Suspense, Component, useState, useEffect } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { AppShell } from '@/components/layout/AppShell'
import { PREVIEW_MODE } from '@/lib/preview-mode'

// ── Error Boundary global ──────────────────────────────────────────────────────
// Attrape les erreurs non gérées dans l'arbre React et affiche un message
// lisible au lieu d'un écran blanc. Sans ça, un import manquant ou une prop
// undefined plante toute l'app silencieusement.

interface EBState { hasError: boolean; message: string }

class AppErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false, message: '' }

  static getDerivedStateFromError(err: unknown): EBState {
    const message = err instanceof Error ? err.message : String(err)
    return { hasError: true, message }
  }

  componentDidCatch(err: unknown, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', err, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh',
        background: '#1a1a2e', color: '#e0e0e0', fontFamily: 'sans-serif', padding: 40,
      }}>
        <h2 style={{ color: '#ef4444', marginBottom: 16 }}>Une erreur s'est produite</h2>
        <pre style={{
          background: '#2a2a3e', padding: '12px 20px', borderRadius: 8,
          maxWidth: 600, overflowX: 'auto', color: '#fca5a5', fontSize: 13,
        }}>
          {this.state.message}
        </pre>
        <button
          onClick={() => { this.setState({ hasError: false, message: '' }); window.location.href = '/login' }}
          style={{
            marginTop: 24, background: '#ef4444', color: 'white', border: 'none',
            padding: '10px 20px', borderRadius: 6, cursor: 'pointer', fontSize: 14,
          }}
        >
          Retour à la connexion
        </button>
      </div>
    )
  }
}

// Pages
const Login          = lazy(() => import('@/pages/Login'))
const Account        = lazy(() => import('@/pages/Account'))
const AdminSettings  = lazy(() => import('@/pages/AdminSettings'))
const Dashboard      = lazy(() => import('@/pages/Dashboard'))
const Demandes       = lazy(() => import('@/pages/Demandes'))
const DemandeDetail  = lazy(() => import('@/pages/DemandeDetail'))
const Prestataires   = lazy(() => import('@/pages/Prestataires'))
const Clients        = lazy(() => import('@/pages/Clients'))
const Dispatch        = lazy(() => import('@/pages/Dispatch'))
const Interventions   = lazy(() => import('@/pages/Interventions'))
const Reversements    = lazy(() => import('@/pages/Reversements'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )
}

// ── Bannière mode hors-ligne ───────────────────────────────────────────────────

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)
  const [justBack, setJustBack] = useState(false)

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline  = () => {
      setOffline(false)
      setJustBack(true)
      setTimeout(() => setJustBack(false), 4000)
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online',  goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online',  goOnline)
    }
  }, [])

  if (!offline && !justBack) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] text-center py-2 px-4 text-xs font-semibold text-white transition-all"
      style={{ backgroundColor: offline ? '#A32D2D' : '#3B6D11' }}
    >
      {offline
        ? '⚠️ Mode hors-ligne — Les données sont enregistrées localement et synchronisées à la reconnexion.'
        : '✅ Connexion rétablie — Synchronisation en cours…'}
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user && !PREVIEW_MODE) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  )
}

function AppRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<PageLoader />}>
        <Routes location={location} key={location.pathname}>
          {/* Public */}
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

          {/* Redirect racine */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Console d'opérations MAIDERES */}
          <Route path="/dashboard"       element={<Shell><Dashboard /></Shell>} />
          <Route path="/demandes"        element={<Shell><Demandes /></Shell>} />
          <Route path="/demandes/:id"    element={<Shell><DemandeDetail /></Shell>} />
          <Route path="/prestataires"    element={<Shell><Prestataires /></Shell>} />
          <Route path="/clients"         element={<Shell><Clients /></Shell>} />

          <Route path="/dispatch"        element={<Shell><Dispatch /></Shell>} />
          <Route path="/interventions"   element={<Shell><Interventions /></Shell>} />

          <Route path="/reversements"    element={<Shell><Reversements /></Shell>} />

          {/* Account / settings */}
          <Route path="/account" element={<Shell><Account /></Shell>} />
          <Route path="/admin"   element={<Shell><AdminSettings /></Shell>} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <OfflineBanner />
        <AppRoutes />
        <Toaster richColors position="top-right" expand closeButton />
      </AuthProvider>
    </AppErrorBoundary>
  )
}
