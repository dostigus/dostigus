export function useHostPlusMenu() {
  const open = useState('host-plus-menu-open', () => false)

  function closePlusMenu() {
    open.value = false
  }

  return { open, closePlusMenu }
}
