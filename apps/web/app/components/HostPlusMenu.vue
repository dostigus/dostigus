<template>
  <div
    ref="rootEl"
    class="plus-wrap"
    :class="{ rail }"
    @keydown.escape.stop="closePlusMenu"
  >
    <button
      type="button"
      class="chrome"
      :aria-label="$t('host.plus.aria')"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="togglePlusMenu"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M12 5.5v13M5.5 12h13" />
      </svg>
    </button>
    <div
      v-if="open"
      ref="menuEl"
      class="plus-menu"
      role="menu"
      :aria-label="$t('host.plus.aria')"
    >
      <button
        type="button"
        class="plus-item"
        role="menuitem"
        @click="onFindBot"
      >
        <span class="plus-label">{{ $t('host.plus.findOrCreateBot') }}</span>
        <span class="plus-hint">{{ $t('host.plus.botList') }}</span>
      </button>
      <button
        type="button"
        class="plus-item"
        role="menuitem"
        @click="onThread('dm')"
      >
        <span class="plus-label">{{ $t('host.plus.writeDm') }}</span>
        <span class="plus-hint">{{ $t('host.plus.onePerson') }}</span>
      </button>
      <button
        type="button"
        class="plus-item"
        role="menuitem"
        @click="onThread('room')"
      >
        <span class="plus-label">{{ $t('host.plus.createGroup') }}</span>
        <span class="plus-hint">{{ $t('host.plus.peopleOptionalBot') }}</span>
      </button>
      <button
        v-if="isOwner"
        type="button"
        class="plus-item"
        role="menuitem"
        @click="onMember"
      >
        <span class="plus-label">{{ $t('host.plus.addMember') }}</span>
        <span class="plus-hint">{{ $t('host.plus.inviteOrPassword') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MessengerThreadKind } from '@dostigus/shared'

defineProps<{
  rail?: boolean
}>()

const route = useRoute()
const { isOwner } = useHostAccount()
const { open, closePlusMenu, togglePlusMenu } = useHostPlusMenu()
const { openCreate, closeCreate } = useHostCreate()
const { openThreadCreate, closeThreadCreate } = useHostThreadCreate()
const { openMemberAdd, closeMemberAdd } = useHostMemberAdd()
const rootEl = ref<HTMLElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)

watch(() => route.fullPath, () => {
  closePlusMenu()
})

watch(open, (value) => {
  if (!value) {
    return
  }
  nextTick(() => {
    menuEl.value?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  })
})

function onFindBot() {
  closePlusMenu()
  closeThreadCreate()
  closeMemberAdd()
  openCreate()
}

function onThread(kind: MessengerThreadKind) {
  closePlusMenu()
  closeCreate()
  closeMemberAdd()
  openThreadCreate(kind)
}

function onMember() {
  closePlusMenu()
  closeCreate()
  closeThreadCreate()
  openMemberAdd()
}

function onPointerDown(event: PointerEvent) {
  if (!open.value) {
    return
  }
  const root = rootEl.value
  if (root && event.target instanceof Node && root.contains(event.target)) {
    return
  }
  closePlusMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onPointerDown)
})
</script>

<style scoped>
.plus-wrap {
  position: relative;
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

.chrome:hover,
.chrome[aria-expanded='true'] {
  border-color: color-mix(in srgb, var(--text) 28%, var(--line));
}

.chrome:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.plus-menu {
  position: absolute;
  z-index: 8;
  top: calc(100% + 0.35rem);
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  width: 17.5rem;
  max-height: min(24rem, 70vh);
  overflow: auto;
  padding: 0.35rem;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: 0 14px 36px rgb(0 0 0 / 38%);
}

.rail .plus-menu {
  top: auto;
  bottom: 0;
  left: calc(100% + 0.45rem);
}

.plus-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.08rem;
  width: 100%;
  text-align: left;
  border: 0;
  border-radius: var(--radius);
  padding: 0.48rem 0.7rem;
  background: transparent;
  color: var(--text);
  font: inherit;
  cursor: pointer;
}

.plus-item:hover,
.plus-item:focus-visible {
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

.plus-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.plus-label {
  font-size: 0.95rem;
  font-weight: 700;
}

.plus-hint {
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 400;
}
</style>
