import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  BarChart3, Building2, ClipboardList, Cog, Inbox, LogOut, Split, Store, Wallet,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useDemandes } from '@/hooks/useDemandes'
import { cn } from '@/lib/utils'

type AppRole = 'admin' | 'superviseur' | 'operateur' | 'technicien'

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  exact?: boolean
  roles?: AppRole[]     // undefined = tous les rôles
  showRetardBadge?: boolean
}

interface NavGroup {
  titre: string
  items: NavItem[]
}

const GROUPES: NavGroup[] = [
  {
    titre: 'Pilotage',
    items: [
      { to: '/dashboard', label: 'Tableau de bord', icon: BarChart3, exact: true },
    ],
  },
  {
    titre: 'Flux opérationnel',
    items: [
      { to: '/demandes', label: 'Demandes', icon: Inbox },
      { to: '/dispatch', label: 'Dispatch', icon: Split, showRetardBadge: true },
      { to: '/interventions', label: 'Interventions', icon: ClipboardList, showRetardBadge: true },
    ],
  },
  {
    titre: 'Finance',
    items: [
      { to: '/reversements', label: 'Reversements', icon: Wallet },
    ],
  },
  {
    titre: 'Référentiel',
    items: [
      { to: '/clients', label: 'Clients', icon: Building2 },
      { to: '/prestataires', label: 'Prestataires', icon: Store },
      { to: '/admin', label: 'Paramètres', icon: Cog, roles: ['admin'] },
    ],
  },
]

// En retard : délai_cible dépassé (calculé côté API/trigger à partir de
// niveau_urgence + sla_config, cf. packages/db/drizzle/0015) et demande ni
// réalisée ni annulée. Même règle que Demandes.tsx/Dispatch.tsx/Interventions.tsx.
function useCompteEnRetard(): number {
  const { data: demandes = [] } = useDemandes()
  return React.useMemo(() => demandes.filter((d) =>
    Boolean(d.delai_cible) && new Date(d.delai_cible!).getTime() < Date.now() &&
    d.statut !== 'realisee' && d.statut !== 'annulee',
  ).length, [demandes])
}

interface NavListeProps {
  currentRole: AppRole
  compteRetard: number
  onNavigate?: () => void
}

function NavListe({ currentRole, compteRetard, onNavigate }: NavListeProps) {
  return (
    <nav className="mt-6 space-y-5">
      {GROUPES.map((groupe) => {
        const items = groupe.items.filter((item) => !item.roles || item.roles.includes(currentRole))
        if (items.length === 0) return null
        return (
          <div key={groupe.titre}>
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/40">
              {groupe.titre}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center gap-2.5 rounded-md px-2.5 py-2.5 text-[13.5px] lg:py-2 lg:text-[13px]',
                      'text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      isActive &&
                        'bg-sidebar-accent font-semibold text-sidebar-accent-foreground ' +
                        'before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-sidebar-primary',
                    )
                  }
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.showRetardBadge && compteRetard > 0 && (
                    <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                      {compteRetard > 99 ? '99+' : compteRetard}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

interface SidebarProps {
  onNavigate?: () => void
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { user, role: appRole, displayName: authName, signOut } = useAuth()
  const navigate = useNavigate()
  const compteRetard = useCompteEnRetard()

  const currentRole = (appRole ?? 'technicien') as AppRole
  const email = user?.email ?? ''

  const handleSignOut = async () => {
    onNavigate?.()
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-full w-60 shrink-0 flex-col justify-between overflow-y-auto bg-sidebar p-4">
      <div>
        <div className="flex items-center gap-2 px-1 leading-none">
          <img src="/maideres-icon.svg" alt="" className="h-6 w-6 shrink-0" />
          <div>
            <span className="text-base font-bold tracking-[0.08em]">
              <span className="text-[#A9C2E8]">MAI</span>
              <span className="text-[#EFB3D9]">DERES</span>
            </span>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/40">
              Console opérations
            </p>
          </div>
        </div>
        <NavListe currentRole={currentRole} compteRetard={compteRetard} onNavigate={onNavigate} />
      </div>

      <div className="mt-6 border-t border-sidebar-border pt-3">
        {authName && (
          <p className="truncate px-2.5 text-[12px] font-medium text-sidebar-foreground/80">{authName}</p>
        )}
        {email && (
          <p className="truncate px-2.5 pb-1.5 text-[11px] text-sidebar-foreground/50">{email}</p>
        )}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4" /> Se déconnecter
        </button>
      </div>
    </div>
  )
}
