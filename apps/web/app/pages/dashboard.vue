<template>
  <div class="page">
    <h1 class="title">
      {{ $t('dashboard.title') }}
    </h1>
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()

const PAGES = computed(() => [
  { to: '/dashboard', label: t('dashboard.nav.overview'), exact: true },
  { to: '/dashboard/cluster', label: t('dashboard.nav.clusterSettings') },
  { to: '/dashboard/providers', label: t('dashboard.nav.providers') },
  { to: '/dashboard/settings', label: t('dashboard.nav.settings') },
])

const route = useRoute()
const current = computed(() => PAGES.value.find((item) => (
  item.exact ? route.path === item.to : route.path.startsWith(item.to)
)))

useHead(() => ({
  title: current.value
    ? t('dashboard.titleDocPage', { page: current.value.label })
    : t('dashboard.titleDoc'),
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
