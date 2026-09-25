import { isOwnerPath } from '../utils/owner-paths'

const AUTH_PATHS = new Set(['/login', '/onboarding'])

function isInvitePath(path: string): boolean {
  return path === '/invite' || path.startsWith('/invite/')
}

export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, user, clear } = useUserSession()
  const { data, refresh } = await useFetch<{
    ownerExists: boolean
    loggedIn: boolean
  }>('/api/auth/status', {
    key: 'owner-auth-status',
  })
  if (import.meta.client) {
    await refresh()
  }

  if (loggedIn.value && data.value?.loggedIn === false) {
    await clear()
    return navigateTo('/login')
  }

  if (loggedIn.value) {
    if (AUTH_PATHS.has(to.path)) {
      return navigateTo('/')
    }
    if (isInvitePath(to.path)) {
      return
    }
    if (user.value?.role === 'member' && isOwnerPath(to.path)) {
      return navigateTo('/')
    }
    return
  }

  if (isInvitePath(to.path)) {
    return
  }

  const dest = data.value?.ownerExists ? '/login' : '/onboarding'
  if (to.path === dest) {
    return
  }
  return navigateTo(dest)
})
