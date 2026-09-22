<template>
  <KitSheet
    v-model:open="open"
    edge="end"
    title="Bot"
    description="Appearance, name, and Model tier."
  >
    <section
      v-if="bot"
      class="appearance"
      aria-label="Appearance"
    >
      <div
        class="tabs"
        role="tablist"
        aria-label="Appearance tools"
      >
        <button
          type="button"
          class="tab active"
          role="tab"
          aria-selected="true"
        >
          Bot
        </button>
        <button
          v-if="isOwner"
          type="button"
          class="tab action"
          :disabled="saving || deleting"
          @click="resetAppearance"
        >
          Reset
        </button>
      </div>

      <div
        class="shapes"
        role="group"
        aria-label="Avatar shape"
      >
        <button
          v-for="item in shapes"
          :key="item"
          type="button"
          class="shape"
          :class="{ selected: shape === item }"
          :disabled="!isOwner || saving"
          :aria-label="shapeLabel(item)"
          :aria-pressed="shape === item"
          @click="pickShape(item)"
        >
          <KitBotAvatar
            :shape="item"
            :color="color"
            size="lg"
            :state="shape === item ? 'idle' : 'none'"
          />
        </button>
      </div>

      <div
        class="swatches"
        role="group"
        aria-label="Avatar color"
      >
        <button
          v-for="swatch in accents"
          :key="swatch.hex"
          type="button"
          class="swatch"
          :class="{ selected: color === swatch.hex }"
          :style="{ background: `var(${swatch.cssVar})` }"
          :disabled="!isOwner || saving"
          :aria-label="`Color ${swatch.token}`"
          :aria-pressed="color === swatch.hex"
          @click="pickColor(swatch.hex)"
        />
      </div>
    </section>

    <form
      v-if="isOwner && bot"
      class="form"
      @submit.prevent="save"
    >
      <label class="field">
        <span>Name</span>
        <input
          v-model="name"
          type="text"
          maxlength="120"
          autocomplete="off"
          required
        >
      </label>
      <label class="field">
        <span>Model tier</span>
        <select v-model="tier">
          <option
            v-for="item in tiers"
            :key="item"
            :value="item"
          >
            {{ MODEL_TIER_LABELS[item] }}
          </option>
        </select>
      </label>
      <p
        v-if="error"
        class="error"
      >
        {{ error }}
      </p>
      <KitButton
        type="submit"
        :disabled="saving || !name.trim()"
      >
        {{ saving ? 'Saving…' : 'Save' }}
      </KitButton>
    </form>

    <dl
      v-else-if="bot"
      class="read"
    >
      <dt>Name</dt>
      <dd>{{ bot.name }}</dd>
      <dt>Model tier</dt>
      <dd>{{ MODEL_TIER_LABELS[bot.manifest.modelTier] }}</dd>
    </dl>

    <div
      v-if="isOwner && bot"
      class="danger"
    >
      <p>Delete this Bot and its Chat.</p>
      <div
        v-if="confirmDelete"
        class="row"
      >
        <button
          type="button"
          class="ghost"
          :disabled="deleting"
          @click="confirmDelete = false"
        >
          Cancel
        </button>
        <button
          type="button"
          class="danger-btn"
          :disabled="deleting"
          @click="remove"
        >
          {{ deleting ? 'Deleting…' : 'Confirm delete' }}
        </button>
      </div>
      <button
        v-else
        type="button"
        class="danger-btn"
        :disabled="deleting || saving"
        @click="confirmDelete = true"
      >
        Delete
      </button>
    </div>
  </KitSheet>
</template>

<script setup lang="ts">
import type { Bot, BotAccentHex, BotAvatarShape, ModelTier } from '@dostigus/shared'
import {
  BOT_ACCENT_TOKENS,
  BOT_AVATAR_SHAPE_LABELS,
  BOT_AVATAR_SHAPES,
  DEFAULT_AVATAR_COLOR,
  DEFAULT_AVATAR_SHAPE,
  MODEL_TIER_LABELS,
  MODEL_TIERS,
} from '@dostigus/shared'
import { KitBotAvatar, KitButton, KitSheet } from '@dostigus/ui-kit'

const props = defineProps<{
  bot: Bot | undefined
}>()

const emit = defineEmits<{
  saved: []
  deleted: []
}>()

const open = defineModel<boolean>('open', { required: true })

const { isOwner } = useHostAccount()
const tiers = MODEL_TIERS
const shapes = BOT_AVATAR_SHAPES
const accents = BOT_ACCENT_TOKENS
const name = ref('')
const tier = ref<ModelTier>('strong')
const shape = ref<BotAvatarShape>(DEFAULT_AVATAR_SHAPE)
const color = ref<BotAccentHex>(DEFAULT_AVATAR_COLOR)
const saving = ref(false)
const deleting = ref(false)
const confirmDelete = ref(false)
const error = ref('')

