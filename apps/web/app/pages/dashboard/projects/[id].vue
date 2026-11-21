<template>
  <div class="project">
    <header class="head">
      <div>
        <p class="back">
          <NuxtLink to="/dashboard/projects">
            {{ $t('projects.title') }}
          </NuxtLink>
        </p>
        <h1>{{ project?.name }}</h1>
        <p v-if="project">
          {{ project.slug }}
        </p>
      </div>
      <KitButton
        v-if="project?.architectBotId"
        type="button"
        @click="openChat"
      >
        {{ $t('projects.chat') }}
      </KitButton>
    </header>

    <p
      v-if="loadError"
      role="alert"
    >
      {{ loadError }}
    </p>

    <template v-if="project">
      <KitPanel
        as="form"
        :title="$t('projects.addTask')"
        @submit.prevent="addTask"
      >
        <KitField
          :label="$t('projects.taskTitle')"
          :error="taskError || undefined"
          required
        >
          <KitInput
            v-model="title"
            name="title"
            autocomplete="off"
            required
          />
        </KitField>
        <KitField :label="$t('projects.taskBody')">
          <KitTextarea
            v-model="body"
            name="body"
            :rows="3"
          />
        </KitField>
        <KitField :label="$t('projects.mode')">
          <KitSelect
            :model-value="mode"
            name="mode"
            :options="modeOptions"
            @update:model-value="pickMode"
          />
        </KitField>
        <template #actions>
          <KitButton
            type="submit"
            :disabled="adding || !title.trim()"
          >
            {{ adding ? $t('common.saving') : $t('projects.addTask') }}
          </KitButton>
        </template>
      </KitPanel>

      <div
        class="board"
        :aria-label="$t('projects.board')"
      >
        <section
          v-for="column in columns"
          :key="column.status"
          class="column"
          :data-status="column.status"
        >
          <h2>{{ $t(`projects.statuses.${column.status}`) }}</h2>
          <p
            v-if="!column.tasks.length"
            class="empty"
          >
            {{ $t('projects.noTasks') }}
          </p>
          <KitListRow
            v-for="task in column.tasks"
            :key="task.id"
            as="button"
            :title="task.title"
            :subtitle="$t(`projects.modes.${task.mode}`)"
            interactive
            :selected="task.id === selectedId"
            @click="selectedId = task.id"
          />
        </section>
      </div>

      <KitPanel
        v-if="selected"
        class="card"
        :title="selected.title"
        :description="$t(`projects.modes.${selected.mode}`)"
      >
        <p
          v-if="selected.body"
          class="body"
        >
          {{ selected.body }}
        </p>
        <KitField :label="$t('projects.status')">
          <KitSelect
            :model-value="selected.status"
            name="status"
            :options="statusOptions"
            :disabled="moving"
            @update:model-value="move(String($event))"
          />
        </KitField>
        <h3>{{ $t('projects.attachments') }}</h3>
        <ChatMessageArtifacts :artifacts="selected.attachments" />
        <p
          v-if="!selected.attachments.length"
          class="empty"
        >
          {{ $t('projects.noAttachments') }}
        </p>
        <p
          v-if="attachError"
          role="alert"
        >
          {{ attachError }}
        </p>
        <label class="file">
          <span>{{ $t('projects.addFile') }}</span>
          <input
            type="file"
            name="attachment"
            :disabled="uploading"
            @change="onFile"
          >
        </label>
      </KitPanel>

      <KitPanel
        :title="$t('projects.tokenTitle')"
        :description="$t('projects.tokenHint')"
      >
        <p
          v-if="issued"
          class="token"
        >
          <KitField :label="$t('projects.tokenOnce')">
            <KitInput
              :model-value="issued"
              name="project-token"
              readonly
            />
          </KitField>
        </p>
        <ul
          v-if="tokens.length"
          class="tokens"
        >
          <li
            v-for="token in tokens"
            :key="token.id"
          >
            <span>{{ token.label || $t('projects.tokenTitle') }}</span>
            <span class="when">{{ token.revokedAt ? $t('projects.revoked') : token.createdAt }}</span>
            <KitButton
              v-if="!token.revokedAt"
              type="button"
              variant="ghost"
              size="sm"
              @click="revoke(token.id)"
            >
              {{ $t('projects.revoke') }}
            </KitButton>
          </li>
        </ul>
        <template #actions>
          <KitButton
            type="button"
            :disabled="issuing"
            @click="issue"
          >
            {{ issuing ? $t('common.saving') : $t('projects.issueToken') }}
          </KitButton>
        </template>
      </KitPanel>

      <KitPanel
        as="form"
        :title="$t('projects.repoTitle')"
        :description="$t('projects.repoHint')"
        @submit.prevent="saveRepo"
      >
        <KitField
          :label="$t('projects.fullName')"
          :error="repoError || undefined"
        >
          <KitInput
            v-model="fullName"
            name="fullName"
            placeholder="owner/repo"
            autocomplete="off"
            spellcheck="false"
          />
        </KitField>
        <KitField :label="$t('projects.branch')">
          <KitInput
            v-model="branch"
            name="defaultBranch"
            autocomplete="off"
            spellcheck="false"
          />
        </KitField>
        <template #actions>
          <span role="status">
            <KitChip
              v-if="repoSaved"
              tone="ok"
            >
              {{ $t('projects.saved') }}
            </KitChip>
          </span>
          <KitButton
            type="submit"
            :disabled="repoSaving || !fullName.trim()"
          >
            {{ repoSaving ? $t('common.saving') : $t('projects.save') }}
          </KitButton>
        </template>
      </KitPanel>

      <KitPanel
        v-if="project.repo"
        as="form"
        :title="$t('projects.commandsTitle')"
        :description="$t('projects.commandsHint')"
        @submit.prevent="saveCommands"
      >
        <KitField
          v-for="key in commandKeys"
          :key="key"
          :label="key"
        >
          <KitInput
            v-model="commandInputs[key]"
            :name="key"
            autocomplete="off"
            spellcheck="false"
          />
        </KitField>
        <template #actions>
          <KitButton
            type="submit"
            :disabled="commandsSaving"
          >
            {{ commandsSaving ? $t('common.saving') : $t('projects.save') }}
          </KitButton>
        </template>
      </KitPanel>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Commands, Project, ProjectTokenView, Task, TaskMode, TaskStatus } from '@dostigus/db'
