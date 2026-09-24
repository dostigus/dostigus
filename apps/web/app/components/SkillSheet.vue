<template>
  <div class="skill">
    <p
      v-if="gone"
      class="gone"
    >
      This Skill is gone.
    </p>
    <p
      v-else-if="loadError"
      class="flash"
      role="alert"
    >
      {{ loadError }}
    </p>
    <p
      v-else-if="!skill"
      class="muted"
    >
      Loading…
    </p>
    <form
      v-else
      class="form"
      @submit.prevent="save"
    >
      <label class="field">
        <span>Id</span>
        <input
          v-model="skillIdDraft"
          type="text"
          maxlength="64"
          required
          autocomplete="off"
          :disabled="busy"
        >
      </label>
      <label class="field">
        <span>Instructions</span>
        <textarea
          v-model="instructions"
          rows="8"
          maxlength="4000"
          required
          :disabled="busy"
        />
      </label>
      <div
        v-if="!confirming"
        class="actions"
      >
        <KitButton
          type="submit"
          :disabled="busy"
        >
          Save
        </KitButton>
        <KitButton
          type="button"
          :disabled="busy"
          @click="confirming = true"
        >
          Delete
        </KitButton>
      </div>
      <div
        v-else
        class="confirm"
      >
        <p>Delete this Skill?</p>
        <div class="actions">
          <KitButton
            type="button"
            :disabled="busy"
            @click="remove"
          >
            Delete
          </KitButton>
          <KitButton
            type="button"
            :disabled="busy"
            @click="confirming = false"
          >
            Cancel
          </KitButton>
        </div>
      </div>
      <p
        v-if="saveError"
        class="flash"
        role="alert"
      >
        {{ saveError }}
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { KitButton } from '@dostigus/ui-kit'

type SkillView = {
  id: string
  instructions: string
}

const props = defineProps<{
  botId: string
  skillId: string
}>()

const skill = ref<SkillView | null>(null)
const skillIdDraft = ref('')
const instructions = ref('')
const gone = ref(false)
const loadError = ref('')
const saveError = ref('')
const busy = ref(false)
const confirming = ref(false)

watch(() => [props.botId, props.skillId] as const, () => {
  void load()
}, { immediate: true })

function apply(next: SkillView) {
  skill.value = next
  skillIdDraft.value = next.id
  instructions.value = next.instructions
  gone.value = false
}

function skillPath(id = props.skillId): string {
  return `/api/bots/${encodeURIComponent(props.botId)}/skills/${encodeURIComponent(id)}`
}

async function load() {
  gone.value = false
  loadError.value = ''
  saveError.value = ''
  confirming.value = false
  skill.value = null
  if (!props.botId || !props.skillId) {
    gone.value = true
    return
  }
  try {
    const body = await $fetch<{ skill: SkillView }>(skillPath())
    apply(body.skill)
  } catch (error) {
    if (statusOf(error) === 404) {
      gone.value = true
      return
    }
    loadError.value = messageOf(error)
  }
}

async function save() {
  if (!skill.value || busy.value) {
    return
  }
  busy.value = true
  saveError.value = ''
  try {
    const body = await $fetch<{ skill: SkillView }>(skillPath(skill.value.id), {
      method: 'PATCH',
      body: {
        id: skillIdDraft.value,
        instructions: instructions.value,
      },
    })
    apply(body.skill)
  } catch (error) {
    saveError.value = messageOf(error)
  } finally {
    busy.value = false
  }
}

async function remove() {
  if (!skill.value || busy.value) {
    return
  }
  busy.value = true
  saveError.value = ''
  try {
    await $fetch(skillPath(skill.value.id), { method: 'DELETE' })
    skill.value = null
    gone.value = true
    confirming.value = false
  } catch (error) {
    saveError.value = messageOf(error)
  } finally {
    busy.value = false
  }
}

function statusOf(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const code = (error as { statusCode?: number }).statusCode
    return typeof code === 'number' ? code : undefined
  }
  return undefined
}

function messageOf(error: unknown): string {
  if (error && typeof error === 'object' && 'statusMessage' in error) {
    const status = (error as { statusMessage?: string }).statusMessage
    if (status?.trim()) {
      return status
    }
  }
  return 'Skill could not save'
}
</script>

<style scoped>
.skill {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form,
.field,
.actions {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.actions {
  flex-direction: row;
  flex-wrap: wrap;
}

.muted,
.gone {
  margin: 0;
}

.flash {
  margin: 0;
  color: var(--accent, #f25630);
}
</style>
