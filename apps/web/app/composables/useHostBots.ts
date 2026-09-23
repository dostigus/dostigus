import type { BotListItem } from '@dostigus/shared'

export async function useHostBots() {
  const { user } = useHostAccount()
  const { data, pending, error, refresh } = await useFetch<{ bots: BotListItem[] }>('/api/bots', {
    key: computed(() => `host-bots-${user.value?.id ?? 'anon'}`),
  })
  const bots = computed(() => data.value?.bots ?? [])
  return { bots, pending, error, refresh }
}
