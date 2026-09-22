export function useHostAccount() {
  const { user, loggedIn } = useUserSession()
  const isOwner = computed(() => loggedIn.value && user.value?.role !== 'member')
  const isMember = computed(() => user.value?.role === 'member')
  return { user, loggedIn, isOwner, isMember }
}
