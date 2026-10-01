export function useHostAccount() {
  const { user, loggedIn } = useUserSession()
  const { data: status } = useNuxtData<{ account: { admin?: boolean } | null }>('owner-auth-status')
  const isOwner = computed(() => loggedIn.value && user.value?.role !== 'member')
  const isMember = computed(() => user.value?.role === 'member')
  /** Read from `/api/auth/status`, so a promote shows on the next navigation. See ADR 0042. */
  const isAdmin = computed(() => isMember.value && status.value?.account?.admin === true)
  return { user, loggedIn, isOwner, isMember, isAdmin }
}
