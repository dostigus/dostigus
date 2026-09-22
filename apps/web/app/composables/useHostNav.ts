export function useHostNav() {
  const open = useState('host-nav-open', () => false)
  const narrow = useState('host-nav-narrow', () => false)

  function toggle() {
    open.value = !open.value
  }

  function close() {
    open.value = false
  }

  return { open, narrow, toggle, close }
}
