<template>
  <div class="shell">
    <header class="top">
      <HostMark sub="Bots" />
      <div class="header-actions">
        <NuxtLink
          v-if="isOwner"
          to="/members"
          class="settings"
        >
          Members
        </NuxtLink>
        <NuxtLink
          v-if="isOwner"
          to="/settings"
          class="settings"
        >
          Settings
        </NuxtLink>
        <HostLogoutButton />
        <KitButton
          v-if="isOwner"
          variant="icon"
          type="button"
          aria-label="Create Bot"
          @click="openCreate"
        >
          +
        </KitButton>
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
          <GooseSticker
            class="sticker"
            name="wave"
            alt=""
          />
          <p class="kicker">
            Bots
          </p>
          <h1>No Bots yet</h1>
          <p class="hint">
            <template v-if="isOwner">
              Create a Bot and start a Chat. You can tell it what it is for.
            </template>
            <template v-else>
              Bots on this Host show up here. Open a Chat when one is here.
            </template>
          </p>
          <KitButton
            v-if="isOwner"
            type="button"
            @click="openCreate"
          >
            Create Bot
          </KitButton>
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
import { GooseSticker, KitButton } from '@dostigus/ui-kit'

useHead({ title: 'Dostigus · Bots' })

const { isOwner } = useHostAccount()
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
  margin: 1.75rem auto 0;
  text-align: center;
}

.sticker {
  margin-bottom: 0.35rem;
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
  font-size: 1.7rem;
  font-weight: 700;
}

.hint,
.status {
  margin: 0 0 1.35rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.status.error {
  color: var(--accent);
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
  padding: 1.1rem 1.2rem;
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
  font-weight: 600;
}

.bot-meta {
  color: var(--text-muted);
  font-size: 0.8rem;
  white-space: nowrap;
}
</style>
