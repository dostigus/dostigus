<template>
  <div class="settings">
    <nav
      class="rail"
      :aria-label="$t('settings.aria')"
    >
      <NuxtLink
        to="/"
        class="back"
        :aria-label="$t('settings.nav.backAria')"
      >
        <span
          class="chevron"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24">
            <path d="M15 6 9 12l6 6" />
          </svg>
        </span>
        <span>{{ $t('settings.nav.back') }}</span>
      </NuxtLink>

      <div class="items">
        <NuxtLink
          v-for="item in SETTINGS_PAGES"
          :key="item.to"
          :to="item.to"
          class="item"
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
          <span class="item-copy">
            <span class="item-label">{{ item.label }}</span>
            <span class="item-hint">{{ item.hint }}</span>
          </span>
        </NuxtLink>
      </div>

      <div class="foot">
        <HostUserMenu hide-settings />
      </div>
    </nav>

    <div class="pane">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

const SETTINGS_PAGES = computed(() => [
  { to: '/settings/providers', label: t('settings.nav.providers'), hint: t('settings.nav.providersHint'), icon: 'providers' as const },
  { to: '/settings/other', label: t('settings.nav.other'), hint: t('settings.nav.otherHint'), icon: 'other' as const },
])

const route = useRoute()
const current = computed(() => SETTINGS_PAGES.value.find((item) => route.path.startsWith(item.to)))
</script>

<style scoped>
.settings {
  height: 100dvh;
  display: flex;
  overflow: hidden;
  background: var(--bg);
}

.rail {
  flex: none;
  width: 16rem;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0.85rem 0.7rem 0;
  border-right: 1px solid var(--line-soft);
  overflow: hidden;
}

.back {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex: none;
  margin: 0 0 0.85rem;
  padding: 0.45rem 0.55rem;
  border-radius: var(--radius);
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.92rem;
  text-decoration: none;
}

.back:hover {
  background: color-mix(in srgb, var(--text) 6%, transparent);
  color: var(--text);
}

.back:focus-visible,
.item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.chevron {
  display: grid;
  place-items: center;
  flex: none;
  width: 1.05rem;
  height: 1.05rem;
}

.chevron svg {
  width: 1.05rem;
  height: 1.05rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.items {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  overflow: auto;
}

.foot {
  flex: none;
  margin-top: auto;
  padding: 0.45rem 0.15rem calc(0.55rem + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--line-soft);
}

.item {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.55rem 0.6rem;
  border-radius: 999px;
  color: inherit;
  text-decoration: none;
}

.item:hover {
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

.item[aria-current='page'] {
  background: color-mix(in srgb, var(--text) 9%, transparent);
}

.glyph {
  display: grid;
  place-items: center;
  flex: none;
  width: 1.35rem;
  height: 1.35rem;
  color: var(--text-muted);
}

.item[aria-current='page'] .glyph {
  color: var(--text);
}

.glyph svg {
  width: 1.15rem;
  height: 1.15rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.7;
  stroke-linecap: round;
}

.item-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.item-label {
  font-weight: 700;
  font-size: 0.95rem;
}

.item-hint {
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.35;
}

.pane {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

@media (max-width: 46rem) {
  .settings {
    flex-direction: column;
  }

  .rail {
    width: auto;
    flex-direction: row;
    align-items: center;
    gap: 0.45rem;
    padding: 0.55rem 0.75rem;
    border-right: 0;
    border-bottom: 1px solid var(--line-soft);
    overflow: auto;
  }

  .back {
    margin: 0;
    padding: 0.4rem 0.55rem;
  }

  .items {
    flex: 1;
    flex-direction: row;
    gap: 0.35rem;
  }

  .foot {
    margin-top: 0;
    margin-left: auto;
    padding: 0;
    border-top: 0;
  }

  .foot :deep(.user-name) {
    display: none;
  }

  .foot :deep(.user-btn) {
    width: auto;
  }

  .foot :deep(.menu) {
    top: calc(100% + 0.4rem);
    bottom: auto;
    left: auto;
    right: 0;
    width: 12rem;
  }

  .item {
    flex: none;
    padding: 0.4rem 0.75rem 0.4rem 0.5rem;
    gap: 0.45rem;
  }

  .item-hint {
    display: none;
  }
}
</style>
