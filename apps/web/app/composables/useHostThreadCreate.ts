export function useHostThreadCreate() {
  const open = useState('host-thread-create-open', () => false)
  const returnTo = useState<string | null>('host-thread-create-return', () => null)
  const route = useRoute()

  function openThreadCreate() {
    if (!open.value) {
      returnTo.value = route.fullPath
    }
    useHostNav().close()
    open.value = true
  }

  function closeThreadCreate() {
    open.value = false
    returnTo.value = null
  }

  async function dismissThreadCreate() {
    const dest = returnTo.value
    open.value = false
    returnTo.value = null
    if (dest && route.fullPath !== dest) {
      await navigateTo(dest)
    }
  }

  return { open, openThreadCreate, closeThreadCreate, dismissThreadCreate }
}