import type { Artifact } from '@dostigus/shared'
import type { KitSelectOption } from '@dostigus/ui-kit'
import { COMMAND_KEYS, TASK_MODES, TASK_STATUSES } from '@dostigus/db'
import { KitButton, KitChip, KitField, KitInput, KitListRow, KitPanel, KitSelect, KitTextarea } from '@dostigus/ui-kit'
import { hostStatusCopy } from '../../../utils/host-status-copy'
import { boardColumns } from '../../../utils/project-board'

type ProjectPayload = {
  project: Project
  tasks: Task[]
  tokens: ProjectTokenView[]
}

const route = useRoute()
const { t } = useI18n()
const id = computed(() => String(route.params.id))

const { data, error, refresh } = await useFetch<ProjectPayload>(() => `/api/projects/${id.value}`)
const project = computed(() => data.value?.project)
const tasks = computed(() => data.value?.tasks ?? [])
const tokens = computed(() => data.value?.tokens ?? [])
const columns = computed(() => boardColumns(tasks.value))
const loadError = computed(() => error.value ? hostStatusCopy(error.value, t, 'projects.failed') : '')

const selectedId = ref('')
const selected = computed(() => tasks.value.find((task) => task.id === selectedId.value))

const title = ref('')
const body = ref('')
const mode = ref<TaskMode>('feature')
const adding = ref(false)
const taskError = ref('')
const moving = ref(false)
const uploading = ref(false)
const attachError = ref('')
const issuing = ref(false)
const issued = ref('')
const fullName = ref('')
const branch = ref('main')
const repoSaving = ref(false)
const repoSaved = ref(false)
const repoError = ref('')
const commandsSaving = ref(false)
const commandKeys = COMMAND_KEYS
const commandInputs = reactive<Record<string, string>>({
  setup: '',
  lint: '',
  test: '',
  check: '',
  run: '',
  preview: '',
})

watch(project, (value) => {
  if (!value) {
    return
  }
  fullName.value = value.repo?.fullName ?? ''
  branch.value = value.repo?.defaultBranch ?? 'main'
  for (const key of COMMAND_KEYS) {
    commandInputs[key] = value.repo?.commands[key] ?? ''
  }
}, { immediate: true })

const modeOptions = computed<KitSelectOption[]>(() => TASK_MODES.map((value) => ({
  value,
  label: t(`projects.modes.${value}`),
})))
const statusOptions = computed<KitSelectOption[]>(() => TASK_STATUSES.map((value) => ({
  value,
  label: t(`projects.statuses.${value}`),
})))

