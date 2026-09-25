<template>
  <div class="page">
    <header class="top">
      <HostMenuButton />
      <div>
        <p class="mark">
          Settings
        </p>
        <p class="sub">
          {{ current?.label ?? 'Cluster' }}
        </p>
      </div>
    </header>

    <div class="body">
      <nav
        class="tabs"
        aria-label="Settings"
      >
        <NuxtLink
          v-for="item in SETTINGS_PAGES"
          :key="item.to"
          :to="item.to"
          class="tab"
          :aria-current="current?.to === item.to ? 'page' : undefined"
        >
          <span
            class="glyph"
            aria-hidden="true"
          >
            <svg
              v-if="item.icon === 'providers'"
              viewBox="0 0 24 24"
            >
              <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
              <rect
                x="7.5"
                y="7.5"
                width="9"
                height="9"
                rx="2.5"
              />
              <circle
                cx="12"
                cy="12"
                r="1.4"
              />
            </svg>
            <svg
              v-else
              viewBox="0 0 24 24"
            >
              <path d="M5 7h9M18 7h1M5 17h1M10 17h9" />
              <circle
                cx="16"
                cy="7"
                r="2"
              />
              <circle
                cx="8"
                cy="17"
                r="2"
              />
            </svg>
          </span>
          <span class="tab-copy">
            <span class="tab-label">{{ item.label }}</span>
            <span class="tab-hint">{{ item.hint }}</span>
          </span>
        </NuxtLink>
      </nav>

      <main class="stage">
        <NuxtPage />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'host' })

const SETTINGS_PAGES = [
  { to: '/settings/providers', label: 'Провайдеры', hint: 'LLM, на которой думают Bots', icon: 'providers' },
  { to: '/settings/other', label: 'Прочее', hint: 'Часовой пояс и http allowlist', icon: 'other' },
] as const

const route = useRoute()
const current = computed(() => SETTINGS_PAGES.find((item) => route.path.startsWith(item.to)))

useHead(() => ({
  title: current.value ? `Dostigus · Settings · ${current.value.label}` : 'Dostigus · Settings',
}))
</script>

<style scoped>
.page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.top {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.75rem;
  padding: 1.15rem 1.4rem;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
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

.body {
  flex: 1;
  min-height: 0;
  display: flex;
  container-type: inline-size;
  container-name: settings;
}

.tabs {
  flex: none;
  width: 15rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 1.1rem 0.7rem;
  border-right: 1px solid var(--line-soft);
  overflow: auto;
}

.tab {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.65rem;
  border-radius: var(--radius);
  color: inherit;
  text-decoration: none;
}

.tab:hover {
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

.tab[aria-current='page'] {
  background: color-mix(in srgb, var(--text) 9%, transparent);
}

.tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.glyph {
  display: grid;
  place-items: center;
  flex: none;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 0.7rem;
  border: 1px solid var(--line);
  color: var(--text-muted);
}

.tab[aria-current='page'] .glyph {
  border-color: transparent;
  background: color-mix(in srgb, var(--accent) 22%, var(--surface));
  color: var(--accent-ink);
}

.glyph svg {
  width: 1.1rem;
  height: 1.1rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.7;
  stroke-linecap: round;
}

.tab-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.tab-label {
  font-weight: 700;
  font-size: 0.95rem;
}

.tab-hint {
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.35;
}

.stage {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 1.6rem 1.6rem 3rem;
}

@container settings (max-width: 46rem) {
  .body {
    flex-direction: column;
  }

  .tabs {
    width: auto;
    flex-direction: row;
    gap: 0.4rem;
    padding: 0.6rem 0.9rem;
    border-right: 0;
    border-bottom: 1px solid var(--line-soft);
  }

  .tab {
    flex: none;
    padding: 0.4rem 0.8rem 0.4rem 0.45rem;
    gap: 0.5rem;
  }

  .glyph {
    width: 1.8rem;
    height: 1.8rem;
  }

  .tab-hint {
    display: none;
  }

  .stage {
    padding: 1.2rem 1rem 3rem;
  }
}
</style>
