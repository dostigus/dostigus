<template>
  <section
    class="picker"
    aria-labelledby="bot-picker-title"
  >
    <header class="head">
      <HostMenuButton />
      <h2
        id="bot-picker-title"
        class="kit-sr-only"
      >
        {{ isOwner ? $t('host.botPicker.titleOwner') : $t('host.botPicker.titleMember') }}
      </h2>
      <label class="search">
        <span class="to">{{ $t('host.botPicker.to') }}</span>
        <KitInput
          ref="searchEl"
          v-model="query"
          type="search"
          :placeholder="isOwner ? $t('host.botPicker.titleOwner') : $t('host.botPicker.titleMember')"
          autocomplete="off"
          @keydown.enter.prevent
        />
      </label>
      <KitButton
        variant="close"
        :aria-label="$t('host.botPicker.back')"
        @click="dismiss"
      >
        ×
      </KitButton>
    </header>

    <div class="body">
      <p
        v-if="error"
        class="error"
      >
        {{ error }}
      </p>

      <ul
        class="rows"
        :aria-label="$t('host.botPicker.bots')"
      >
        <li v-if="isOwner">
          <KitListRow
            as="button"
            :title="busy ? $t('host.botPicker.createBusy') : $t('host.botPicker.create')"
            :disabled="busy"
            @click="createNew"
          >
            <template #leading>
              <span
                class="plus"
                aria-hidden="true"
              >+</span>
            </template>
          </KitListRow>
        </li>
        <li v-else>
          <KitListRow
            as="button"
            :title="busy ? $t('host.botPicker.createBusy') : $t('host.botPicker.create')"
            :disabled="busy"
            @click="createNew"
          >
            <template #leading>
              <span
                class="plus"
                aria-hidden="true"
              >+</span>
            </template>
          </KitListRow>
        </li>
        <li
          v-for="bot in visible"
          :key="bot.id"
        >
          <KitListRow
            as="button"
            :title="bot.name"
            :subtitle="bot.lastMessage?.content || undefined"
            :selected="isCurrent(bot.id)"
            :aria-current="isCurrent(bot.id) ? 'page' : undefined"
            @click="emit('openBot', bot.id)"
          >
            <template #leading>
              <HostBotAvatar
                :name="bot.name"
                :seed="bot.id"
                :shape="bot.manifest.avatarShape"
                :avatar-color="bot.manifest.avatarColor"
              />
            </template>
          </KitListRow>
        </li>
      </ul>

      <p
        v-if="visible.length === 0 && (query.trim() || !isOwner)"
        class="empty"
      >
        {{ query.trim() ? $t('host.botPicker.emptyQuery') : $t('host.botPicker.empty') }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Bot, BotListItem } from '@dostigus/shared'
import { DEFAULT_BOT_NAME, randomBotAppearance } from '@dostigus/shared'
import { KitButton, KitInput, KitListRow } from '@dostigus/ui-kit'

const props = defineProps<{
  bots: BotListItem[]
}>()

const emit = defineEmits<{
  close: []
  created: [bot: Bot]
  openBot: [id: string]
}>()

const route = useRoute()
const { isOwner } = useHostAccount()

const query = ref('')
const busy = ref(false)
const error = ref('')
const searchEl = ref<InstanceType<typeof KitInput> | null>(null)

const visible = computed(() => filterBotsByName(props.bots, query.value))

const { t } = useI18n()
useHead({
  title: computed(() => isOwner.value ? t('host.botPicker.titleDocOwner') : t('host.botPicker.titleDocMember')),
})

function isCurrent(id: string): boolean {
  return String(route.params.id ?? '') === id
}

function dismiss() {
  if (busy.value) {
    return
  }
  emit('close')
}

async function createNew() {
  if (busy.value) {
    return
  }
  busy.value = true
  error.value = ''
  const appearance = randomBotAppearance()
  try {
    const result = await $fetch<{ bot: Bot }>('/api/bots', {
      method: 'POST',
      body: {
        name: DEFAULT_BOT_NAME,
        avatarShape: appearance.avatarShape,
        avatarColor: appearance.avatarColor,
      },
    })
    emit('created', result.bot)
  } catch {
    error.value = t('host.botPicker.createFailed')
    busy.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') {
    return
  }
  dismiss()
}

onMounted(() => {
  searchEl.value?.focus()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.picker {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-chat);
  color: var(--text);
}

.head {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.85rem 1.15rem;
  border-bottom: 1px solid var(--line);
}

.search {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.to {
  flex: none;
  color: var(--text-muted);
  font-weight: 700;
  font-size: 1rem;
}

.body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.error,
.empty {
  margin: 0;
  padding: 0.85rem 1.25rem 0;
  color: var(--text-muted);
  font-size: 0.95rem;
}

.error {
  color: var(--accent);
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0.4rem 0.55rem 0.6rem;
}

.plus {
  width: 2.4rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1;
}
</style>
