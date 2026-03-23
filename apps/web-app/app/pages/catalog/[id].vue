<template>
  <UContainer class="py-8 max-w-lg">
    <div v-if="item" class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold">
          {{ editing ? t('catalog.editItem') : item.title }}
        </h1>
        <div v-if="!editing" class="flex gap-1">
          <UButton
            :label="t('actions.edit')"
            variant="outline"
            size="sm"
            @click="startEdit"
          />
          <UButton
            :label="t('actions.delete')"
            variant="outline"
            color="error"
            size="sm"
            @click="confirmDelete"
          />
        </div>
      </div>

      <template v-if="!editing">
        <div class="flex gap-2">
          <UBadge
            :label="t(`media.${item.type}`)"
            variant="subtle"
            color="neutral"
          />
          <UBadge :label="t(`status.${item.status}`)" variant="subtle" />
          <UBadge
            v-if="item.rating"
            :label="`${item.rating}/10`"
            variant="subtle"
            color="primary"
          />
        </div>

        <dl class="space-y-2 text-sm">
          <div v-if="item.author">
            <dt class="text-muted">
              {{ t('form.author') }}
            </dt>
            <dd>{{ item.author }}</dd>
          </div>
          <div v-if="item.originalTitle">
            <dt class="text-muted">
              {{ t('form.originalTitle') }}
            </dt>
            <dd>{{ item.originalTitle }}</dd>
          </div>
          <div v-if="item.year">
            <dt class="text-muted">
              {{ t('form.year') }}
            </dt>
            <dd>{{ item.year }}</dd>
          </div>
          <div v-if="item.notes">
            <dt class="text-muted">
              {{ t('form.notes') }}
            </dt>
            <dd class="whitespace-pre-wrap">
              {{ item.notes }}
            </dd>
          </div>
        </dl>
      </template>

      <form
        v-else
        class="space-y-4"
        @submit.prevent="save"
      >
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
            @click="editing = false"
          />
        </div>
      </form>
    </div>

    <UButton
      :label="t('nav.catalog')"
      variant="link"
      to="/catalog"
      class="mt-6"
    />
  </UContainer>
</template>

<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const loading = ref(false)
const editing = ref(false)

const { data: item } = await useFetch(`/api/media-items/${route.params.id}`)

if (!item.value) {
  throw createError({ statusCode: 404, message: 'Not found' })
}

const typeOptions = ['book', 'music', 'movie', 'game'].map((v) => ({
  label: t(`media.${v}`),
  value: v,
}))

const statusOptions = ['planned', 'in_progress', 'completed', 'dropped', 'on_hold'].map((v) => ({
  label: t(`status.${v}`),
  value: v,
}))

const form = reactive({
  type: '',
  title: '',
  author: '',
  originalTitle: '',
  year: undefined as number | undefined,
  status: '',
  rating: undefined as number | undefined,
  notes: '',
})

function startEdit() {
  if (!item.value) {
    return
  }
  form.type = item.value.type
  form.title = item.value.title
  form.author = item.value.author ?? ''
  form.originalTitle = item.value.originalTitle ?? ''
  form.year = item.value.year ?? undefined
  form.status = item.value.status
  form.rating = item.value.rating ?? undefined
  form.notes = item.value.notes ?? ''
  editing.value = true
}

async function save() {
  loading.value = true
  try {
    const updated = await $fetch(`/api/media-items/${route.params.id}`, {
      method: 'PATCH',
      body: {
        ...form,
        author: form.author || null,
        originalTitle: form.originalTitle || null,
        notes: form.notes || null,
      },
    })
    Object.assign(item.value!, updated)
    editing.value = false
  } finally {
    loading.value = false
  }
}

async function confirmDelete() {
  // eslint-disable-next-line no-alert
  if (!window.confirm(t('catalog.deleteConfirm'))) {
    return
  }
  await $fetch(`/api/media-items/${route.params.id}`, { method: 'DELETE' })
  await navigateTo('/catalog')
}
</script>
