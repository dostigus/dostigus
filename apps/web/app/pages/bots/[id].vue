<template>
  <div class="page">
    <header class="top">
      <HostMenuButton />
      <button
        type="button"
        class="identity"
        :disabled="!bot"
        :aria-label="bot ? `${bot.name}, Bot settings` : 'Bot settings'"
        @click="settingsOpen = true"
      >
        <HostBotAvatar
          :name="bot?.name ?? 'Bot'"
          :seed="bot?.id ?? ''"
          :shape="bot?.manifest.avatarShape"
          :avatar-color="bot?.manifest.avatarColor"
          size="sm"
        />
        <span class="name">{{ bot?.name ?? 'Bot' }}</span>
      </button>
    </header>

    <p
      v-if="loadError"
      class="banner"
    >
      Could not open this Chat.
    </p>
    <p
      v-else-if="gatewayUnset"
      class="quiet-banner"
    >
      <template v-if="isOwner">
        Replies stay quiet until you add an OpenRouter key.
        <NuxtLink to="/settings">
          Settings
        </NuxtLink>
      </template>
      <template v-else>
        Replies stay quiet until the Owner adds an OpenRouter key.
      </template>
    </p>

    <ol
      ref="threadEl"
      class="thread"
      aria-label="Chat"
    >
      <li
        v-for="message in timeline"
        :key="message.id"
        class="bubble"
        :class="[message.role, { mine: isMine(message), failed: message.failed }]"
      >
        <p class="text">
          {{ message.content }}
        </p>
      </li>
      <li
        v-if="botPending"
        class="bubble assistant pending"
        aria-live="polite"
      >
        <p class="text typing">
          <span
            class="dots"
            aria-hidden="true"
          >
            <span /><span /><span />
          </span>
          Replying…
        </p>
      </li>
      <li
        v-if="timeline.length === 0 && !botPending && !loadError"
        class="empty-chat"
      >
        <p class="empty-title">
          Start the Chat
        </p>
        <p class="empty-hint">
          Say what this Bot is for.
        </p>
      </li>
    </ol>

    <form
      class="composer"
      @submit.prevent="send"
    >
      <p
        v-if="sendError"
        class="send-error"
      >
        {{ sendError }}
        <button
          v-if="optimistic?.failed"
          type="button"
          class="retry"
          :disabled="sending"
          @click="retry"
        >
          Try again
        </button>
      </p>
      <div class="composer-row">
        <button
          type="button"
          class="attach"
          disabled
          aria-label="Attachments soon"
          title="Soon"
        >
          <span aria-hidden="true">+</span>
        </button>
        <label class="draft">
          <span class="sr-only">Message</span>
          <textarea
            v-model="draft"
            rows="1"
            maxlength="16000"
            placeholder="Tell this Bot what it is for…"
            :disabled="!bot"
            @keydown.enter.exact.prevent="send"
          />
        </label>
        <button
          v-if="draft.trim()"
          type="submit"
          class="send"
          :disabled="sending || !bot"
          aria-label="Send"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 19V6M7 11l5-5 5 5" />
          </svg>
        </button>
      </div>
    </form>

    <BotSettingsSheet
      v-model:open="settingsOpen"
      :bot="bot"
      @saved="onBotSaved"
      @deleted="onBotDeleted"
    />
  </div>
</template>

<script setup lang="ts">
import type { Bot, Message } from '@dostigus/shared'

definePageMeta({ layout: 'host' })

type ChatMessage = Message & { authorName: string | null }
type TimelineLine = ChatMessage & {
  pending?: boolean
  failed?: boolean
}

const route = useRoute()
const { user, isOwner } = useHostAccount()
const { refresh: refreshBots } = await useHostBots()
const botId = computed(() => String(route.params.id ?? ''))

const { data: botData, error: botError, refresh: refreshBot } = await useFetch<{ bot: Bot }>(
  () => `/api/bots/${botId.value}`,
)
const { data: messageData, error: messageError, refresh } = await useFetch<{ messages: ChatMessage[] }>(
  () => `/api/bots/${botId.value}/messages`,
)
const { data: readyData } = await useFetch<{ configured: boolean }>('/api/chat/ready')

const bot = computed(() => botData.value?.bot)
const messages = computed(() => messageData.value?.messages ?? [])
const loadError = computed(() => Boolean(botError.value || messageError.value))
const gatewayUnset = computed(() => readyData.value?.configured === false)

useHead({
  title: computed(() => bot.value ? `Dostigus · ${bot.value.name}` : 'Dostigus · Chat'),
})

const draft = ref('')
const sending = ref(false)
const botPending = ref(false)
const sendError = ref('')
const optimistic = ref<TimelineLine | null>(null)
const settingsOpen = ref(false)
const threadEl = ref<HTMLOListElement | null>(null)

const timeline = computed(() => withOptimisticUser<TimelineLine>(messages.value, optimistic.value))

watch(botId, () => {
  optimistic.value = null
  botPending.value = false
  sending.value = false
  sendError.value = ''
  draft.value = ''
  settingsOpen.value = false
})

watch([timeline, botPending], () => {
  nextTick(() => {
    threadEl.value?.scrollTo({ top: threadEl.value.scrollHeight })
  })
}, { immediate: true })

function isMine(message: TimelineLine): boolean {
  if (message.role !== 'user') {
    return false
  }
  if (message.personId) {
    return message.personId === user.value?.id
  }
  return isOwner.value
}

function send() {
  void deliver(draft.value, null)
}

function retry() {
  const failed = optimistic.value
  if (!failed?.failed || sending.value) {
    return
  }
  void deliver(failed.content, failed)
}

