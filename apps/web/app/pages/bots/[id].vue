<template>
  <div class="shell">
    <header class="top">
      <div class="lead">
        <NuxtLink
          to="/"
          class="back"
        >
          Bots
        </NuxtLink>
        <div>
          <h1>{{ bot?.name ?? 'Bot' }}</h1>
          <p class="sub">
            Chat
          </p>
        </div>
      </div>
      <div class="header-actions">
        <NuxtLink
          to="/settings"
          class="settings"
        >
          Settings
        </NuxtLink>
        <HostLogoutButton />
        <template v-if="confirmDelete">
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
          v-else
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
      Replies stay quiet until you add an OpenRouter key.
      <NuxtLink to="/settings">
        Settings
      </NuxtLink>
    </p>

    <ol
      ref="threadEl"
      class="thread"
      aria-label="Chat"
    >
      <li
        v-for="message in messages"
        :key="message.id"
        class="bubble"
        :class="message.role"
      >
        <p class="who">
          {{ labelFor(message.role) }}
        </p>
        <p class="text">
          {{ message.content }}
        </p>
      </li>
      <li
        v-if="messages.length === 0 && !loadError"
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
      <label class="sr">
        Message
        <textarea
          v-model="draft"
          rows="2"
          maxlength="16000"
          placeholder="Tell this Bot what it is for…"
          :disabled="sending || !bot"
          @keydown.enter.exact.prevent="send"
        />
      </label>
      <button
        type="submit"
        class="solid"
        :disabled="sending || !draft.trim() || !bot"
      >
        {{ sending ? 'Sending…' : 'Send' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { Bot, LlmGatewayPublic, Message, MessageRole } from '@dostigus/shared'

const route = useRoute()
const botId = computed(() => String(route.params.id ?? ''))

const { data: botData, error: botError, refresh: refreshBot } = await useFetch<{ bot: Bot }>(
  () => `/api/bots/${botId.value}`,
)
const { data: messageData, error: messageError, refresh } = await useFetch<{ messages: Message[] }>(
  () => `/api/bots/${botId.value}/messages`,
)
const { data: gatewayData } = await useFetch<{ llmGateway: LlmGatewayPublic }>(
  '/api/settings/llm-gateway',
)

const bot = computed(() => botData.value?.bot)
const messages = computed(() => messageData.value?.messages ?? [])
const loadError = computed(() => Boolean(botError.value || messageError.value))
const gatewayUnset = computed(() => gatewayData.value?.llmGateway.configured === false)

useHead({
  title: computed(() => bot.value ? `Dostigus · ${bot.value.name}` : 'Dostigus · Chat'),
})

const draft = ref('')
const sending = ref(false)
const deleting = ref(false)
const confirmDelete = ref(false)
const threadEl = ref<HTMLOListElement | null>(null)

watch(messages, () => {
  nextTick(() => {
    threadEl.value?.scrollTo({ top: threadEl.value.scrollHeight })
  })
}, { immediate: true })

function labelFor(role: MessageRole): string {
  if (role === 'user') {
    return 'You'
  }
  if (role === 'system') {
    return 'System'
  }
  return bot.value?.name ?? 'Bot'
}

async function send() {
  const content = draft.value.trim()
  if (!content || sending.value || !bot.value) {
    return
  }
  sending.value = true
  try {
    await $fetch(`/api/bots/${bot.value.id}/messages`, {
      method: 'POST',
      body: { content },
    })
    draft.value = ''
    await Promise.all([refresh(), refreshBot()])
  } finally {
    sending.value = false
  }
}

async function remove() {
  if (!bot.value || deleting.value) {
    return
  }
  deleting.value = true
  try {
    await $fetch(`/api/bots/${bot.value.id}`, { method: 'DELETE' })
    await navigateTo('/')
  } finally {
    deleting.value = false
    confirmDelete.value = false
  }
}
</script>

<style scoped>
.shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.4rem;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}

.lead {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  min-width: 0;
}

.back {
  color: var(--accent);
  text-decoration: none;
  font-size: 0.9rem;
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
  margin: 0.15rem 0 0;
  color: var(--text-muted);
  font-size: 0.8rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.settings {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.9rem;
  padding: 0.4rem 0.2rem;
}

.ghost,
.solid,
.danger {
  appearance: none;
  border-radius: 999px;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
}

.ghost {
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
.danger:disabled {
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
  align-self: flex-end;
  border-color: transparent;
  background: color-mix(in srgb, var(--accent) 18%, var(--surface));
}

.who {
  margin: 0 0 0.3rem;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.text {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.45;
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
  gap: 0.7rem;
  align-items: flex-end;
  padding: 0.95rem 1.4rem 1.15rem;
  border-top: 1px solid var(--line);
  background: var(--surface);
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
</style>
