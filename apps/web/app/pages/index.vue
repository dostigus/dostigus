<template>
  <div class="shell">
    <header class="top">
      <p class="mark">
        Dostigus
      </p>
      <p class="sub">
        Host shell · Cluster stub
      </p>
    </header>

    <main class="stage">
      <HostChatStub @open-sheet="sheetOpen = true" />
    </main>

    <HostSheetStub
      :open="sheetOpen"
      :sheet="stubSheet"
      @close="sheetOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import type { Sheet } from '@dostigus/shared'

const sheetOpen = ref(false)
const stubSheet: Sheet = {
  id: 'stub',
  title: 'Sheet',
  kind: 'sheet',
}
</script>

<style scoped>
.shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.top {
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

.stage {
  flex: 1;
  display: flex;
}
</style>