function pickMode(value: string | undefined) {
  if (value && (TASK_MODES as readonly string[]).includes(value)) {
    mode.value = value as TaskMode
  }
}

function openChat() {
  const botId = project.value?.architectBotId
  if (botId) {
    void navigateTo(`/bots/${botId}`)
  }
}

async function addTask() {
  adding.value = true
  taskError.value = ''
  try {
    const created = await $fetch<{ task: Task }>(`/api/projects/${id.value}/tasks`, {
      method: 'POST',
      body: { title: title.value.trim(), body: body.value, mode: mode.value },
    })
    title.value = ''
    body.value = ''
    await refresh()
    selectedId.value = created.task.id
  } catch (cause) {
    taskError.value = hostStatusCopy(cause, t, 'projects.failed')
  } finally {
    adding.value = false
  }
}

async function move(status: string) {
  const task = selected.value
  if (!task || status === task.status) {
    return
  }
  moving.value = true
  try {
    await $fetch(`/api/tasks/${task.id}/transition`, {
      method: 'POST',
      body: { status: status as TaskStatus },
    })
    await refresh()
  } catch (cause) {
    attachError.value = hostStatusCopy(cause, t, 'projects.failed')
  } finally {
    moving.value = false
  }
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const task = selected.value
  if (!file || !task) {
    return
  }
  uploading.value = true
  attachError.value = ''
  try {
    const form = new FormData()
    form.append('file', file, file.name || 'file')
    const uploaded = await $fetch<{ artifact: Artifact }>('/api/artifacts', {
      method: 'POST',
      body: form,
    })
    await $fetch(`/api/tasks/${task.id}/attachments`, {
      method: 'POST',
      body: { artifactId: uploaded.artifact.id },
    })
    await refresh()
  } catch (cause) {
    attachError.value = hostStatusCopy(cause, t, 'projects.failed')
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function issue() {
  issuing.value = true
  try {
    const result = await $fetch<{ token: { token: string } }>(`/api/projects/${id.value}/token`, {
      method: 'POST',
      body: { label: 'Architect' },
    })
    issued.value = result.token.token
    await refresh()
  } catch (cause) {
    attachError.value = hostStatusCopy(cause, t, 'projects.failed')
  } finally {
    issuing.value = false
  }
}

async function revoke(tokenId: string) {
  await $fetch(`/api/projects/${id.value}/tokens/${tokenId}/revoke`, { method: 'POST' })
  if (issued.value) {
    issued.value = ''
  }
  await refresh()
}

async function saveRepo() {
  repoSaving.value = true
  repoSaved.value = false
  repoError.value = ''
  try {
    await $fetch(`/api/projects/${id.value}/repo`, {
      method: 'PUT',
      body: { fullName: fullName.value.trim(), defaultBranch: branch.value.trim() || 'main' },
    })
    repoSaved.value = true
    await refresh()
  } catch (cause) {
    repoError.value = hostStatusCopy(cause, t, 'projects.failed')
  } finally {
    repoSaving.value = false
  }
}

async function saveCommands() {
  commandsSaving.value = true
  const commands: Partial<Commands> = {}
  for (const key of COMMAND_KEYS) {
    commands[key] = commandInputs[key] ?? ''
  }
  try {
    await $fetch(`/api/projects/${id.value}/commands`, {
      method: 'PUT',
      body: commands,
    })
    await refresh()
  } catch (cause) {
    repoError.value = hostStatusCopy(cause, t, 'projects.failed')
  } finally {
    commandsSaving.value = false
  }
}
</script>

<style scoped>
.project {
  max-width: 72rem;
}

.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.head h1 {
  margin: 0.2rem 0;
  font-size: 1.45rem;
}

.head p,
.empty,
.body {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.5;
}

.back a {
  color: var(--text-muted);
  text-decoration: none;
}

.board {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  margin: 1rem 0;
  padding-bottom: 0.25rem;
}

.column {
  flex: 0 0 15rem;
  display: grid;
  gap: 0.4rem;
  align-content: start;
  padding: 0.75rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--card);
}

.column h2,
.card h3 {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
}

.body {
  white-space: pre-wrap;
}

.tokens {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.4rem;
}

.tokens li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.file {
  display: grid;
  gap: 0.35rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.file input {
  color: var(--text);
}
</style>
