<template>
  <UContainer class="py-16">
    <div class="flex flex-col items-center text-center gap-6">
      <div class="text-6xl">
        🪿
      </div>
      <h1 class="text-2xl font-bold">
        {{ error?.statusCode === 404 ? t('error.notFound') : t('error.generic') }}
      </h1>
      <p class="text-neutral-500">
        {{ error?.message }}
      </p>
      <UButton
        :label="t('error.goHome')"
        to="/"
      />
    </div>
  </UContainer>
</template>

<script setup lang="ts">
defineProps<{ error: { statusCode: number, message: string } }>()
const { t } = useI18n()
</script>
