/** Données RBAC métier de MAIDERES, idempotentes. */
import type { SupabaseClient } from '@supabase/supabase-js'

export const SEED_ROLES = [
  { name: 'SUPER_ADMIN', label: 'Administrateur plateforme', description: 'Gouvernance, sécurité et accès total à la plateforme.' },
  { name: 'OPS_MANAGER', label: 'Responsable opérations', description: 'Pilote les opérations, les incidents et les performances.' },
  { name: 'DISPATCHER', label: 'Opérateur de mise en relation', description: 'Traite les demandes, réalise le matching et suit les interventions.' },
  { name: 'PARTNER_MANAGER', label: 'Gestionnaire prestataires', description: 'Recrute, qualifie et accompagne les prestataires partenaires.' },
  { name: 'FINANCE_MANAGER', label: 'Gestionnaire des reversements', description: 'Contrôle les transactions, commissions et reversements.' },
  { name: 'AUDITOR', label: 'Consultation interne', description: 'Consulte les rapports et journaux autorisés, sans action opérationnelle.' },
] as const

const MODULES = ['DEMANDES','MATCHING','PRESTATAIRES','CLIENTS','INTERVENTIONS','TRANSACTIONS','REVERSEMENTS','PARAMETRAGE','UTILISATEURS','REPORTS','AUDIT'] as const
const ACTIONS = ['READ','CREATE','UPDATE','DELETE','VALIDATE','CONFIGURE','EXPORT'] as const
type Module = typeof MODULES[number]
type Action = typeof ACTIONS[number]
type Permission = { module: Module; action: Action }

const make = (module: Module, actions: Action[]): Permission[] => actions.map(action => ({ module, action }))

export const ROLE_PERMISSIONS_MATRIX: Record<string, Permission[]> = {
  SUPER_ADMIN: MODULES.flatMap(module => make(module, [...ACTIONS])),
  OPS_MANAGER: [
    ...['DEMANDES','MATCHING','PRESTATAIRES','CLIENTS','INTERVENTIONS'].flatMap(module => make(module as Module, ['READ','CREATE','UPDATE','VALIDATE','EXPORT'])),
    ...['TRANSACTIONS','REVERSEMENTS'].flatMap(module => make(module as Module, ['READ','EXPORT'])),
    ...make('PARAMETRAGE', ['READ','UPDATE']), ...make('REPORTS', ['READ','EXPORT']),
  ],
  DISPATCHER: [
    ...['DEMANDES','MATCHING'].flatMap(module => make(module as Module, ['READ','CREATE','UPDATE','VALIDATE'])),
    ...make('PRESTATAIRES', ['READ','UPDATE']), ...make('CLIENTS', ['READ','CREATE','UPDATE']),
    ...make('INTERVENTIONS', ['READ','UPDATE']), ...make('REPORTS', ['READ']),
  ],
  PARTNER_MANAGER: [
    ...make('PRESTATAIRES', ['READ','CREATE','UPDATE','VALIDATE']),
    ...['DEMANDES','MATCHING','INTERVENTIONS'].flatMap(module => make(module as Module, ['READ'])),
    ...make('REPORTS', ['READ']),
  ],
  FINANCE_MANAGER: [
    ...make('TRANSACTIONS', ['READ','VALIDATE','EXPORT']),
    ...make('REVERSEMENTS', ['READ','UPDATE','VALIDATE','EXPORT']), ...make('REPORTS', ['READ','EXPORT']),
  ],
  AUDITOR: [...make('REPORTS', ['READ']), ...make('AUDIT', ['READ'])],
}

export const IMMUTABLE_PERMISSIONS = [
  { module: 'UTILISATEURS', action: 'CONFIGURE' },
  { module: 'AUDIT', action: 'DELETE' },
] as const

export async function runRbacSeed(db: SupabaseClient): Promise<void> {
  const { data: roles, error: rolesError } = await db.from('rbac_roles')
    .upsert(SEED_ROLES.map(role => ({ ...role, is_system: true })), { onConflict: 'name' }).select('id, name')
  if (rolesError) throw new Error(`Erreur seed rôles : ${rolesError.message}`)

  const catalog = MODULES.flatMap(module => ACTIONS.map(action => ({
    module, action, label: `${action} — ${module}`,
    is_immutable: IMMUTABLE_PERMISSIONS.some(item => item.module === module && item.action === action),
  })))
  const { data: dbPermissions, error: permissionsError } = await db.from('rbac_permissions')
    .upsert(catalog, { onConflict: 'module,action' }).select('id, module, action')
  if (permissionsError) throw new Error(`Erreur seed permissions : ${permissionsError.message}`)

  const roleIds = new Map((roles ?? []).map((role: { id: string; name: string }) => [role.name, role.id]))
  const permissionIds = new Map((dbPermissions ?? []).map((permission: { id: string; module: string; action: string }) => [`${permission.module}:${permission.action}`, permission.id]))
  const assignments = Object.entries(ROLE_PERMISSIONS_MATRIX).flatMap(([roleName, rolePermissions]) => rolePermissions.map(({ module, action }) => ({
    role_id: roleIds.get(roleName), permission_id: permissionIds.get(`${module}:${action}`),
  }))).filter((row): row is { role_id: string; permission_id: string } => Boolean(row.role_id && row.permission_id))

  const activeRoleIds = [...roleIds.values()]
  const { error: deleteError } = await db.from('rbac_role_permissions').delete().in('role_id', activeRoleIds)
  if (deleteError) throw new Error(`Erreur nettoyage permissions : ${deleteError.message}`)
  const { error: assignmentError } = await db.from('rbac_role_permissions').insert(assignments)
  if (assignmentError) throw new Error(`Erreur seed affectations : ${assignmentError.message}`)

  const { error: settingsError } = await db.from('rbac_security_settings').upsert({ id: 'singleton' }, { onConflict: 'id' })
  if (settingsError) throw new Error(`Erreur seed sécurité : ${settingsError.message}`)
}
