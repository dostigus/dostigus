import type { ThreadListItem } from '@dostigus/shared'

export type HostThreadFilter = 'all' | 'caseOpen'

export async function useHostThreads() {
  const { user } = useHostAccount()
  const { data, pending, error, refresh } = await useFetch<{ threads: ThreadListItem[] }>('/api/threads', {
    key: computed(() => `host-threads-${user.value?.id ?? 'anon'}`),
  })
  const threads = computed(() => data.value?.threads ?? [])
  return { threads, pending, error, refresh }
}

/** Messenger list filter (ADR 0044). `caseOpen` asks the Host for `?caseStatus=open`. */
export function useHostCaseInbox() {
  const { user } = useHostAccount()
  const filter = useState<HostThreadFilter>('host-thread-filter', () => 'all')
  const { data, pending, error, execute } = useFetch<{ threads: ThreadListItem[] }>('/api/threads', {
    key: computed(() => `host-threads-case-open-${user.value?.id ?? 'anon'}`),
    query: { caseStatus: 'open' },
    immediate: false,
    watch: false,
  })
  const threads = computed(() => data.value?.threads ?? [])
  return { filter, threads, pending, error, refresh: execute }
}
