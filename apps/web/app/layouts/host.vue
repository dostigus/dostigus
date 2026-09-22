<template>
  <div class="host">
    <button
      v-if="open && narrow"
      type="button"
      class="backdrop"
      aria-label="Close"
      @click="close"
    />
    <HostSidebar />
    <div class="pane">
      <slot />
      <BotPicker
        v-if="createOpen"
        :bots="bots"
        @close="closeCreate"
        @created="onCreated"
        @open-bot="onOpenBot"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Bot } from '@dostigus/shared'

const route = useRoute()
const { open, narrow, close } = useHostNav()
const { open: createOpen, closeCreate } = useHostCreate()
const { bots, refresh } = await useHostBots()

watch(() => route.fullPath, () => {
  close()
  closeCreate()
})

async function onCreated(bot: Bot) {
  closeCreate()
  await refresh()
  await navigateTo(`/bots/${bot.id}`)
}

async function onOpenBot(id: string) {
  closeCreate()
  await navigateTo(`/bots/${id}`)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value && !createOpen.value) {
    close()
  }
}

let detachNav = () => {}

onMounted(() => {
  const query = window.matchMedia('(max-width: 52rem)')
  const apply = () => {
    narrow.value = query.matches
    if (!query.matches) {
      close()
    }
  }
  apply()
  query.addEventListener('change', apply)
  window.addEventListener('keydown', onKeydown)
  detachNav = () => {
    query.removeEventListener('change', apply)
    window.removeEventListener('keydown', onKeydown)
  }
})

onUnmounted(() => {
  detachNav()
})
</script>

<style scoped>
/* Host drawer breakpoint: 52rem. Keep in step with HostMenuButton.vue. */
.host {
  height: 100dvh;
  display: flex;
  overflow: hidden;
  background: var(--bg);
}

.pane {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.pane > :deep(*) {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.backdrop {
  display: none;
}

@media (max-width: 52rem) {
  .host :deep(.sidebar) {
    position: fixed;
    z-index: 18;
    top: 0;
    bottom: 0;
    left: 0;
    width: min(18rem, calc(100vw - 3rem));
    transform: translateX(-105%);
    transition: transform 180ms ease;
  }

  .host :deep(.sidebar.open) {
    transform: translateX(0);
    box-shadow: 12px 0 40px rgb(0 0 0 / 35%);
  }

  .backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 17;
    border: 0;
    padding: 0;
    background: rgb(0 0 0 / 45%);
    cursor: pointer;
  }
}

@media (prefers-reduced-motion: reduce) {
  .host :deep(.sidebar) {
    transition: none;
  }
}
</style>
