<template>
  <section
    class="health"
    :class="health.tone"
    role="status"
    aria-live="polite"
  >
    <span
      class="orb"
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
  </section>
</template>

<script setup lang="ts">
import type { ProviderHealth } from '../utils/provider-settings'

defineProps<{
  health: ProviderHealth
}>()
</script>

<style scoped>
.health {
  --tone: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 0.95rem;
  padding: 1rem 1.15rem;
  border: 1px solid color-mix(in srgb, var(--tone) 40%, var(--line));
  border-radius: var(--radius-card);
  background:
    radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--tone) 14%, transparent), transparent 60%),
    var(--card);
}

.health.ok {
  --tone: var(--live);
}

.health.degraded,
.health.checking {
  --tone: var(--bot-accent-04);
}

.health.error {
  --tone: var(--accent);
}

.orb {
  display: grid;
  place-items: center;
  flex: none;
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--tone) 22%, var(--surface));
  color: var(--tone);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--tone) 10%, transparent);
}

.checking .orb {
  animation: health-pulse 1.4s ease-in-out infinite;
}

.orb svg {
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

@keyframes health-pulse {
  50% {
    box-shadow: 0 0 0 8px color-mix(in srgb, var(--tone) 4%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .checking .orb {
    animation: none;
  }
}
</style>
