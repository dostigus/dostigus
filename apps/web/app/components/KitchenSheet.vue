<template>
  <div class="kitchen">
    <p
      v-if="loadError"
      class="error"
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

      <section
        class="group"
        :aria-label="$t('sheet.kitchen.pantry')"
      >
        <h2>{{ $t('sheet.kitchen.pantry') }}</h2>
        <p
          v-if="kitchen.pantry.length === 0"
          class="muted"
        >
          {{ $t('sheet.kitchen.emptyPantry') }}
        </p>
        <ul
          v-else
          class="rows"
        >
          <KitListRow
            v-for="item in kitchen.pantry"
            :key="item.id"
            as="li"
            :title="item.name"
          >
            <template
              v-if="item.qty"
              #trailing
            >
              {{ item.qty }}
            </template>
          </KitListRow>
        </ul>
        <form
          class="form"
          @submit.prevent="addPantry"
        >
          <div class="pair">
            <KitField
              :label="$t('sheet.kitchen.name')"
              :error="errors.pantry"
              required
            >
              <KitInput
                v-model="pantryName"
                :maxlength="KITCHEN_NAME_MAX"
                autocomplete="off"
                :disabled="busy"
              />
            </KitField>
            <KitField :label="$t('sheet.kitchen.qty')">
              <KitInput
                v-model="pantryQty"
                :maxlength="KITCHEN_QTY_MAX"
                autocomplete="off"
                :disabled="busy"
              />
            </KitField>
          </div>
          <div class="actions">
            <KitButton
              type="submit"
              :disabled="busy || !pantryName.trim()"
            >
              {{ $t('sheet.kitchen.add') }}
            </KitButton>
          </div>
        </form>
      </section>

      <section
        class="group"
        :aria-label="$t('sheet.kitchen.cooked')"
      >
        <h2>{{ $t('sheet.kitchen.cooked') }}</h2>
        <p
          v-if="kitchen.cooked.length === 0"
          class="muted"
        >
          {{ $t('sheet.kitchen.emptyCooked') }}
        </p>
        <ul
          v-else
          class="rows"
        >
          <KitListRow
            v-for="entry in kitchen.cooked"
            :key="entry.id"
            as="li"
            :title="entry.label"
          >
            <template #trailing>
              {{ entry.xp }} XP
            </template>
          </KitListRow>
        </ul>
        <div class="actions">
          <KitButton
            :disabled="busy"
            @click="markCooked"
          >
            {{ $t('sheet.kitchen.markCooked') }}
          </KitButton>
        </div>
        <p
          v-if="errors.cooked"
          class="error"
          role="alert"
        >
          {{ errors.cooked }}
        </p>
      </section>

      <section
        class="group"
        :aria-label="$t('sheet.kitchen.recipe')"
      >
        <h2>{{ $t('sheet.kitchen.recipe') }}</h2>
        <div class="form">
          <KitField
            :label="$t('sheet.kitchen.name')"
            :error="errors.recipe"
          >
            <KitInput
              v-model="recipeName"
              :maxlength="KITCHEN_NAME_MAX"
              autocomplete="off"
              :disabled="busy"
            />
          </KitField>
          <KitField :label="$t('sheet.kitchen.ingredients')">
            <KitTextarea
              v-model="ingredients"
              :rows="4"
              :maxlength="KITCHEN_INGREDIENTS_MAX"
              :disabled="busy"
            />
          </KitField>
          <div class="actions">
            <KitButton
              :disabled="busy || !recipeName.trim()"
              @click="saveRecipe"
            >
              {{ $t('sheet.kitchen.saveRecipe') }}
            </KitButton>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { KitchenSnapshot } from '@dostigus/shared'
import { KITCHEN_INGREDIENTS_MAX, KITCHEN_NAME_MAX, KITCHEN_QTY_MAX } from '@dostigus/shared'
import { KitButton, KitField, KitInput, KitListRow, KitTextarea } from '@dostigus/ui-kit'

type KitchenBody = { kitchen: KitchenSnapshot }
type KitchenErrorField = 'pantry' | 'cooked' | 'recipe'

const { t } = useI18n()
const kitchen = ref<KitchenSnapshot | null>(null)
const loadError = ref('')
const errors = ref<Partial<Record<KitchenErrorField, string>>>({})
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
  errors.value = {}
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
    errors.value = { pantry: messageOf(error) }
  } finally {
    busy.value = false
  }
}

async function markCooked() {
  if (busy.value) {
    return
  }
  busy.value = true
  errors.value = {}
  const label = recipeName.value.trim() || kitchen.value?.recipe?.name || undefined
  try {
    const body = await $fetch<KitchenBody>('/api/kitchen/cooked', {
      method: 'POST',
      body: label ? { label } : {},
    })
    apply(body.kitchen, false)
  } catch (error) {
    errors.value = { cooked: messageOf(error) }
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
  errors.value = {}
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
    errors.value = { recipe: messageOf(error) }
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
.kitchen,
.group,
.form {
  display: flex;
  flex-direction: column;
}

.kitchen {
  gap: 0.9rem;
}

.group {
  gap: 0.55rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--line);
}

.form {
  gap: 0.9rem;
  margin: 0;
}

.xp {
  margin: 0;
  font-weight: 700;
}

.group h2 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text-muted);
}

.rows {
  list-style: none;
  margin: 0 -0.7rem;
  padding: 0;
}

.rows > li + li {
  border-top: 1px solid var(--line);
}

.pair {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 0.6rem;
}

.actions {
  display: flex;
}

.error,
.muted {
  margin: 0;
}

.error {
  color: var(--accent);
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.45;
}

.muted {
  color: var(--text-muted);
}
</style>
