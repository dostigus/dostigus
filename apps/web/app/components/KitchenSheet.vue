<template>
  <div class="kitchen">
    <p
      v-if="loadError"
      class="flash"
      role="alert"
    >
      {{ loadError }}
    </p>
    <p
      v-else-if="!kitchen"
      class="muted"
    >
      {{ $t('sheet.kitchen.loading') }}
    </p>
    <template v-else>
      <p class="xp">
        {{ kitchen.xp }} XP
      </p>

      <section :aria-label="$t('sheet.kitchen.pantry')">
        <h2>{{ $t('sheet.kitchen.pantry') }}</h2>
        <p
          v-if="kitchen.pantry.length === 0"
          class="muted"
        >
          {{ $t('sheet.kitchen.emptyPantry') }}
        </p>
        <ul
          v-else
          class="list"
        >
          <li
            v-for="item in kitchen.pantry"
            :key="item.id"
          >
            <span>{{ item.name }}</span>
            <span
              v-if="item.qty"
              class="qty"
            >{{ item.qty }}</span>
          </li>
        </ul>
        <form
          class="add"
          @submit.prevent="addPantry"
        >
          <label class="field">
            <span>{{ $t('sheet.kitchen.name') }}</span>
            <input
              v-model="pantryName"
              type="text"
              :maxlength="KITCHEN_NAME_MAX"
              autocomplete="off"
              required
              :disabled="busy"
            >
          </label>
          <label class="field">
            <span>{{ $t('sheet.kitchen.qty') }}</span>
            <input
              v-model="pantryQty"
              type="text"
              :maxlength="KITCHEN_QTY_MAX"
              autocomplete="off"
              :disabled="busy"
            >
          </label>
          <KitButton
            type="submit"
            :disabled="busy || !pantryName.trim()"
          >
            {{ $t('sheet.kitchen.add') }}
          </KitButton>
        </form>
      </section>

      <section :aria-label="$t('sheet.kitchen.cooked')">
        <h2>{{ $t('sheet.kitchen.cooked') }}</h2>
        <p
          v-if="kitchen.cooked.length === 0"
          class="muted"
        >
          {{ $t('sheet.kitchen.emptyCooked') }}
        </p>
        <ul
          v-else
          class="list"
        >
          <li
            v-for="entry in kitchen.cooked"
            :key="entry.id"
          >
            <span>{{ entry.label }}</span>
            <span class="qty">{{ entry.xp }} XP</span>
          </li>
        </ul>
        <KitButton
          type="button"
          :disabled="busy"
          @click="markCooked"
        >
          {{ $t('sheet.kitchen.markCooked') }}
        </KitButton>
      </section>

      <section :aria-label="$t('sheet.kitchen.recipe')">
        <h2>{{ $t('sheet.kitchen.recipe') }}</h2>
        <label class="field">
          <span>{{ $t('sheet.kitchen.name') }}</span>
          <input
            v-model="recipeName"
            type="text"
            :maxlength="KITCHEN_NAME_MAX"
            autocomplete="off"
            :disabled="busy"
          >
        </label>
        <label class="field">
          <span>{{ $t('sheet.kitchen.ingredients') }}</span>
          <textarea
            v-model="ingredients"
            rows="4"
            :maxlength="KITCHEN_INGREDIENTS_MAX"
            :disabled="busy"
          />
        </label>
        <KitButton
          type="button"
          :disabled="busy || !recipeName.trim()"
          @click="saveRecipe"
        >
          {{ $t('sheet.kitchen.saveRecipe') }}
        </KitButton>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { KitchenSnapshot } from '@dostigus/shared'
import { KITCHEN_INGREDIENTS_MAX, KITCHEN_NAME_MAX, KITCHEN_QTY_MAX } from '@dostigus/shared'
import { KitButton } from '@dostigus/ui-kit'

type KitchenBody = { kitchen: KitchenSnapshot }

const { t } = useI18n()
const kitchen = ref<KitchenSnapshot | null>(null)
const loadError = ref('')
const busy = ref(false)
const pantryName = ref('')
const pantryQty = ref('')
const recipeName = ref('')
const ingredients = ref('')

onMounted(() => {
  void load()
})

async function load() {
  loadError.value = ''
  try {
    const body = await $fetch<KitchenBody>('/api/kitchen')
    apply(body.kitchen, true)
  } catch (error) {
    loadError.value = messageOf(error)
  }
}

function apply(snapshot: KitchenSnapshot, fillRecipe: boolean) {
  kitchen.value = snapshot
  if (fillRecipe) {
    recipeName.value = snapshot.recipe?.name ?? ''
    ingredients.value = snapshot.recipe?.ingredients ?? ''
  }
}

async function addPantry() {
  const name = pantryName.value.trim()
  if (!name || busy.value) {
    return
  }
  busy.value = true
  loadError.value = ''
  try {
    const body = await $fetch<KitchenBody>('/api/kitchen/pantry', {
      method: 'POST',
      body: {
        name,
        qty: pantryQty.value.trim() || undefined,
      },
    })
    pantryName.value = ''
    pantryQty.value = ''
    apply(body.kitchen, false)
  } catch (error) {
    loadError.value = messageOf(error)
  } finally {
    busy.value = false
  }
}

async function markCooked() {
  if (busy.value) {
    return
  }
  busy.value = true
  loadError.value = ''
  const label = recipeName.value.trim() || kitchen.value?.recipe?.name || undefined
  try {
    const body = await $fetch<KitchenBody>('/api/kitchen/cooked', {
      method: 'POST',
      body: label ? { label } : {},
    })
    apply(body.kitchen, false)
  } catch (error) {
    loadError.value = messageOf(error)
  } finally {
    busy.value = false
  }
}

async function saveRecipe() {
  const name = recipeName.value.trim()
  if (!name || busy.value) {
    return
  }
  busy.value = true
  loadError.value = ''
  try {
    const body = await $fetch<KitchenBody>('/api/kitchen/recipe', {
      method: 'PUT',
      body: {
        name,
        ingredients: ingredients.value,
      },
    })
    apply(body.kitchen, true)
  } catch (error) {
    loadError.value = messageOf(error)
  } finally {
    busy.value = false
  }
}

function messageOf(error: unknown): string {
  if (error && typeof error === 'object' && 'statusMessage' in error) {
    const status = (error as { statusMessage?: string }).statusMessage
    if (status?.trim()) {
      return status
    }
  }
  return t('sheet.kitchen.saveFailed')
}
</script>

<style scoped>
.kitchen {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.xp {
  margin: 0;
  font-weight: 700;
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
}

.list {
  list-style: none;
  margin: 0 0 0.75rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.list li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--bg);
}

.qty,
.muted {
  color: var(--text-muted);
}

.muted {
  margin: 0 0 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.7rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.add {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.5rem;
}

.add .field {
  flex: 1 1 8rem;
  margin-bottom: 0;
}

input,
textarea {
  appearance: none;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text);
  border-radius: var(--radius);
  padding: 0.7rem 0.85rem;
  font: inherit;
}

textarea {
  min-height: 4.5rem;
  resize: vertical;
}

input:focus,
textarea:focus {
  outline: 1px solid var(--accent-dim);
}

.flash {
  margin: 0;
  color: var(--accent);
}
</style>
