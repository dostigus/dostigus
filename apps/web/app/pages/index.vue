<template>
  <div class="page">
    <header class="top">
      <HostMenuButton />
      <p class="mark">
        Bots
      </p>
    </header>
    <main class="stage">
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
      <p
        v-else-if="bots.length === 0"
        class="status"
      >
        No Bots yet
      </p>
      <div
        v-else
        class="pick"
      >
        <h1>Open a Chat</h1>
        <p class="hint">
          Choose a Bot from the list.
        </p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'host' })

useHead({ title: 'Dostigus · Bots' })

const { bots, pending, error } = await useHostBots()
</script>

<style scoped>
.page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-chat);
}

.top {
  display: none;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}

.mark {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.stage {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.75rem 1.4rem 3rem;
}

.status,
.hint {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.5;
}

.status.error {
  color: var(--accent);
}

.pick {
  text-align: center;
}

h1 {
  margin: 0 0 0.45rem;
  font-size: 1.7rem;
  font-weight: 700;
}

@media (max-width: 52rem) {
  .top {
    display: flex;
  }
}
</style>
