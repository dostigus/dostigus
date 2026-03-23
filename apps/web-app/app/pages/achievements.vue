<template>
  <UContainer class="py-8">
    <h1 class="text-2xl font-bold mb-6">
      {{ t('nav.achievements') }}
    </h1>

    <div class="text-center py-16 text-muted">
      {{ t('achievements.comingSoon') }}
    </div>
  </UContainer>
</template>

<script setup lang="ts">
const { t } = useI18n()
</script>
