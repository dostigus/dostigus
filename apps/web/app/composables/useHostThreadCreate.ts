import type { MessengerThreadKind } from '@dostigus/shared'

export function useHostThreadCreate() {
  const open = useState('host-thread-create-open', () => false)
  const kind = useState<MessengerThreadKind>('host-thread-create-kind', () => 'dm')
  const returnTo = useState<string | null>('host-thread-create-return', () => null)
  const route = useRoute()

  function openThreadCreate(next: MessengerThreadKind) {
    if (!open.value) {
      returnTo.value = route.fullPath
    }
    kind.value = next
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

  return { open, kind, openThreadCreate, closeThreadCreate, dismissThreadCreate }
}
