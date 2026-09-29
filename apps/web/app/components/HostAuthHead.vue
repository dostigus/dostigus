<template>
  <header class="head">
    <h1 :id="id">
      {{ title }}
    </h1>
    <p class="hint">
      {{ hint }}
    </p>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  /** Names the `KitPanel` landmark through `aria-labelledby`. */
  id: string
  title: string
  hint: string
}>()
</script>

<style scoped>
.head {
  margin-bottom: 0.35rem;
}

h1 {
  margin: 0 0 0.55rem;
  font-size: 1.65rem;
  font-weight: 700;
}

.hint {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.5;
}
</style>
