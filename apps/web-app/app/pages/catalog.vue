<template>
  <UContainer class="py-8">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">
        {{ t('nav.catalog') }}
      </h1>
      <UButton :label="t('actions.add')" icon="i-lucide-plus" />
    </div>

    <div v-if="items?.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="item in items"
        :key="item.id"
        class="rounded-xl border border-default p-4 space-y-2"
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
      </div>
    </div>

    <div v-else class="text-center py-16 text-muted">
      {{ t('catalog.empty') }}
    </div>
  </UContainer>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { data: items } = await useFetch('/api/media-items')
</script>
