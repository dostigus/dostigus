<template>
  <div class="pack-export">
    <p class="id">
      {{ $t('pack.exportId', { author, slug: botSlug }) }}
    </p>
    <label class="field">
      <span>{{ $t('pack.exportAuthor') }}</span>
      <input
        :value="author"
        type="text"
        readonly
      >
    </label>
    <label class="field">
      <span>{{ $t('pack.exportSlug') }}</span>
      <input
        v-model="botSlug"
        type="text"
        autocomplete="off"
        maxlength="32"
      >
    </label>
    <label class="field">
      <span>{{ $t('pack.exportVersion') }}</span>
      <input
        v-model="version"
        type="text"
        autocomplete="off"
        maxlength="20"
      >
    </label>
    <label class="field">
      <span>{{ $t('pack.exportReadme') }}</span>
      <textarea
        v-model="readme"
        rows="4"
      />
    </label>
    <p
      v-if="error"
      class="error"
    >
      {{ error }}
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
import { KitButton } from '@dostigus/ui-kit'

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

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-muted);
}

.field input,
.field textarea {
  appearance: none;
  border: 1px solid color-mix(in srgb, var(--text-muted) 28%, transparent);
  border-radius: 0.7rem;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-weight: 600;
  padding: 0.55rem 0.7rem;
}

.field input[readonly] {
  opacity: 0.75;
}

.error {
  margin: 0;
  color: var(--accent);
  font-size: 0.88rem;
  font-weight: 600;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 0.35rem;
}
</style>
