<template>
  <KitSheet
    v-model:open="open"
    edge="end"
    title="Параметры"
    title-align="center"
    close="icon"
  >
    <div
      v-if="bot"
      class="mark"
    >
      <KitBotAvatar
        :shape="bot.manifest.avatarShape"
        :color="bot.manifest.avatarColor"
        size="lg"
        :state="heroState"
      />
      <button
        v-if="isOwner"
        type="button"
        class="pencil"
        aria-label="Изменить аватар"
        @click="openAppearance"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M4 20l4.1-.8L19.2 8.1a1.6 1.6 0 0 0 0-2.3l-.9-.9a1.6 1.6 0 0 0-2.3 0L4.8 15.9 4 20z" />
          <path d="M13.6 6.4l4 4" />
        </svg>
      </button>
    </div>

    <form
      v-if="bot"
      class="form"
      @submit.prevent="persistFields"
    >
      <label class="field">
        <span>Имя</span>
        <input
          v-model="name"
          type="text"
          maxlength="120"
          autocomplete="off"
          required
          :disabled="!isOwner || saving"
          @blur="persistFields"
        >
      </label>
      <label class="field">
        <span>Метка (необязательно)</span>
        <input
          v-model="label"
          type="text"
          maxlength="160"
          autocomplete="off"
          placeholder="Например, учёба или работа"
          :disabled="!isOwner || saving"
          @blur="persistFields"
        >
      </label>
      <label class="field">
        <span>Описание</span>
        <textarea
          v-model="description"
          maxlength="2000"
          rows="5"
          placeholder="Для чего нужен этот Bot"
          :disabled="!isOwner || saving"
          @blur="persistFields"
        />
      </label>
      <p
        v-if="error"
        class="error"
      >
        {{ error }}
      </p>
    </form>
  </KitSheet>

  <KitDialog
    v-model:open="appearanceOpen"
    title="Аватар"
    title-align="center"
    close="icon"
  >
    <div
      v-if="bot"
      class="editor"
    >
      <div
        class="shapes"
        role="group"
        aria-label="Птица"
      >
        <button
          v-for="item in shapes"
          :key="item"
          type="button"
          class="shape"
          :class="{ selected: draftShape === item }"
          :disabled="appearanceSaving"
          :aria-label="shapeLabel(item)"
          :aria-pressed="draftShape === item"
          @click="pickShape(item)"
        >
          <KitBotAvatar
            :shape="item"
            :color="draftColor"
            size="lg"
            :state="markState(item)"
          />
        </button>
      </div>

      <div
        class="swatches"
        role="group"
        aria-label="Цвет"
      >
        <button
          v-for="swatch in accents"
          :key="swatch.hex"
          type="button"
          class="swatch"
          :class="{ selected: draftColor === swatch.hex }"
          :style="{ background: `var(${swatch.cssVar})` }"
          :disabled="appearanceSaving"
          :aria-label="`Цвет ${swatch.token}`"
          :aria-pressed="draftColor === swatch.hex"
          @click="pickColor(swatch.hex)"
        />
      </div>

      <p
        v-if="appearanceError"
        class="error"
      >
        {{ appearanceError }}
      </p>

      <div class="actions">
        <button
          type="button"
          class="reset"
          :disabled="appearanceSaving"
          @click="resetAppearance"
        >
          Сбросить
        </button>
        <KitButton
          type="button"
          :disabled="appearanceSaving"
          @click="saveAppearance"
        >
          {{ appearanceSaving ? 'Сохраняем…' : 'Сохранить' }}
        </KitButton>
      </div>
    </div>
  </KitDialog>
</template>

<script setup lang="ts">
import type { Bot, BotAccentHex, BotAvatarShape, BotAvatarState } from '@dostigus/shared'
import {
  BOT_ACCENT_TOKENS,
  BOT_AVATAR_SHAPE_LABELS,
  BOT_AVATAR_SHAPES,
  DEFAULT_AVATAR_COLOR,
  DEFAULT_AVATAR_SHAPE,
} from '@dostigus/shared'
import { KitBotAvatar, KitButton, KitDialog, KitSheet } from '@dostigus/ui-kit'

