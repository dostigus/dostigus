<template>
  <div class="brand">
    <GooseLogo alt="" />
    <div>
      <p class="mark">
        Dostigus
      </p>
      <p
        v-if="sub"
        class="sub"
      >
        {{ sub }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { GooseLogo } from '@dostigus/ui-kit'

defineProps<{
  sub?: string
}>()
</script>

<style scoped>
.brand {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}

.mark {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.sub {
  margin: 0.15rem 0 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}
</style>
