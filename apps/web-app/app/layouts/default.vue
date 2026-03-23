<template>
  <div class="min-h-screen bg-default">
    <header class="sticky top-0 z-50 h-12 border-b border-default bg-default/80 backdrop-blur-sm">
      <UContainer class="flex items-center justify-between h-full">
        <NuxtLink to="/" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img
            src="/goose.svg"
            alt="Dostigus"
            class="size-7 rounded-md bg-white"
          >
          <span class="font-bold">{{ t('app.name') }}</span>
        </NuxtLink>

        <nav class="flex items-center gap-1">
          <UButton
            :label="t('nav.catalog')"
            to="/catalog"
            color="neutral"
            variant="ghost"
            size="sm"
          />
          <UButton
            :label="t('nav.achievements')"
            to="/achievements"
            color="neutral"
            variant="ghost"
            size="sm"
          />
          <UButton
            :label="t('nav.profile')"
            to="/profile"
            color="neutral"
            variant="ghost"
            size="sm"
          />
          <UColorModeButton
            size="sm"
            color="neutral"
            variant="ghost"
          />
        </nav>
      </UContainer>
    </header>

    <main>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
</script>
