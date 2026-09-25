<template>
  <button
    type="button"
    class="menu"
    :aria-label="$t('host.nav.threads')"
    aria-controls="host-sidebar"
    :aria-expanded="open"
    @click="toggle"
  >
    <span
      class="bars"
      aria-hidden="true"
    />
  </button>
</template>

<script setup lang="ts">
const { open, toggle } = useHostNav()
</script>

<style scoped>
/* Host drawer breakpoint: 52rem. Keep in step with layouts/host.vue. */
.menu {
  display: none;
  appearance: none;
  align-items: center;
  justify-content: center;
  width: 2.6rem;
  height: 2.6rem;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  flex: none;
}

.menu:hover {
  border-color: var(--accent);
}

.menu:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.bars,
.bars::before,
.bars::after {
  display: block;
  width: 1rem;
  height: 2px;
  border-radius: 999px;
  background: currentcolor;
}

.bars {
  position: relative;
}

.bars::before,
.bars::after {
  content: '';
  position: absolute;
  left: 0;
}

.bars::before {
  top: -5px;
}

.bars::after {
  top: 5px;
}

@media (max-width: 52rem) {
  .menu {
    display: inline-flex;
  }
}
</style>
