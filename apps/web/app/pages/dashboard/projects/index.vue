<template>
  <div class="projects">
    <header class="head">
      <div>
        <h1>{{ $t('projects.title') }}</h1>
        <p>{{ $t('projects.lead') }}</p>
      </div>
    </header>

    <KitPanel
      as="form"
      :title="$t('projects.create')"
      @submit.prevent="create"
    >
      <KitField
        :label="$t('projects.name')"
        :error="error || undefined"
        required
      >
        <KitInput
          v-model="name"
          name="name"
          autocomplete="off"
          required
        />
      </KitField>
      <KitField
        :label="$t('projects.slug')"
        :hint="$t('projects.slugHint')"
      >
        <KitInput
          v-model="slug"
          name="slug"
          autocomplete="off"
          spellcheck="false"
        />
      </KitField>
      <template #actions>
        <KitButton
          type="submit"
          :disabled="saving || !name.trim()"
        >
          {{ saving ? $t('common.saving') : $t('projects.create') }}
        </KitButton>
      </template>
    </KitPanel>

    <p
      v-if="pending"
      class="muted"
    >
      {{ $t('common.loading') }}
    </p>
    <p
      v-else-if="!projects.length"
      class="muted"
    >
      {{ $t('projects.empty') }}
    </p>
    <ul
      v-else
      class="list"
    >
      <li
        v-for="project in projects"
        :key="project.id"
      >
        <KitListRow
          as="button"
          :title="project.name"
          :subtitle="project.slug"
          interactive
          @click="navigateTo(`/dashboard/projects/${project.id}`)"
        />
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { Project } from '@dostigus/db'
import { KitButton, KitField, KitInput, KitListRow, KitPanel } from '@dostigus/ui-kit'
import { hostStatusCopy } from '../../../utils/host-status-copy'

const { t } = useI18n()
const name = ref('')
const slug = ref('')
const saving = ref(false)
const error = ref('')

const { data, pending, refresh } = await useFetch<{ projects: Project[] }>('/api/projects')
const projects = computed(() => data.value?.projects ?? [])

async function create() {
  saving.value = true
  error.value = ''
  try {
    const created = await $fetch<{ project: Project }>('/api/projects', {
      method: 'POST',
      body: {
        name: name.value.trim(),
        slug: slug.value.trim() || undefined,
      },
    })
    await navigateTo(`/dashboard/projects/${created.project.id}`)
  } catch (cause) {
    error.value = hostStatusCopy(cause, t, 'projects.failed')
    saving.value = false
    await refresh()
  }
}
</script>

<style scoped>
.projects {
  max-width: 40rem;
}

.head h1 {
  margin: 0 0 0.35rem;
  font-size: 1.45rem;
}

.head p,
.muted {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.5;
}

.list {
  list-style: none;
  margin: 1rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}
</style>
