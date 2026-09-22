export function useHostCreate() {
  const open = useState('host-create-open', () => false)
  const returnTo = useState<string | null>('host-create-return', () => null)
  const route = useRoute()

  function openCreate() {
    if (!open.value) {
      returnTo.value = route.fullPath
    }
    useHostNav().close()
    open.value = true
  }

  /** Leave the picker for a chosen Bot or a new one. Does not jump backward. */
  function closeCreate() {
    open.value = false
    returnTo.value = null
  }

  /** × and Escape: the pane that was open before the picker. */
  async function dismissCreate() {
    const dest = returnTo.value
    open.value = false
    returnTo.value = null
    if (dest && route.fullPath !== dest) {
      await navigateTo(dest)
    }
  }

  return { open, openCreate, closeCreate, dismissCreate }
}