const props = defineProps<{
  bot: Bot | undefined
}>()

const emit = defineEmits<{
  saved: []
}>()

const open = defineModel<boolean>('open', { required: true })

const { isOwner } = useHostAccount()
const shapes = BOT_AVATAR_SHAPES
const accents = BOT_ACCENT_TOKENS
const name = ref('')
const label = ref('')
const description = ref('')
const saving = ref(false)
const error = ref('')
const appearanceOpen = ref(false)
const draftShape = ref<BotAvatarShape>(DEFAULT_AVATAR_SHAPE)
const draftColor = ref<BotAccentHex>(DEFAULT_AVATAR_COLOR)
const appearanceSaving = ref(false)
const appearanceError = ref('')
const heroGreet = ref(false)
const picked = ref(false)

watch(() => props.bot?.id, () => {
  syncFromBot()
})

watch(open, (isOpen) => {
  if (isOpen) {
    syncFromBot()
    playHeroGreet()
    return
  }
  appearanceOpen.value = false
  clearTimeout(heroTimer)
  heroGreet.value = false
  void persistFields()
})

watch(appearanceOpen, (isOpen) => {
  if (!isOpen) {
    clearTimeout(greetTimer)
    picked.value = false
    appearanceError.value = ''
  }
})

function syncFromBot() {
  if (!props.bot) {
    return
  }
  name.value = props.bot.name
  label.value = props.bot.manifest.label
  description.value = props.bot.manifest.description
  error.value = ''
}

function shapeLabel(value: BotAvatarShape): string {
  return BOT_AVATAR_SHAPE_LABELS[value]
}

const heroState = computed<BotAvatarState>(() => (heroGreet.value ? 'greet' : 'idle'))

/** The chosen bird greets when you pick it; the rest hold still. */
function markState(value: BotAvatarShape): BotAvatarState {
  if (draftShape.value !== value) {
    return 'none'
  }
  return picked.value ? 'greet' : 'idle'
}

let greetTimer: ReturnType<typeof setTimeout>
let heroTimer: ReturnType<typeof setTimeout>

function playHeroGreet() {
  heroGreet.value = false
  clearTimeout(heroTimer)
  void nextTick(() => {
    heroGreet.value = true
    heroTimer = setTimeout(() => {
      heroGreet.value = false
    }, 1200)
  })
}

function playGreet() {
  picked.value = false
  clearTimeout(greetTimer)
  void nextTick(() => {
    picked.value = true
    greetTimer = setTimeout(() => {
      picked.value = false
    }, 1200)
  })
}

function openAppearance() {
  if (!isOwner.value || !props.bot) {
    return
  }
  draftShape.value = props.bot.manifest.avatarShape
  draftColor.value = props.bot.manifest.avatarColor
  appearanceError.value = ''
  appearanceOpen.value = true
  playGreet()
}

function pickShape(value: BotAvatarShape) {
  draftShape.value = value
  playGreet()
}

function pickColor(value: BotAccentHex) {
  draftColor.value = value
}

function resetAppearance() {
  draftShape.value = DEFAULT_AVATAR_SHAPE
  draftColor.value = DEFAULT_AVATAR_COLOR
  playGreet()
}

async function persistFields() {
  if (!props.bot || !isOwner.value || saving.value) {
    return
  }
  let nextName = name.value.trim()
  const nextLabel = label.value.trim()
  const nextDescription = description.value.trim()
  if (!nextName) {
    if (open.value) {
      error.value = 'Напишите имя'
      return
    }
    nextName = props.bot.name
    name.value = nextName
  }
  if (
    nextName === props.bot.name
    && nextLabel === props.bot.manifest.label
    && nextDescription === props.bot.manifest.description
  ) {
    error.value = ''
    return
  }
  saving.value = true
  error.value = ''
  try {
    await $fetch(`/api/bots/${props.bot.id}`, {
      method: 'PATCH',
      body: {
        name: nextName,
        label: nextLabel,
        description: nextDescription,
      },
    })
    emit('saved')
  } catch {
    error.value = 'Не получилось сохранить'
  } finally {
    saving.value = false
  }
}

