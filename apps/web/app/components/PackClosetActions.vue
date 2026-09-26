<template>
  <section
    class="pack"
    aria-labelledby="pack-heading"
  >
    <h2 id="pack-heading">
      {{ $t('pack.title') }}
    </h2>
    <p class="hint">
      {{ $t('pack.hint') }}
    </p>
    <div class="row">
      <KitButton
        type="button"
        variant="ghost"
        :disabled="exporting"
        @click="exportPack"
      >
        {{ exporting ? $t('pack.exportBusy') : $t('pack.export') }}
      </KitButton>
      <KitButton
        type="button"
        variant="ghost"
        :disabled="previewing"
        @click="pickFile"
      >
        {{ previewing ? $t('common.loading') : $t('pack.apply') }}
      </KitButton>
      <button
        type="button"
        class="folder"
        :disabled="previewing"
        @click="pickFolder"
      >
        {{ $t('pack.folder') }}
      </button>
      <input
        ref="fileInput"
        type="file"
        accept=".zip,application/zip,application/json"
        class="file"
        @change="onFile"
      >
      <input
        ref="folderInput"
        type="file"
        class="file"
        multiple
        webkitdirectory
        @change="onFolder"
      >
    </div>
    <p
      v-if="error"
      class="error"
    >
      {{ error }}
    </p>
  </section>

  <KitSheet
    v-model:open="open"
    edge="end"
    :title="$t('pack.previewTitle')"
    title-align="center"
    close="icon"
  >
    <PackApplySheet
      v-if="pack && plan && open"
      :pack="pack"
      :plan="plan"
      :can-update="canUpdate"
      :bot-id="botId"
      @applied="onApplied"
      @cancel="open = false"
    />
  </KitSheet>
</template>

<script setup lang="ts">
import type { PackApplyPlan, PackTree } from '@dostigus/shared'
import { KitButton, KitSheet } from '@dostigus/ui-kit'

const props = defineProps<{
  botId: string
  canUpdate: boolean
}>()

const emit = defineEmits<{
  applied: [botId: string]
}>()

const { t } = useI18n()
const fileInput = ref<HTMLInputElement | null>(null)
const folderInput = ref<HTMLInputElement | null>(null)
const exporting = ref(false)
const previewing = ref(false)
const error = ref('')
const open = ref(false)
const pack = ref<PackTree | null>(null)
const plan = ref<PackApplyPlan | null>(null)

function pickFile() {
  error.value = ''
  fileInput.value?.click()
}

function pickFolder() {
  error.value = ''
  folderInput.value?.click()
}

function filenameFromDisposition(header: string | null): string {
  const match = /filename="([^"]+)"/.exec(header ?? '')
  return match?.[1] || 'pack.zip'
}

async function exportPack() {
  exporting.value = true
  error.value = ''
  try {
    const response = await fetch(`/api/bots/${props.botId}/pack`)
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
  } catch {
    error.value = t('pack.exportFailed')
  } finally {
    exporting.value = false
  }
}

async function onFile(event: Event) {
  const input = event.target instanceof HTMLInputElement ? event.target : null
  const file = input?.files?.[0]
  if (input) {
    input.value = ''
  }
  if (!file) {
    return
  }
  previewing.value = true
  error.value = ''
  try {
    const form = new FormData()
    form.set('file', file, file.name)
    form.set('target', props.canUpdate ? 'update' : 'create')
    if (props.canUpdate) {
      form.set('botId', props.botId)
    }
    const body = await $fetch<{ pack: PackTree, plan: PackApplyPlan }>('/api/packs/preview', {
      method: 'POST',
      body: form,
    })
    pack.value = body.pack
    plan.value = body.plan
    open.value = true
  } catch {
    error.value = t('pack.previewFailed')
  } finally {
    previewing.value = false
  }
}

async function onFolder(event: Event) {
  const input = event.target instanceof HTMLInputElement ? event.target : null
  const files = input?.files
  if (input) {
    input.value = ''
  }
  if (!files || files.length === 0) {
    return
  }
  previewing.value = true
  error.value = ''
  try {
    const form = new FormData()
    for (const file of files) {
      const path = file.webkitRelativePath || file.name
      form.append('file', file, path)
    }
    form.set('target', props.canUpdate ? 'update' : 'create')
    if (props.canUpdate) {
      form.set('botId', props.botId)
    }
    const body = await $fetch<{ pack: PackTree, plan: PackApplyPlan }>('/api/packs/preview', {
      method: 'POST',
      body: form,
    })
    pack.value = body.pack
    plan.value = body.plan
    open.value = true
  } catch {
    error.value = t('pack.previewFailed')
  } finally {
    previewing.value = false
  }
}

function onApplied(botId: string) {
  open.value = false
  emit('applied', botId)
}
</script>

<style scoped>
.pack {
  margin: 0 0 1.15rem;
}

.pack h2 {
  margin: 0 0 0.35rem;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text-muted);
}

.hint {
  margin: 0 0 0.7rem;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.4;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.file {
  display: none;
}

.folder {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0.45rem 0.2rem;
}

.folder:disabled {
  opacity: 0.6;
  cursor: default;
}

.error {
  margin: 0.65rem 0 0;
  color: var(--accent);
  font-size: 0.88rem;
}
</style>
