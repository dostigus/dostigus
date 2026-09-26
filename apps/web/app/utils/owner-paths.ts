const OWNER_PATH_ROOTS = ['/dashboard'] as const

/** Dashboard (including Members) stays with the Owner. */
export function isOwnerPath(path: string): boolean {
  return OWNER_PATH_ROOTS.some((root) => path === root || path.startsWith(`${root}/`))
}
