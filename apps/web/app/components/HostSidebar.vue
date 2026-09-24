<template>
  <aside
    id="host-sidebar"
    class="sidebar"
    :class="{ open, rail, dragging }"
    :style="frameStyle"
    :inert="narrow && !open"
  >
    <div class="column">
      <div class="side-head">
        <button
          type="button"
          class="chrome"
          aria-label="Search"
          @click="openSearch"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              cx="11"
              cy="11"
              r="6.5"
            />
            <path d="M16 16.5L20 20.5" />
          </svg>
        </button>
        <button
          type="button"
          class="chrome"
          :aria-label="isOwner ? 'Find or create a Bot' : 'Find a Bot'"
          @click="onCreateBot"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 5.5v13M5.5 12h13" />
          </svg>
        </button>
        <button
          type="button"
          class="chrome"
          aria-label="New thread"
          @click="onNewThread"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M7 17.5V8.5A3.5 3.5 0 0 1 10.5 5h3A3.5 3.5 0 0 1 17 8.5v4A3.5 3.5 0 0 1 13.5 16H10l-3 2.5z" />
          </svg>
        </button>
      </div>

      <nav
        class="list"
        :class="{ 'list-empty': threads.length === 0 && !pending && !error && !rail }"
        aria-label="Threads"
      >
        <p
          v-if="pending && threads.length === 0"
          class="status"
        >
          Loading Threads…
        </p>
        <p
          v-else-if="error && threads.length === 0"
          class="status error"
        >
          Could not load Threads.
        </p>
        <p
          v-else-if="threads.length === 0 && !rail"
          class="status"
        >
          No Threads yet
        </p>
        <ul
          v-else
          class="bots"
        >
          <li
            v-for="thread in threads"
            :key="thread.id"
          >
            <NuxtLink
              v-if="rail"
              class="rail-bot"
              :to="thread.href"
              :aria-label="threadAria(thread, threadLive(thread))"
              :title="thread.title"
              @click="onRow(thread.href)"
            >
              <HostBotAvatar
                :name="thread.mark.name"
                :seed="thread.mark.seed"
                :shape="avatarShape(thread)"
                :avatar-color="thread.mark.color"
                :live="threadLive(thread)"
              />
            </NuxtLink>
            <NuxtLink
              v-else
              class="bot"
              :to="thread.href"
              @click="onRow(thread.href)"
            >
              <HostBotAvatar
                :name="thread.mark.name"
                :seed="thread.mark.seed"
                :shape="avatarShape(thread)"
                :avatar-color="thread.mark.color"
                :live="threadLive(thread)"
              />
              <span class="bot-copy">
                <span class="bot-title">
                  <span class="bot-name">{{ thread.title }}</span>
                  <span
                    v-if="thread.kind !== 'bot'"
                    class="bot-private"
                  >{{ kindLabel(thread.kind) }}</span>
                </span>
                <span
                  v-if="thread.lastMessage?.content"
                  class="bot-preview"
                >{{ thread.lastMessage.content }}</span>
              </span>
            </NuxtLink>
          </li>
        </ul>
      </nav>

      <div class="foot">
        <HostUserMenu :collapsed="rail" />
      </div>
    </div>

    <div
      class="splitter"
      :class="{ dragging }"
    >
      <button
        type="button"
        class="fold"
        :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        @click="toggleCollapsed"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path :d="collapsed ? 'M10 6l6 6-6 6' : 'M14 6l-6 6 6 6'" />
        </svg>
      </button>
      <div
        class="resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        tabindex="0"
        :aria-valuenow="rail ? SIDEBAR_RAIL : width"
        :aria-valuemin="SIDEBAR_RAIL"
        :aria-valuemax="SIDEBAR_MAX"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @keydown="onResizeKey"
      />
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { ThreadListItem } from '@dostigus/shared'

const route = useRoute()
const { isOwner } = useHostAccount()
const { open, narrow, close } = useHostNav()
const { openCreate, closeCreate } = useHostCreate()
const { openThreadCreate, closeThreadCreate } = useHostThreadCreate()
const { openSearch } = useHostSearch()
const { threads, pending, error } = await useHostThreads()
const { width, collapsed, resizeTo, toggleCollapsed } = useHostSidebar()
const { isLive } = useHostBotActivity()

const dragging = ref(false)
const rail = computed(() => collapsed.value && !narrow.value)
const frameStyle = computed(() => {
  if (narrow.value) {
    return undefined
  }
  const px = rail.value ? SIDEBAR_RAIL : width.value
  return { '--sidebar-width': `${px}px` }
})

let drag: { pointerId: number, startX: number, origin: number } | null = null

function kindLabel(kind: ThreadListItem['kind']) {
  if (kind === 'dm') {
    return 'DM'
  }
  if (kind === 'group') {
    return 'Group'
  }
  if (kind === 'room') {
    return 'Room'
  }
  return ''
}

