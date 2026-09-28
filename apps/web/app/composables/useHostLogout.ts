export function useHostLogout() {
  const { clear } = useUserSession()
  const busy = ref(false)

  async function logout() {
    if (busy.value) {
      return
    }
    busy.value = true
    try {
      await clear()
      await navigateTo('/login')
    } finally {
      busy.value = false
    }
  }

  return { busy, logout }
}
