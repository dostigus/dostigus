<template>
  <UContainer class="py-8">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">
        {{ t('nav.catalog') }}
      </h1>
      <UButton
        :label="t('actions.add')"
        icon="i-lucide-plus"
        to="/catalog/add"
      />
    </div>

    <div class="flex gap-2 mb-6">
      <USelect
        v-model="filterType"
        :items="typeItems"
        :placeholder="t('catalog.allTypes')"
        class="w-40"
      />
      <USelect
        v-model="filterStatus"
        :items="statusItems"
        :placeholder="t('catalog.allStatuses')"
        class="w-40"
      />
    </div>

    <div v-if="items?.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="item in items"
        :key="item.id"
        :to="`/catalog/${item.id}`"
        class="rounded-xl border border-default p-4 space-y-2 hover:border-primary transition-colors"
      >
        <div class="flex items-center justify-between">
          <UBadge
            :label="t(`media.${item.type}`)"
            variant="subtle"
            color="neutral"
          />
          <UBadge :label="t(`status.${item.status}`)" variant="subtle" />
        </div>
        <h3 class="font-semibold">
          {{ item.title }}
        </h3>
        <p v-if="item.author" class="text-sm text-muted">
          {{ item.author }}
        </p>
        <div class="flex items-center justify-between text-sm text-muted">
          <span v-if="item.year">{{ item.year }}</span>
          <span v-if="item.rating" class="font-medium text-orange-500">{{ item.rating }}/10</span>
        </div>
      </NuxtLink>
    </div>

    <div v-else class="text-center py-16 text-muted">
      {{ t('catalog.empty') }}
    </div>
  </UContainer>
</template>

<script setup lang="ts">
const { t } = useI18n()

const typeItems = ['book', 'music', 'movie', 'game'].map((v) => ({ label: t(`media.${v}`), value: v }))
const statusItems = ['planned', 'in_progress', 'completed', 'dropped', 'on_hold'].map((v) => ({ label: t(`status.${v}`), value: v }))

const filterType = ref<string>()
const filterStatus = ref<string>()

const { data: items } = await useFetch('/api/media-items', {
  query: computed(() => ({
    ...(filterType.value ? { type: filterType.value } : {}),
    ...(filterStatus.value ? { status: filterStatus.value } : {}),
  })),
})
</script>
