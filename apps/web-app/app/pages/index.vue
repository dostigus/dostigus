<template>
  <UContainer class="py-16">
    <div class="flex flex-col items-center text-center gap-8">
      <img
        src="/goose.svg"
        alt="Dostigus"
        class="size-24 rounded-2xl bg-white"
      >

      <div>
        <h1 class="text-4xl font-bold">
          {{ t('app.name') }}
        </h1>
        <p class="mt-2 text-lg text-neutral-500">
          {{ t('app.description') }}
        </p>
      </div>

      <div class="flex gap-3">
        <UButton
          :label="t('nav.catalog')"
          to="/catalog"
          size="lg"
        />
        <UButton
          :label="t('nav.achievements')"
          to="/achievements"
          variant="outline"
          size="lg"
        />
      </div>

      <div v-if="items?.length" class="w-full max-w-lg text-left">
        <h2 class="text-xl font-semibold mb-4">
          {{ t('media.latest') }}
        </h2>
        <ul class="space-y-2">
          <li
            v-for="item in items"
            :key="item.id"
            class="flex items-center justify-between rounded-lg bg-elevated px-4 py-3"
          >
            <div>
              <span class="font-medium">{{ item.title }}</span>
              <span v-if="item.author" class="text-neutral-500 ml-2">{{ item.author }}</span>
            </div>
            <UBadge :label="t(`status.${item.status}`)" variant="subtle" />
          </li>
        </ul>
      </div>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { data: items } = await useFetch('/api/media-items')
</script>