watch(() => props.bot?.id, () => {
  syncFromBot()
})

watch(open, (isOpen) => {
  if (isOpen) {
    syncFromBot()
    return
  }
  confirmDelete.value = false
  error.value = ''
})

function syncFromBot() {
  if (!props.bot) {
    return
  }
  name.value = props.bot.name
  tier.value = props.bot.manifest.modelTier
  shape.value = props.bot.manifest.avatarShape
  color.value = props.bot.manifest.avatarColor
  error.value = ''
  confirmDelete.value = false
}

function shapeLabel(value: BotAvatarShape): string {
  return BOT_AVATAR_SHAPE_LABELS[value]
}

function pickShape(value: BotAvatarShape) {
  if (!isOwner.value) {
    return
  }
  shape.value = value
}

function pickColor(value: BotAccentHex) {
  if (!isOwner.value) {
    return
  }
  color.value = value
}

function resetAppearance() {
  if (!isOwner.value) {
    return
  }
  shape.value = DEFAULT_AVATAR_SHAPE
  color.value = DEFAULT_AVATAR_COLOR
}

async function save() {
  if (!props.bot || !isOwner.value || saving.value) {
    return
  }
  const nextName = name.value.trim()
  if (!nextName) {
    return
  }
  saving.value = true
  error.value = ''
  try {
    await $fetch(`/api/bots/${props.bot.id}`, {
      method: 'PATCH',
      body: {
        name: nextName,
        modelTier: tier.value,
        avatarShape: shape.value,
        avatarColor: color.value,
      },
    })
    emit('saved')
  } catch {
    error.value = 'Could not save this Bot.'
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!props.bot || !isOwner.value || deleting.value) {
    return
  }
  deleting.value = true
  error.value = ''
  try {
    await $fetch(`/api/bots/${props.bot.id}`, { method: 'DELETE' })
    emit('deleted')
  } catch {
    error.value = 'Could not delete this Bot.'
  } finally {
    deleting.value = false
  }
}
</script>

<style scoped>
.appearance {
  margin: 0 0 1.25rem;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.85rem;
  margin-bottom: 1rem;
}

.tab {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-weight: 600;
  font-size: 0.95rem;
  padding: 0.4rem 0.85rem;
  border-radius: var(--radius);
  cursor: default;
}

.tab.active {
  background: var(--surface);
  color: var(--text);
}

.tab.action {
  cursor: pointer;
}

.tab.action:hover:not(:disabled) {
  color: var(--text);
}

.tab.action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.shapes {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem 0.45rem;
  margin-bottom: 1.15rem;
}

.shape {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 0.35rem 0.2rem;
  border-radius: var(--radius);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 120ms ease;
}

.shape:hover:not(:disabled) {
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

.shape.selected {
  background: color-mix(in srgb, var(--text) 9%, transparent);
  outline: 2px solid var(--accent-dim);
  outline-offset: -1px;
}

.shape:disabled {
  cursor: default;
}

.shape:focus-visible {
  outline: 2px solid var(--accent-dim);
  outline-offset: 2px;
}

.swatches {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.7rem 0.55rem;
  width: 100%;
  padding: 0.15rem 0.25rem 0.35rem;
}

.swatch {
  appearance: none;
  flex: 0 0 calc((100% - 5 * 0.55rem) / 6);
  width: calc((100% - 5 * 0.55rem) / 6);
  aspect-ratio: 1;
  height: auto;
  border-radius: 999px;
  border: 0;
  padding: 0;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 18%);
}

.swatch.selected {
  box-shadow:
    0 0 0 2px var(--surface),
    0 0 0 3.5px #3a3a3a;
}

.swatch:disabled {
  cursor: default;
}

.swatch:focus-visible {
  outline: 2px solid var(--accent-dim);
  outline-offset: 2px;
}

.form,
.read {
  margin: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.9rem;
  font-size: 0.82rem;
  color: var(--text-muted);
}

input,
select {
  appearance: none;
  width: 100%;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.75rem;
  font: inherit;
  font-size: 1rem;
}

input:focus,
select:focus {
  outline: 1px solid var(--accent-dim);
}

.read dt {
  margin: 0.85rem 0 0.2rem;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.read dd {
  margin: 0;
  font-weight: 700;
}

.error {
  margin: 0 0 0.75rem;
  color: var(--accent);
  font-size: 0.88rem;
}

.danger {
  margin-top: 1.4rem;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
}

.danger p {
  margin: 0 0 0.75rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.ghost,
.danger-btn {
  appearance: none;
  border-radius: var(--radius);
  padding: 0.55rem 0.95rem;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
}

.ghost {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text-muted);
}

.danger-btn {
  border: 1px solid var(--accent-dim);
  background: transparent;
  color: var(--accent);
}

.ghost:disabled,
.danger-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