async function deliver(raw: string, existing: TimelineLine | null) {
  const content = raw.trim()
  if (!content || sending.value || !bot.value) {
    return
  }
  const targetId = bot.value.id
  const before = messages.value.length
  sending.value = true
  sendError.value = ''
  if (!existing) {
    draft.value = ''
  }
  optimistic.value = {
    id: existing?.id ?? `pending-${crypto.randomUUID()}`,
    botId: targetId,
    role: 'user',
    content,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    personId: user.value?.id ?? null,
    authorName: user.value?.displayName ?? null,
    pending: true,
    failed: false,
  }
  botPending.value = true
  try {
    await $fetch(`/api/bots/${targetId}/messages`, {
      method: 'POST',
      body: { content },
    })
    if (botId.value !== targetId) {
      return
    }
    await Promise.all([refresh(), refreshBot(), refreshBots()])
    optimistic.value = null
  } catch {
    if (botId.value !== targetId) {
      return
    }
    await refresh().catch(() => {})
    if (messages.value.length > before) {
      optimistic.value = null
    } else if (optimistic.value) {
      optimistic.value = { ...optimistic.value, pending: false, failed: true }
    }
    sendError.value = 'Could not send that message.'
  } finally {
    if (botId.value === targetId) {
      sending.value = false
      botPending.value = false
    }
  }
}

async function onBotSaved() {
  await Promise.all([refreshBot(), refreshBots()])
}

async function onBotDeleted() {
  settingsOpen.value = false
  await refreshBots()
  await navigateTo('/')
}
</script>

<style scoped>
.page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-chat);
}

.top {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 3rem;
  padding: 0.35rem 0.75rem;
}

.identity {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  max-width: 100%;
  appearance: none;
  border: 0;
  background: transparent;
  color: inherit;
  border-radius: 999px;
  padding: 0.25rem 0.75rem 0.25rem 0.25rem;
  cursor: pointer;
  font: inherit;
}

.identity:hover:not(:disabled) {
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

.identity:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.identity:disabled {
  cursor: default;
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.98rem;
  font-weight: 700;
}

.banner {
  margin: 0;
  padding: 0.7rem 1.25rem;
  color: var(--accent);
  border-bottom: 1px solid var(--line);
}

.quiet-banner {
  margin: 0;
  padding: 0.55rem 1.25rem;
  color: var(--text-muted);
  font-size: 0.88rem;
  border-bottom: 1px solid var(--line);
}

.quiet-banner a {
  color: var(--accent);
  text-decoration: none;
}

.thread {
  flex: 1;
  min-height: 0;
  list-style: none;
  margin: 0;
  padding: 0.6rem 1.15rem 1.1rem;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.bubble {
  max-width: min(34rem, 86%);
  padding: 0.7rem 0.95rem;
  border-radius: var(--radius-bubble);
  border: 0;
  background: var(--surface);
}

.bubble.user.mine {
  align-self: flex-end;
  background: color-mix(in srgb, var(--text) 8%, var(--surface));
}

.bubble.assistant,
.bubble.system,
.bubble.user:not(.mine) {
  align-self: flex-start;
}

.bubble.failed {
  box-shadow: inset 0 0 0 1px var(--accent-dim);
}

.text {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.45;
}

.typing {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--text-muted);
}

.dots {
  display: inline-flex;
  gap: 0.22rem;
}

.dots span {
  width: 0.38rem;
  height: 0.38rem;
  border-radius: 999px;
  background: var(--text-muted);
  animation: blink 1.2s infinite;
}

.dots span:nth-child(2) {
  animation-delay: 0.15s;
}

.dots span:nth-child(3) {
  animation-delay: 0.3s;
}

.empty-chat {
  margin: auto 0;
  padding: 1.5rem 0.5rem 2.5rem;
  text-align: center;
  border: 0;
  background: transparent;
  align-self: center;
  max-width: none;
}

.empty-title {
  margin: 0 0 0.4rem;
  font-size: 1.2rem;
  font-weight: 700;
}

.empty-hint {
  margin: 0;
  color: var(--text-muted);
}

.composer {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.35rem 1rem calc(0.85rem + env(safe-area-inset-bottom, 0px));
}

.composer-row {
  display: flex;
  gap: 0.25rem;
  align-items: flex-end;
  padding: 0.3rem 0.35rem 0.3rem 0.3rem;
  border: 1px solid var(--line);
  border-radius: 9999px;
  background: var(--surface);
}

.send-error {
  margin: 0;
  color: var(--accent);
  font-size: 0.88rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.retry {
  appearance: none;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius);
  padding: 0.35rem 0.8rem;
  cursor: pointer;
  font: inherit;
}

.retry:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.attach,
.send {
  appearance: none;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  border: 0;
  border-radius: 999px;
  padding: 0;
  cursor: pointer;
}

.attach {
  background: transparent;
  color: var(--text-muted);
  font-size: 1.45rem;
  line-height: 1;
  font-weight: 500;
}

.attach:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.send {
  background: var(--accent);
  color: var(--accent-ink);
}

.send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send svg {
  width: 1.15rem;
  height: 1.15rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.draft {
  flex: 1;
  min-width: 0;
  display: flex;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

textarea {
  width: 100%;
  resize: none;
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--text);
  padding: 0.4rem 0.25rem;
  min-height: 1.6rem;
  max-height: 8rem;
  field-sizing: content;
}

textarea:focus {
  outline: none;
}

@keyframes blink {
  0%,
  80%,
  100% {
    opacity: 0.3;
  }

  40% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dots span {
    animation: none;
    opacity: 0.8;
  }
}
</style>
