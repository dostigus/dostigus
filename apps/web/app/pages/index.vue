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
      <div class="header-actions">
        <NuxtLink
          to="/settings"
          class="settings"
        >
          Settings
        </NuxtLink>
        <HostLogoutButton />
        <button
          type="button"
          class="plus"
          aria-label="Create Bot"
          @click="openCreate"
        >
          +
        </button>
      </div>
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
            class="solid"
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
  padding: 1.15rem 1.4rem;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}

.mark {
  margin: 0;
  font-size: 1.05rem;
  letter-spacing: 0.04em;
}

.sub {
  margin: 0.2rem 0 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.settings {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.9rem;
}

.settings:hover {
  color: var(--text);
}

.plus {
  appearance: none;
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 999px;
  border: 0;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 1.45rem;
  line-height: 1;
  cursor: pointer;
}

.plus:hover {
  filter: brightness(1.05);
}

.stage {
  flex: 1;
  display: flex;
}

.list {
  flex: 1;
  background: var(--bg);
  padding: 1.75rem 1.4rem 3rem;
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
  color: var(--text-muted);
  line-height: 1.45;
}

.status.error {
  color: var(--accent);
}

.ghost,
.solid {
  appearance: none;
  padding: 0.65rem 1.25rem;
  border-radius: 999px;
  cursor: pointer;
}

.ghost {
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--text);
}

.ghost:hover {
  border-color: var(--accent);
}

.solid {
  border: 0;
  background: var(--accent);
  color: var(--accent-ink);
}

.solid:hover {
  filter: brightness(1.05);
}

.bots {
  list-style: none;
  margin: 0 auto;
  padding: 0;
  max-width: 36rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.bot {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.05rem 1.15rem;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
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
  color: var(--text-muted);
  font-size: 0.8rem;
  white-space: nowrap;
}
</style>
