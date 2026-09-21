<template>
  <div class="shell">
    <header class="top">
      <div>
        <p class="mark">
          Dostigus
        </p>
        <p class="sub">
          Host · Cluster
        </p>
      </div>
      <button
        type="button"
        class="plus"
        aria-label="Create Bot"
        @click="openCreate"
      >
        +
      </button>
    </header>

    <main class="stage">
      <section
        class="list"
        aria-label="Bots"
      >
        <p
          v-if="pending"
          class="status"
        >
          Loading Bots…
        </p>
        <p
          v-else-if="error"
          class="status error"
        >
          Could not load Bots.
        </p>
        <div
          v-else-if="bots.length === 0"
          class="empty"
        >
          <p class="kicker">
            Bots
          </p>
          <h1>No Bots yet</h1>
          <p class="hint">
            Press + to create a Bot. Chat starts with a greeting asking what
            it is for.
          </p>
          <button
            type="button"
            class="ghost"
            @click="openCreate"
          >
            Create Bot
          </button>
        </div>
        <ul
          v-else
          class="bots"
        >
          <li
            v-for="bot in bots"
            :key="bot.id"
          >
            <NuxtLink
              class="bot"
              :to="`/bots/${bot.id}`"
            >
              <span class="bot-name">{{ bot.name }}</span>
              <span class="bot-meta">{{ formatWhen(bot.createdAt) }}</span>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </main>

    <BotCreateDialog
      :open="createOpen"
      @close="createOpen = false"
      @created="onCreated"
    />
  </div>
</template>

<script setup lang="ts">
import type { Bot } from '@dostigus/shared'

useHead({ title: 'Dostigus · Bots' })

const createOpen = ref(false)
const { data, pending, error, refresh } = await useFetch<{ bots: Bot[] }>('/api/bots')

const bots = computed(() => data.value?.bots ?? [])

function openCreate() {
  createOpen.value = true
}

async function onCreated(bot: Bot) {
  createOpen.value = false
  await refresh()
  await navigateTo(`/bots/${bot.id}`)
}

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleString()
}
</script>

<style scoped>
.shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--line);
  background: var(--bg-raised);
}

.mark {
  margin: 0;
  font-size: 1.05rem;
  letter-spacing: 0.04em;
}

.sub {
  margin: 0.2rem 0 0;
  color: var(--muted);
  font-size: 0.85rem;
}

.plus {
  appearance: none;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 999px;
  border: 1px solid var(--accent-dim);
  background: transparent;
  color: var(--ink);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
}

.plus:hover {
  border-color: var(--accent);
}

.stage {
  flex: 1;
  display: flex;
}

.list {
  flex: 1;
  background: var(--bg-chat);
  padding: 1.5rem 1.25rem 3rem;
}

.empty {
  max-width: 26rem;
  margin: 3rem auto 0;
  text-align: center;
}

.kicker {
  margin: 0 0 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  color: var(--accent);
}

h1 {
  margin: 0 0 0.6rem;
  font-size: 1.6rem;
  font-weight: 600;
}

.hint,
.status {
  margin: 0 0 1.25rem;
  color: var(--muted);
  line-height: 1.45;
}

.status.error {
  color: var(--accent);
}

.ghost {
  appearance: none;
  border: 1px solid var(--accent-dim);
  background: transparent;
  color: var(--ink);
  padding: 0.55rem 1rem;
  border-radius: 999px;
  cursor: pointer;
}

.ghost:hover {
  border-color: var(--accent);
}

.bots {
  list-style: none;
  margin: 0 auto;
  padding: 0;
  max-width: 36rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.bot {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--line);
  border-radius: 0.85rem;
  background: var(--bg-raised);
  color: inherit;
  text-decoration: none;
}

.bot:hover {
  border-color: var(--accent-dim);
}

.bot-name {
  font-size: 1.05rem;
}

.bot-meta {
  color: var(--muted);
  font-size: 0.8rem;
  white-space: nowrap;
}
</style>
