<template>
  <div class="brand">
    <p class="mark">
      Dostigus <span aria-hidden="true">🪿</span>
    </p>
    <p
      v-if="sub"
      class="sub"
    >
      {{ sub }}
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  sub?: string
}>()
</script>

<style scoped>
.brand {
  min-width: 0;
}

.mark {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.sub {
  margin: 0.2rem 0 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}
</style>
