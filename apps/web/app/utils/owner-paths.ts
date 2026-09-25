const OWNER_PATH_ROOTS = ['/dashboard', '/members'] as const

/** Dashboard and Members stay with the Owner. */
export function isOwnerPath(path: string): boolean {
  return OWNER_PATH_ROOTS.some((root) => path === root || path.startsWith(`${root}/`))
}
