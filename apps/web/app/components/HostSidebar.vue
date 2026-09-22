<template>
  <aside
    id="host-sidebar"
    class="sidebar"
    :class="{ open }"
    :inert="narrow && !open"
  >
    <div class="side-head">
      <NuxtLink
        to="/"
        class="brand"
        @click="close"
      >
        <HostMark />
      </NuxtLink>
      <KitButton
        v-if="isOwner"
        variant="icon"
        type="button"
        aria-label="Create a Bot"
        @click="openCreate"
      >
        +
      </KitButton>
    </div>

    <nav
      class="list"
      aria-label="Bots"
    >
      <p
        v-if="pending && bots.length === 0"
        class="status"
      >
        Loading Bots…
      </p>
      <p
        v-else-if="error && bots.length === 0"
        class="status error"
      >
        Could not load Bots.
      </p>
      <HostBotEmpty
        v-else-if="bots.length === 0"
        compact
      />
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
            @click="close"
          >
            <span class="bot-name">{{ bot.name }}</span>
            <span class="bot-meta">{{ formatWhen(bot.createdAt) }}</span>
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <nav
      class="foot"
      aria-label="Host"
    >
      <NuxtLink
        v-if="isOwner"
        to="/members"
        class="foot-link"
        @click="close"
      >
        Members
      </NuxtLink>
      <NuxtLink
        v-if="isOwner"
        to="/settings"
        class="foot-link"
        @click="close"
      >
        Settings
      </NuxtLink>
      <HostLogoutButton />
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { KitButton } from '@dostigus/ui-kit'

const { isOwner } = useHostAccount()
const { open, narrow, close } = useHostNav()
const { openCreate } = useHostCreate()
const { bots, pending, error } = await useHostBots()

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleDateString()
}
</script>

<style scoped>
.sidebar {
  width: 17.5rem;
  flex: none;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--surface);
  border-right: 1px solid var(--line);
}

.side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.9rem 0.85rem 0.7rem;
}

.brand {
  color: inherit;
  text-decoration: none;
  min-width: 0;
}

.list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.35rem 0.7rem 0.9rem;
}

.status {
  margin: 0.6rem 0.35rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.status.error {
  color: var(--accent);
}

.bots {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.bot {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.55rem 0.7rem;
  border-radius: 0.85rem;
  color: inherit;
  text-decoration: none;
}

.bot:hover {
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

.bot.router-link-exact-active {
  background: color-mix(in srgb, var(--accent) 18%, var(--surface));
}

.bot-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bot-meta {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.foot {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.55rem 0.7rem calc(0.7rem + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--line);
}

.foot-link {
  display: block;
  padding: 0.4rem 0.7rem;
  border-radius: 0.7rem;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.92rem;
}

.foot-link:hover,
.foot-link.router-link-exact-active {
  color: var(--text);
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

.foot :deep(.logout) {
  width: 100%;
  text-align: left;
  border: 0;
  border-radius: 0.7rem;
  padding: 0.4rem 0.7rem;
  background: transparent;
}

.foot :deep(.logout:hover:not(:disabled)) {
  border: 0;
  color: var(--text);
  background: color-mix(in srgb, var(--text) 6%, transparent);
}
</style>
