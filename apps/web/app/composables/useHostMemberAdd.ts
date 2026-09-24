export function useHostMemberAdd() {
  const open = useState('host-member-add-open', () => false)
  const revision = useState('host-members-revision', () => 0)

  function openMemberAdd() {
    useHostNav().close()
    open.value = true
  }

  function closeMemberAdd() {
    open.value = false
  }

  function noteMembersChanged() {
    revision.value += 1
  }

  return { open, revision, openMemberAdd, closeMemberAdd, noteMembersChanged }
}
