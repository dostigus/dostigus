import type { ThreadListItem } from '@dostigus/shared'

export async function useHostThreads() {
  const { user } = useHostAccount()
  const { data, pending, error, refresh } = await useFetch<{ threads: ThreadListItem[] }>('/api/threads', {
    key: computed(() => `host-threads-${user.value?.id ?? 'anon'}`),
  })
  const threads = computed(() => data.value?.threads ?? [])
  return { threads, pending, error, refresh }
}
