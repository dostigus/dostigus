import type { BotListItem } from '@dostigus/shared'

export async function useHostBots() {
  const { data, pending, error, refresh } = await useFetch<{ bots: BotListItem[] }>('/api/bots', {
    key: 'host-bots',
  })
  const bots = computed(() => data.value?.bots ?? [])
  return { bots, pending, error, refresh }
}
