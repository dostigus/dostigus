export function useHostSearch() {
  const open = useState('host-search-open', () => false)

  function openSearch() {
    useHostNav().close()
    open.value = true
  }

  function closeSearch() {
    open.value = false
  }

  return { open, openSearch, closeSearch }
}