async function saveAppearance() {
  if (!props.bot || !isOwner.value || appearanceSaving.value) {
    return
  }
  if (
    draftShape.value === props.bot.manifest.avatarShape
    && draftColor.value === props.bot.manifest.avatarColor
  ) {
    appearanceOpen.value = false
    return
  }
  appearanceSaving.value = true
  appearanceError.value = ''
  try {
    await $fetch(`/api/bots/${props.bot.id}`, {
      method: 'PATCH',
      body: {
        avatarShape: draftShape.value,
        avatarColor: draftColor.value,
      },
    })
    emit('saved')
    appearanceOpen.value = false
  } catch {
    appearanceError.value = 'Не получилось сохранить аватар'
  } finally {
    appearanceSaving.value = false
  }
}

onUnmounted(() => {
  clearTimeout(greetTimer)
  clearTimeout(heroTimer)
})
</script>

<style scoped>
.mark {
  position: relative;
  display: flex;
  justify-content: center;
  margin: 0.15rem 0 1.35rem;
}

.mark :deep(.kit-bot-avatar--lg) {
  width: 7.25rem;
  height: 7.25rem;
}

.pencil {
  position: absolute;
  top: 50%;
  left: calc(50% + 4.05rem);
  transform: translateY(-50%);
  appearance: none;
  width: 2.15rem;
  height: 2.15rem;
  display: grid;
  place-items: center;
  border-radius: 0.7rem;
  border: 1px solid color-mix(in srgb, var(--text) 28%, transparent);
  background: color-mix(in srgb, var(--text) 7%, transparent);
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
}

.pencil svg {
  width: 1.05rem;
  height: 1.05rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.pencil:hover {
  color: var(--text);
  border-color: color-mix(in srgb, var(--text) 48%, transparent);
  background: color-mix(in srgb, var(--text) 12%, transparent);
}

.pencil:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.form {
  margin: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 0.95rem;
  font-size: 0.92rem;
  color: var(--text-muted);
}

input,
textarea {
  appearance: none;
  width: 100%;
  border: 1px solid var(--line);
  background: var(--bg-chat);
  color: var(--text);
  border-radius: 0.9rem;
  padding: 0.8rem 0.9rem;
  font: inherit;
  font-size: 1.02rem;
  font-weight: 700;
}

textarea {
  min-height: 8.5rem;
  resize: vertical;
  line-height: 1.45;
  font-weight: 600;
}

input::placeholder,
textarea::placeholder {
  color: color-mix(in srgb, var(--text-muted) 88%, transparent);
  font-weight: 600;
}

input:focus,
textarea:focus {
  outline: 1px solid var(--accent);
}

input:disabled,
textarea:disabled {
  opacity: 1;
  cursor: default;
}

.error {
  margin: 0 0 0.75rem;
  color: var(--accent);
  font-size: 0.88rem;
}

.editor {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.shapes {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem 0.45rem;
  margin-bottom: 0.85rem;
}

.shape {
  appearance: none;
  box-sizing: border-box;
  width: 4.35rem;
  height: 4.35rem;
  aspect-ratio: 1;
  border: 0;
  background: transparent;
  padding: 0.3rem;
  border-radius: 0.7rem;
  cursor: pointer;
  display: grid;
  place-items: center;
}

.shape:hover:not(:disabled) {
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

.shape.selected {
  background: color-mix(in srgb, var(--text) 9%, transparent);
  box-shadow: inset 0 0 0 2px var(--accent);
}

.shape:disabled {
  cursor: default;
}

.shape:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.swatches {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.7rem 0.55rem;
  width: 100%;
  padding: 0.15rem 0.25rem 0.55rem;
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
    0 0 0 2px var(--sheet),
    0 0 0 3.5px #3a3a3a;
}

.swatch:disabled {
  cursor: default;
}

.swatch:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.35rem;
}

.reset {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  padding: 0.45rem 0.2rem;
}

.reset:hover:not(:disabled) {
  color: var(--text);
}

.reset:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reset:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius);
}
</style>
