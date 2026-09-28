<template>
  <div class="pack-export">
    <p class="id">
      {{ $t('pack.exportId', { author, slug: botSlug }) }}
    </p>
    <KitField :label="$t('pack.exportAuthor')">
      <KitInput
        :model-value="author"
        readonly
      />
    </KitField>
    <KitField :label="$t('pack.exportSlug')">
      <KitInput
        v-model="botSlug"
        autocomplete="off"
        maxlength="32"
      />
    </KitField>
    <KitField :label="$t('pack.exportVersion')">
      <KitInput
        v-model="version"
        autocomplete="off"
        maxlength="20"
      />
    </KitField>
    <KitField :label="$t('pack.exportReadme')">
      <KitTextarea
        v-model="readme"
        :rows="4"
      />
    </KitField>
    <p
      v-if="error"
      class="note"
      role="alert"
    >
      <KitChip tone="warn">
        {{ error }}
      </KitChip>
    </p>
    <div class="actions">
      <KitButton
        type="button"
        variant="ghost"
        :disabled="busy"
        @click="emit('cancel')"
      >
        {{ $t('common.cancel') }}
      </KitButton>
      <KitButton
        type="button"
        :disabled="busy || !botSlug.trim() || !version.trim()"
        @click="confirm"
      >
        {{ busy ? $t('pack.exportBusy') : $t('pack.exportConfirm') }}
      </KitButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { KitButton, KitChip, KitField, KitInput, KitTextarea } from '@dostigus/ui-kit'

const props = defineProps<{
  botId: string
  author: string
  botSlug: string
  version: string
  readme: string
}>()

const emit = defineEmits<{
  downloaded: []
  cancel: []
}>()

const { t } = useI18n()
const author = props.author
const botSlug = ref(props.botSlug)
const version = ref(props.version)
const readme = ref(props.readme)
const busy = ref(false)
const error = ref('')

function filenameFromDisposition(header: string | null): string {
  const match = /filename="([^"]+)"/.exec(header ?? '')
  return match?.[1] || 'pack.zip'
}

async function confirm() {
  if (busy.value) {
    return
  }
  busy.value = true
  error.value = ''
  try {
    const response = await fetch(`/api/bots/${props.botId}/pack`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        botSlug: botSlug.value.trim(),
        version: version.value.trim(),
        readme: readme.value,
      }),
    })
    if (!response.ok) {
      throw new Error('export')
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filenameFromDisposition(response.headers.get('content-disposition'))
    link.click()
    URL.revokeObjectURL(url)
    emit('downloaded')
  } catch {
    error.value = t('pack.exportFailed')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.pack-export {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.id {
  margin: 0;
  font-weight: 800;
  word-break: break-all;
}

.note {
  margin: 0;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 0.35rem;
}
</style>
