<template>
  <div class="page">
    <h1 class="title">
      {{ $t('settings.title') }}
    </h1>
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'settings' })

const { t } = useI18n()

const SETTINGS_PAGES = computed(() => [
  { to: '/settings/providers', label: t('settings.nav.providers') },
  { to: '/settings/other', label: t('settings.nav.other') },
])

const route = useRoute()
const current = computed(() => SETTINGS_PAGES.value.find((item) => route.path.startsWith(item.to)))

useHead(() => ({
  title: current.value
    ? t('settings.titleDocPage', { page: current.value.label })
    : t('settings.titleDoc'),
}))
</script>

<style scoped>
.page {
  min-width: 0;
  padding: 1.75rem 1.75rem 3rem;
}

.title {
  margin: 0 0 1.35rem;
  font-size: 1.85rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
</style>
