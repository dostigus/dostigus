export function useHostCreate() {
  const open = useState('host-create-open', () => false)

  function openCreate() {
    useHostNav().close()
    open.value = true
  }

  function closeCreate() {
    open.value = false
  }

  return { open, openCreate, closeCreate }
}
