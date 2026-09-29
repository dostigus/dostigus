<template>
  <KitPanel
    as="section"
    class="health"
    :class="health.tone"
    role="status"
    aria-live="polite"
  >
    <div class="row">
      <span
        class="glyph"
        aria-hidden="true"
      >
        <svg
          v-if="health.tone === 'ok'"
          viewBox="0 0 24 24"
        >
          <path d="M6.5 12.5l3.6 3.5L17.5 8.5" />
        </svg>
        <svg
          v-else-if="health.tone === 'error'"
          viewBox="0 0 24 24"
        >
          <path d="M12 7v6M12 16.6v.4" />
        </svg>
        <svg
          v-else-if="health.tone === 'idle'"
          viewBox="0 0 24 24"
        >
          <path d="M9 3.5v4M15 3.5v4M7 7.5h10v3.2a5 5 0 0 1-10 0zM12 15.7v4.8" />
        </svg>
        <svg
          v-else
          viewBox="0 0 24 24"
        >
          <path d="M12 7.5v5l3 1.8" />
        </svg>
      </span>
      <div class="copy">
        <p class="title">
          {{ health.title }}
        </p>
        <p class="detail">
          {{ health.detail }}
        </p>
      </div>
      <div
        v-if="$slots.default"
        class="actions"
      >
        <slot />
      </div>
    </div>
  </KitPanel>
</template>

<script setup lang="ts">
import type { ProviderHealth } from '../utils/provider-settings'
import { KitPanel } from '@dostigus/ui-kit'

defineProps<{
  health: ProviderHealth
}>()
</script>

<style scoped>
.health {
  --tone: var(--text-muted);
}

.health.ok {
  --tone: var(--live);
}

.health.error,
.health.degraded {
  --tone: var(--accent);
}

.row {
  display: flex;
  align-items: center;
  gap: 0.95rem;
}

.glyph {
  display: grid;
  place-items: center;
  flex: none;
  width: 2.6rem;
  height: 2.6rem;
  border: 1px solid color-mix(in srgb, var(--tone) 45%, var(--line));
  border-radius: 999px;
  background: var(--surface);
  color: var(--tone);
}

.checking .glyph {
  animation: health-wait 1.4s ease-in-out infinite;
}

.glyph svg {
  width: 1.3rem;
  height: 1.3rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.copy {
  min-width: 0;
  flex: 1;
}

.title {
  margin: 0;
  font-weight: 700;
  font-size: 1.02rem;
}

.detail {
  margin: 0.15rem 0 0;
  color: var(--text-muted);
  font-size: 0.86rem;
  line-height: 1.45;
}

.actions {
  flex: none;
  display: flex;
  gap: 0.45rem;
}

@keyframes health-wait {
  50% {
    opacity: 0.55;
  }
}

@media (prefers-reduced-motion: reduce) {
  .checking .glyph {
    animation: none;
  }
}
</style>
