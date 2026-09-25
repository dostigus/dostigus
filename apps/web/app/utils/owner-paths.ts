const OWNER_PATH_ROOTS = ['/settings', '/members'] as const

/** `/settings`, every `/settings/...` page, and Members stay with the Owner. */
export function isOwnerPath(path: string): boolean {
  return OWNER_PATH_ROOTS.some((root) => path === root || path.startsWith(`${root}/`))
}
