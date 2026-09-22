<template>
  <div class="page">
    <header class="top">
      <HostMenuButton />
      <div class="lead">
        <h1>{{ bot?.name ?? 'Bot' }}</h1>
        <p class="sub">
          Chat
        </p>
      </div>
      <div class="header-actions">
        <template v-if="isOwner && confirmDelete">
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
            class="danger"
            :disabled="!bot || deleting"
            @click="remove"
          >
            {{ deleting ? 'Deleting…' : 'Confirm delete' }}
          </button>
        </template>
        <button
          v-else-if="isOwner"
          type="button"
          class="ghost"
          :disabled="!bot || deleting"
          @click="confirmDelete = true"
        >
          Delete
        </button>
      </div>
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
        <p
          v-if="labelFor(message)"
          class="who"
        >
          {{ labelFor(message) }}
        </p>
        <p class="text">
          {{ message.content }}
        </p>
      </li>
      <li
        v-if="botPending"
        class="bubble assistant pending"
        aria-live="polite"
      >
        <p class="who">
          {{ bot?.name ?? 'Bot' }}
        </p>
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
        <label class="sr">
          Message
          <textarea
            v-model="draft"
            rows="2"
            maxlength="16000"
            placeholder="Tell this Bot what it is for…"
            :disabled="!bot"
            @keydown.enter.exact.prevent="send"
          />
        </label>
        <button
          type="submit"
          class="solid"
          :disabled="sending || !draft.trim() || !bot"
        >
          Send
        </button>
      </div>
    </form>
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
const deleting = ref(false)
const confirmDelete = ref(false)
const botPending = ref(false)
const sendError = ref('')
const optimistic = ref<TimelineLine | null>(null)
const threadEl = ref<HTMLOListElement | null>(null)

const timeline = computed(() => withOptimisticUser<TimelineLine>(messages.value, optimistic.value))

watch(botId, () => {
  optimistic.value = null
  botPending.value = false
  sending.value = false
  sendError.value = ''
  draft.value = ''
  confirmDelete.value = false
})

watch([timeline, botPending], () => {
  nextTick(() => {
    threadEl.value?.scrollTo({ top: threadEl.value.scrollHeight })
  })
}, { immediate: true })

function labelFor(message: TimelineLine): string {
  if (message.role === 'user') {
    return message.authorName ?? ''
  }
  if (message.role === 'system') {
    return 'System'
  }
  return bot.value?.name ?? 'Bot'
}

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
    await Promise.all([refresh(), refreshBot()])
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

async function remove() {
  if (!bot.value || deleting.value) {
    return
  }
  deleting.value = true
  try {
    await $fetch(`/api/bots/${bot.value.id}`, { method: 'DELETE' })
    await refreshBots()
    await navigateTo('/')
  } finally {
    deleting.value = false
    confirmDelete.value = false
  }
}
</script>

<style scoped>
.page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.top {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1.15rem;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}

.lead {
  min-width: 0;
  flex: 1;
}

h1 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub {
  margin: 0.1rem 0 0;
  color: var(--text-muted);
  font-size: 0.8rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.ghost,
.solid,
.danger,
.retry {
  appearance: none;
  border-radius: 999px;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
}

.ghost,
.retry {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text-muted);
}

.solid {
  border: 0;
  background: var(--accent);
  color: var(--accent-ink);
}

.danger {
  border: 1px solid var(--accent-dim);
  background: transparent;
  color: var(--accent);
}

.solid:disabled,
.ghost:disabled,
.danger:disabled,
.retry:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  background: var(--surface);
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
  padding: 1.35rem 1.4rem 1.6rem;
  overflow: auto;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.bubble {
  max-width: min(36rem, 100%);
  padding: 0.85rem 1rem;
  border-radius: var(--radius);
  border: 1px solid var(--line);
  background: var(--surface);
}

.bubble.user {
  align-self: flex-start;
}

.bubble.user.mine {
  align-self: flex-end;
  border-color: transparent;
  background: color-mix(in srgb, var(--accent) 18%, var(--surface));
}

.bubble.failed {
  border-color: var(--accent-dim);
}

.who {
  margin: 0 0 0.3rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-muted);
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
  gap: 0.55rem;
  padding: 0.85rem 1.15rem calc(1rem + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--line);
  background: var(--surface);
}

.composer-row {
  display: flex;
  gap: 0.7rem;
  align-items: flex-end;
}

.send-error {
  margin: 0;
  color: var(--accent);
  font-size: 0.88rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.sr {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

textarea {
  width: 100%;
  resize: none;
  appearance: none;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: 0.7rem 0.85rem;
  min-height: 3.1rem;
}

textarea:focus {
  outline: 1px solid var(--accent-dim);
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
