export const ROOT_EMAIL = 'cameronhodgesit@gmail.com'

export type AppRole = 'root' | 'gm' | 'ops' | 'am' | 'ct'

export const ROLE_LABELS: Record<AppRole, string> = {
  root: 'Root Admin',
  gm: 'General Manager',
  ops: 'Operations Manager',
  am: 'Area Manager',
  ct: 'Certified Trainer',
}

// Roles that can be assigned via invite (root is hard-coded, never invited)
export const INVITABLE_ROLES: AppRole[] = ['gm', 'ops', 'am', 'ct']

// Which roles can access each route
export const ROUTE_PERMISSIONS: Record<string, AppRole[]> = {
  '/shift-plan': ['root', 'gm', 'ops', 'am'],
  '/uph-tracker': ['root', 'gm', 'ops'],
  '/cycle-time':  ['root', 'gm', 'ops'],
  '/coaching':    ['root', 'gm', 'ops', 'am', 'ct'],
  '/admin':       ['root', 'gm'],
}

export function canAccess(role: AppRole, path: string): boolean {
  const allowed = ROUTE_PERMISSIONS[path]
  if (!allowed) return true // unlisted routes are open to all authenticated users
  return allowed.includes(role)
}
