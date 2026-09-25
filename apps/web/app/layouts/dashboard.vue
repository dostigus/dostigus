<template>
  <div class="dashboard">
    <nav
      class="rail"
      :aria-label="$t('dashboard.aria')"
    >
      <NuxtLink
        to="/"
        class="back"
        :aria-label="$t('dashboard.nav.backAria')"
      >
        <span
          class="chevron"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24">
            <path d="M15 6 9 12l6 6" />
          </svg>
        </span>
        <span>{{ $t('dashboard.nav.back') }}</span>
      </NuxtLink>

      <div class="items">
        <NuxtLink
          to="/dashboard"
          class="item"
          :aria-current="route.path === '/dashboard' ? 'page' : undefined"
        >
          <span
            class="glyph"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24">
              <path d="M4.5 11.5 12 5l7.5 6.5" />
              <path d="M7 10.5V19h4v-5h2v5h4v-8.5" />
            </svg>
          </span>
          <span class="item-copy">
            <span class="item-label">{{ $t('dashboard.nav.overview') }}</span>
            <span class="item-hint">{{ $t('dashboard.nav.overviewHint') }}</span>
          </span>
        </NuxtLink>

        <p class="group">
          {{ $t('dashboard.nav.cluster') }}
        </p>
        <NuxtLink
          to="/dashboard/cluster"
          class="item"
          :aria-current="route.path === '/dashboard/cluster' ? 'page' : undefined"
        >
          <span
            class="glyph"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24">
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
            <span class="item-label">{{ $t('dashboard.nav.clusterSettings') }}</span>
            <span class="item-hint">{{ $t('dashboard.nav.clusterSettingsHint') }}</span>
          </span>
        </NuxtLink>

        <p class="group">
          {{ $t('dashboard.nav.integrations') }}
        </p>
        <NuxtLink
          to="/dashboard/providers"
          class="item"
          :aria-current="route.path === '/dashboard/providers' ? 'page' : undefined"
        >
          <span
            class="glyph"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24">
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
          </span>
          <span class="item-copy">
            <span class="item-label">{{ $t('dashboard.nav.providers') }}</span>
            <span class="item-hint">{{ $t('dashboard.nav.providersHint') }}</span>
          </span>
        </NuxtLink>

        <p class="group">
          {{ $t('dashboard.nav.account') }}
        </p>
        <NuxtLink
          to="/dashboard/settings"
          class="item"
          :aria-current="route.path === '/dashboard/settings' ? 'page' : undefined"
        >
          <span
            class="glyph"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r="3"
              />
              <path d="M12 4.5v2.2M12 17.3V19.5M4.5 12h2.2M17.3 12H19.5M6.4 6.4l1.6 1.6M16 16l1.6 1.6M17.6 6.4 16 8M8 16l-1.6 1.6" />
            </svg>
          </span>
          <span class="item-copy">
            <span class="item-label">{{ $t('dashboard.nav.settings') }}</span>
            <span class="item-hint">{{ $t('dashboard.nav.settingsHint') }}</span>
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
const route = useRoute()
</script>

<style scoped>
.dashboard {
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
  gap: 0.15rem;
  overflow: auto;
}

.group {
  margin: 0.85rem 0.6rem 0.25rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
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
  .dashboard {
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
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
  }

  .group {
    display: none;
  }

  .item {
    flex: none;
    padding: 0.4rem 0.75rem 0.4rem 0.5rem;
    gap: 0.45rem;
  }

  .item-hint {
    display: none;
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
}
</style>