function avatarShape(thread: ThreadListItem) {
  return thread.mark.shape ?? ''
}

function threadLive(thread: ThreadListItem) {
  return thread.kind === 'bot' && thread.botId ? isLive(thread.botId) : false
}

function threadAria(thread: ThreadListItem, live: boolean) {
  const kind = thread.kind === 'bot' ? '' : `, ${kindLabel(thread.kind)}`
  return live ? `${thread.title}${kind}, online` : `${thread.title}${kind}`
}

function onCreateBot() {
  closeThreadCreate()
  openCreate()
}

function onNewThread() {
  closeCreate()
  openThreadCreate()
}

function onRow(href: string) {
  close()
  if (route.path === href) {
    closeCreate()
    closeThreadCreate()
  }
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 || narrow.value) {
    return
  }
  const handle = event.currentTarget
  if (!(handle instanceof HTMLElement)) {
    return
  }
  handle.setPointerCapture(event.pointerId)
  drag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    origin: rail.value ? SIDEBAR_RAIL : width.value,
  }
  dragging.value = true
  document.body.style.userSelect = 'none'
}

function onPointerMove(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) {
    return
  }
  resizeTo(drag.origin + (event.clientX - drag.startX))
}

function onPointerUp(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) {
    return
  }
  drag = null
  dragging.value = false
  document.body.style.userSelect = ''
}

function onResizeKey(event: KeyboardEvent) {
  const step = event.shiftKey ? 48 : 24
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    if (rail.value || width.value <= SIDEBAR_MIN) {
      resizeTo(SIDEBAR_COLLAPSE_AT - 1)
      return
    }
    resizeTo(width.value - step)
    return
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    const base = rail.value ? SIDEBAR_COLLAPSE_AT : width.value
    resizeTo(base + step)
  }
}

onUnmounted(() => {
  document.body.style.userSelect = ''
})
</script>

<style scoped>
.sidebar {
  position: relative;
  z-index: 2;
  width: var(--sidebar-width, 17.5rem);
  flex: none;
  display: flex;
  min-height: 0;
  background: var(--bg);
  border-right: 1px solid var(--line-soft);
  transition: width 160ms ease;
}

.sidebar.dragging {
  transition: none;
}

.column {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.side-head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex: none;
  padding: 0.75rem 0.7rem 0.45rem;
}

.chrome {
  appearance: none;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  padding: 0;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.chrome svg {
  width: 1.05rem;
  height: 1.05rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.chrome:hover {
  border-color: color-mix(in srgb, var(--text) 28%, var(--line));
}

.chrome:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.25rem 0.55rem 0.7rem;
}

.list-empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.list-empty .status {
  margin: 0;
  text-align: center;
}

.status {
  margin: 0.7rem 0.45rem;
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
  gap: 0.1rem;
}

.bot,
.rail-bot {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
  padding: 0.42rem 0.5rem;
  border-radius: var(--radius);
  color: inherit;
  text-decoration: none;
}

.rail-bot {
  box-sizing: border-box;
  justify-content: center;
  width: 2.95rem;
  height: 2.95rem;
  aspect-ratio: 1;
  padding: 0;
}

.bot:hover,
.rail-bot:hover {
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

.bot.router-link-exact-active,
.rail-bot.router-link-exact-active {
  background: color-mix(in srgb, var(--text) 9%, transparent);
}

.rail-bot.router-link-exact-active :deep(.avatar) {
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 3px var(--accent);
}

.bot-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
}

.bot-title {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.bot-name {
  min-width: 0;
  font-weight: 700;
  font-size: 0.95rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bot-private {
  flex: none;
  color: var(--accent);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.bot-preview {
  color: var(--text-muted);
  font-size: 0.8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.foot {
  padding: 0.45rem 0.55rem calc(0.6rem + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--line-soft);
}

.rail .bots {
  align-items: center;
  gap: 0.35rem;
}

.rail .list {
  order: 1;
  padding-inline: 0.3rem;
}

.rail .side-head {
  order: 2;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.35rem 0.35rem;
  border-top: 1px solid var(--line-soft);
}

.rail .foot {
  order: 3;
  border-top: 0;
  padding-top: 0.1rem;
  padding-inline: 0.3rem;
}

.splitter {
  position: absolute;
  top: 0;
  right: -6px;
  bottom: 0;
  width: 12px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
}

.resize {
  position: absolute;
  inset: 0;
  cursor: col-resize;
  touch-action: none;
}

.resize:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.fold {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 1.35rem;
  height: 1.35rem;
  padding: 0;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--text-muted);
  cursor: pointer;
}

.fold svg {
  width: 0.85rem;
  height: 0.85rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.fold:hover {
  color: var(--text);
  border-color: var(--accent);
}

.fold:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (max-width: 52rem) {
  .splitter {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar {
    transition: none;
  }
}
</style>
