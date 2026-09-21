const AUTH_PATHS = new Set(['/login', '/onboarding'])

export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn } = useUserSession()
  const { data } = await useFetch('/api/auth/status', {
    key: 'owner-auth-status',
  })

  if (loggedIn.value) {
    if (AUTH_PATHS.has(to.path)) {
      return navigateTo('/')
    }
    return
  }

  const dest = data.value?.ownerExists ? '/login' : '/onboarding'
  if (to.path === dest) {
    return
  }
  return navigateTo(dest)
})
