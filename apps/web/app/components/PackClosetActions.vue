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
    <KitListRow
      as="a"
      class="catalog"
      :title="$t('pack.catalog')"
      :subtitle="$t('pack.catalogHint')"
      href="https://dostigus.ru/marketplace"
      target="_blank"
      rel="noopener noreferrer"
    >
      <template #trailing>
        <span
          class="chevron"
          aria-hidden="true"
        >›</span>
      </template>
    </KitListRow>
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
      <KitButton
        type="button"
        variant="ghost"
        :disabled="previewing"
        @click="pickFolder"
      >
        {{ $t('pack.folder') }}
      </KitButton>
    </div>
    <form
      class="remote"
      @submit.prevent="previewRemote"
    >
      <KitField
        :label="$t('pack.url')"
        :error="remoteError || undefined"
      >
        <KitInput
          v-model="remoteUrl"
          type="url"
          autocomplete="off"
          spellcheck="false"
          :placeholder="$t('pack.urlPlaceholder')"
          :readonly="previewing"
        />
      </KitField>
      <div class="remote-extra">
        <KitField :label="$t('pack.ref')">
          <KitInput
            v-model="remoteRef"
            autocomplete="off"
            spellcheck="false"
            :readonly="previewing"
          />
        </KitField>
        <KitField :label="$t('pack.path')">
          <KitInput
            v-model="remotePath"
            autocomplete="off"
            spellcheck="false"
            :readonly="previewing"
          />
        </KitField>
      </div>
      <div class="row">
        <KitButton
          type="submit"
          variant="ghost"
          :disabled="previewing || !remoteUrl.trim()"
        >
          {{ previewing ? $t('common.loading') : $t('pack.urlPreview') }}
        </KitButton>
      </div>
    </form>
    <div class="hidden-inputs">
      <input
        ref="fileInput"
        type="file"
        accept=".zip,application/zip,application/json"
        @change="onFile"
      >
      <input
        ref="folderInput"
        type="file"
        multiple
        webkitdirectory
        @change="onFolder"
      >
    </div>
    <p
      v-if="error"
      class="error"
      role="alert"
    >
      {{ error }}
    </p>
  </section>

  <KitSheet
    v-model:open="exportOpen"
    edge="end"
    :title="$t('pack.exportTitle')"
    title-align="center"
    close="icon"
  >
    <PackExportSheet
      v-if="exportPreview && exportOpen"
      :bot-id="botId"
      :author="exportPreview.author"
      :bot-slug="exportPreview.botSlug"
      :version="exportPreview.version"
      :readme="exportPreview.readme"
      @downloaded="exportOpen = false"
      @cancel="exportOpen = false"
    />
  </KitSheet>

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
import { KitButton, KitField, KitInput, KitListRow, KitSheet } from '@dostigus/ui-kit'
import { hostStatusCopy } from '../utils/host-status-copy'

type PackExportPreview = {
  author: string
  botSlug: string
  version: string
  id: string
  readme: string
  needsSheet: boolean
  reasons: Array<'empty-slug' | 'conflict' | 're-export'>
}

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
const remoteUrl = ref('')
const remoteRef = ref('')
const remotePath = ref('')
const exporting = ref(false)
const previewing = ref(false)
const error = ref('')
const remoteError = ref('')
const open = ref(false)
const pack = ref<PackTree | null>(null)
const plan = ref<PackApplyPlan | null>(null)
const exportOpen = ref(false)
const exportPreview = ref<PackExportPreview | null>(null)

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

async function downloadZip(response: Response) {
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filenameFromDisposition(response.headers.get('content-disposition'))
  link.click()
  URL.revokeObjectURL(url)
}

async function exportPack() {
  exporting.value = true
  error.value = ''
  try {
    const options = await $fetch<PackExportPreview>(`/api/bots/${props.botId}/pack/options`)
    if (options.needsSheet) {
      exportPreview.value = options
      exportOpen.value = true
      return
    }
    const response = await fetch(`/api/bots/${props.botId}/pack`)
    if (!response.ok) {
      throw new Error('export')
    }
    await downloadZip(response)
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
  } catch (caught) {
    error.value = hostStatusCopy(caught, t, 'pack.previewFailed')
  } finally {
    previewing.value = false
  }
}

async function previewRemote() {
  const url = remoteUrl.value.trim()
  if (!url || previewing.value) {
    return
  }
  previewing.value = true
  error.value = ''
  remoteError.value = ''
  try {
    const body = await $fetch<{ pack: PackTree, plan: PackApplyPlan }>('/api/packs/preview', {
      method: 'POST',
      body: {
        url,
        ref: remoteRef.value.trim() || undefined,
        path: remotePath.value.trim() || undefined,
        target: props.canUpdate ? 'update' : 'create',
        botId: props.canUpdate ? props.botId : undefined,
      },
    })
    pack.value = body.pack
    plan.value = body.plan
    open.value = true
  } catch (caught) {
    remoteError.value = hostStatusCopy(caught, t, 'pack.previewFailed')
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
  } catch (caught) {
    error.value = hostStatusCopy(caught, t, 'pack.previewFailed')
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
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--line);
}

.pack h2 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text-muted);
}

.hint,
.error {
  margin: 0;
}

.error {
  color: var(--accent);
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.45;
}

.hint {
  margin-top: -0.35rem;
  color: var(--text-muted);
  font-size: 0.82rem;
  line-height: 1.45;
}

.catalog {
  margin-inline: -0.7rem;
}

.chevron {
  font-size: 1.25rem;
  line-height: 1;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.remote {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.remote-extra {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: 0.6rem;
}

.hidden-inputs {
  display: none;
}
</style>
