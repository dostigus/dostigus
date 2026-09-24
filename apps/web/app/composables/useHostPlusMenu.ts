export function useHostPlusMenu() {
  const open = useState('host-plus-menu-open', () => false)

  function closePlusMenu() {
    open.value = false
  }

  function togglePlusMenu() {
    open.value = !open.value
  }

  return { open, closePlusMenu, togglePlusMenu }
}
