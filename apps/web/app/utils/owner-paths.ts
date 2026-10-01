const OWNER_PATH_ROOTS = ['/dashboard'] as const

/** Dashboard pages an Admin may open. Cluster settings and Account Settings stay Owner (ADR 0042). */
const ADMIN_PATHS = new Set(['/dashboard', '/dashboard/providers', '/dashboard/members'])

/** Dashboard (including Members) stays with the Owner, except the Admin pages below. */
export function isOwnerPath(path: string): boolean {
  return OWNER_PATH_ROOTS.some((root) => path === root || path.startsWith(`${root}/`))
}

export function isAdminPath(path: string): boolean {
  const trimmed = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
  return ADMIN_PATHS.has(trimmed)
}
