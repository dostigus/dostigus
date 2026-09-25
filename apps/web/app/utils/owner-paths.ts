const OWNER_PATH_ROOTS = ['/dashboard', '/settings', '/members'] as const

/** Dashboard, leftover `/settings` redirects, and Members stay with the Owner. */
export function isOwnerPath(path: string): boolean {
  return OWNER_PATH_ROOTS.some((root) => path === root || path.startsWith(`${root}/`))
}
