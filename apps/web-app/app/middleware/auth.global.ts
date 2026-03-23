export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()

  if (!loggedIn.value && to.path !== '/sign-in') {
    return navigateTo('/sign-in')
  }

  if (loggedIn.value && to.path === '/sign-in') {
    return navigateTo('/')
  }
})
