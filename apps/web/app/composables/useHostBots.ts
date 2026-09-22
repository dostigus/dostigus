import type { Bot } from '@dostigus/shared'

export async function useHostBots() {
  const { data, pending, error, refresh } = await useFetch<{ bots: Bot[] }>('/api/bots', {
    key: 'host-bots',
  })
  const bots = computed(() => data.value?.bots ?? [])
  return { bots, pending, error, refresh }
}
