<template>
  <div
    ref="rootEl"
    class="user"
    :class="{ rail: collapsed }"
    @keydown.escape.stop="menuOpen = false"
  >
    <button
      type="button"
      class="user-btn"
      :aria-expanded="menuOpen"
      aria-haspopup="menu"
      :aria-label="`Account, ${label}`"
      @click="menuOpen = !menuOpen"
    >
      <HostBotAvatar
        :name="label"
        color="var(--surface)"
        :size="collapsed ? 'sm' : 'md'"
      />
      <span
        v-if="!collapsed"
        class="user-name"
      >{{ label }}</span>
    </button>
    <div
      v-if="menuOpen"
      class="menu"
      role="menu"
    >
      <NuxtLink
        v-if="isOwner"
        to="/settings/providers"
        class="item"
        role="menuitem"
        @click="choose"
      >
        Settings
      </NuxtLink>
      <NuxtLink
        v-if="isOwner"
        to="/members"
        class="item"
        role="menuitem"
        @click="choose"
      >
        Members
      </NuxtLink>
      <HostLogoutButton />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  collapsed?: boolean
}>()

const { user, isOwner } = useHostAccount()
const { close } = useHostNav()
const route = useRoute()
const menuOpen = ref(false)
const rootEl = ref<HTMLElement | null>(null)

const label = computed(() => user.value?.displayName?.trim() || 'Account')

watch(() => route.fullPath, () => {
  menuOpen.value = false
})

function choose() {
  menuOpen.value = false
  close()
}

function onPointerDown(event: PointerEvent) {
  if (!menuOpen.value) {
    return
  }
  const root = rootEl.value
  if (root && event.target instanceof Node && root.contains(event.target)) {
    return
  }
  menuOpen.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onPointerDown)
})
</script>

<style scoped>
.user {
  position: relative;
}

.user-btn {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  min-width: 0;
  appearance: none;
  border: 0;
  border-radius: var(--radius);
  padding: 0.35rem 0.45rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.user-btn:hover,
.user-btn[aria-expanded='true'] {
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

.user-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.user:not(.rail) :deep(.avatar) {
  width: 2rem;
  height: 2rem;
  font-size: 0.68rem;
}

.user-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 400;
  font-size: 0.86rem;
  color: var(--text-muted);
}

.rail .user-btn {
  justify-content: center;
  padding: 0.25rem;
}

.menu {
  position: absolute;
  left: 0.15rem;
  right: 0.15rem;
  bottom: calc(100% + 0.4rem);
  z-index: 6;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.35rem;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: 0 14px 36px rgb(0 0 0 / 38%);
}

.rail .menu {
  left: 0.2rem;
  right: auto;
  width: 12rem;
}

.item,
.menu :deep(.logout) {
  display: block;
  width: 100%;
  text-align: left;
  border: 0;
  border-radius: var(--radius);
  padding: 0.48rem 0.7rem;
  background: transparent;
  color: var(--text);
  text-decoration: none;
  font-size: 0.92rem;
  cursor: pointer;
}

.item:hover,
.menu :deep(.logout:hover:not(:disabled)) {
  color: var(--text);
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

.item.router-link-exact-active {
  background: color-mix(in srgb, var(--accent) 16%, var(--surface));
}
</style>
