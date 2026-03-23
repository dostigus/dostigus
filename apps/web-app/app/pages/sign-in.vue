<template>
  <div class="min-h-screen flex items-center justify-center bg-default">
    <div class="flex flex-col items-center gap-6 text-center">
      <img
        src="/goose.svg"
        alt="Dostigus"
        class="size-20 rounded-2xl bg-white"
      >

      <div>
        <h1 class="text-2xl font-bold">
          {{ t('app.name') }}
        </h1>
        <p class="mt-1 text-muted">
          {{ t('app.description') }}
        </p>
      </div>

      <UButton
        :label="t('nav.login')"
        size="lg"
        :loading="loading"
        @click="login"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const { t } = useI18n()
const loading = ref(false)

async function login() {
  loading.value = true
  try {
    await $fetch('/api/auth/login', { method: 'POST' })
    await reloadNuxtApp({ path: '/' })
  } finally {
    loading.value = false
  }
}
</script>
