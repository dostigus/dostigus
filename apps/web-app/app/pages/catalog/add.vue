<template>
  <UContainer class="py-8 max-w-lg">
    <h1 class="text-2xl font-bold mb-6">
      {{ t('catalog.addItem') }}
    </h1>

    <form class="space-y-4" @submit.prevent="submit">
      <UFormField :label="t('form.type')">
        <USelect v-model="form.type" :items="typeOptions" />
      </UFormField>

      <UFormField :label="t('form.title')">
        <UInput v-model="form.title" required />
      </UFormField>

      <UFormField :label="t('form.author')">
        <UInput v-model="form.author" />
      </UFormField>

      <UFormField :label="t('form.originalTitle')">
        <UInput v-model="form.originalTitle" />
      </UFormField>

      <UFormField :label="t('form.year')">
        <UInput v-model.number="form.year" type="number" />
      </UFormField>

      <UFormField :label="t('form.status')">
        <USelect v-model="form.status" :items="statusOptions" />
      </UFormField>

      <UFormField :label="t('form.rating')">
        <UInput
          v-model.number="form.rating"
          type="number"
          :min="1"
          :max="10"
        />
      </UFormField>

      <UFormField :label="t('form.notes')">
        <UTextarea v-model="form.notes" />
      </UFormField>

      <div class="flex gap-2 pt-2">
        <UButton
          type="submit"
          :label="t('actions.save')"
          :loading="loading"
        />
        <UButton
          :label="t('actions.cancel')"
          variant="outline"
          color="neutral"
          to="/catalog"
        />
      </div>
    </form>
  </UContainer>
</template>

<script setup lang="ts">
const { t } = useI18n()
const loading = ref(false)

const typeOptions = ['book', 'music', 'movie', 'game'].map((v) => ({
  label: t(`media.${v}`),
  value: v,
}))

const statusOptions = ['planned', 'in_progress', 'completed', 'dropped', 'on_hold'].map((v) => ({
  label: t(`status.${v}`),
  value: v,
}))

const form = reactive({
  type: 'book',
  title: '',
  author: '',
  originalTitle: '',
  year: undefined as number | undefined,
  status: 'planned',
  rating: undefined as number | undefined,
  notes: '',
})

async function submit() {
  loading.value = true
  try {
    await $fetch('/api/media-items', {
      method: 'POST',
      body: {
        ...form,
        author: form.author || undefined,
        originalTitle: form.originalTitle || undefined,
        notes: form.notes || undefined,
      },
    })
    await navigateTo('/catalog')
  } finally {
    loading.value = false
  }
}
</script>
