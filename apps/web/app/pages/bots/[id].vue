<template>
  <div class="page">
    <header class="top">
      <HostMenuButton />
      <button
        type="button"
        class="identity"
        :disabled="!bot"
        :aria-label="identityLabel"
        @click="settingsOpen = true"
      >
        <HostBotAvatar
          :name="bot?.name ?? 'Bot'"
          :seed="bot?.id ?? ''"
          :shape="bot?.manifest.avatarShape"
          :avatar-color="bot?.manifest.avatarColor"
          :state="markState"
          :live="botLive"
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
        v-if="showPurpose"
        class="purpose"
      >
        <BotPurposeCard
          :busy="sending"
          @answer="onPurpose"
        />
      </li>
      <li
        v-if="botPending"
        class="pending-mark"
        aria-live="polite"
        aria-label="Replying"
      >
        <HostBotAvatar
          :name="bot?.name ?? 'Bot'"
          :seed="bot?.id ?? ''"
          :shape="bot?.manifest.avatarShape"
          :avatar-color="bot?.manifest.avatarColor"
          state="think"
          size="lg"
        />
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
      <div
        class="composer-row"
        :class="{ multiline: composerMultiline }"
      >
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
            ref="draftEl"
            v-model="draft"
            rows="1"
            maxlength="16000"
            placeholder="Tell this Bot what it is for…"
            :disabled="!bot"
            @keydown.enter.exact.prevent="send"
            @focus="listening = true"
            @blur="listening = false"
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
import type { Bot, BotAvatarState, Message } from '@dostigus/shared'

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
const draftEl = ref<HTMLTextAreaElement | null>(null)
const composerMultiline = ref(false)
const sending = ref(false)
const botPending = ref(false)
const sendError = ref('')
const optimistic = ref<TimelineLine | null>(null)
const replying = ref(false)
const cheering = ref(false)
const greeting = ref(false)
const listening = ref(false)
const markFailed = ref(false)
const settingsOpen = ref(false)
const threadEl = ref<HTMLOListElement | null>(null)

const timeline = computed(() => withOptimisticUser<TimelineLine>(messages.value, optimistic.value))
const showPurpose = computed(() => showsBotPurposeCard(timeline.value))
const { setLive } = useHostBotActivity()
const botLive = computed(() => botIsLive({
  pending: botPending.value,
  replying: replying.value,
  cheering: cheering.value,
  failed: markFailed.value,
}))
const identityLabel = computed(() => {
  if (!bot.value) {
    return 'Bot settings'
  }
  return botLive.value
    ? `${bot.value.name}, online, Bot settings`
    : `${bot.value.name}, Bot settings`
})
/**
 * Header mark states, strongest first: a failed send beats a reply in
 * flight, which beats the reply landing, its cheer, the opening greet and
 * the composer lean. With no key the Bot cannot answer, so it sleeps.
 */
const markState = computed<BotAvatarState>(() => {
  if (markFailed.value) {
    return 'error'
  }
  if (botPending.value) {
    return 'think'
  }
  if (replying.value) {
    return 'reply'
  }
  if (cheering.value) {
    return 'celebrate'
  }
  if (greeting.value) {
    return 'greet'
  }
  if (listening.value) {
    return 'listen'
  }
  return gatewayUnset.value ? 'sleep' : 'idle'
})

let markTimers: ReturnType<typeof setTimeout>[] = []

function clearMarkTimers() {
  for (const timer of markTimers) {
    clearTimeout(timer)
  }
  markTimers = []
}

function resetMark() {
  clearMarkTimers()
  replying.value = false
  cheering.value = false
  greeting.value = false
  markFailed.value = false
}

/** A nod and a wave when the Chat opens. */
function greetOnOpen() {
  resetMark()
  greeting.value = true
  markTimers.push(setTimeout(() => {
    greeting.value = false
  }, 1200))
}

/** Talk the reply out, then one hop of a cheer. */
function speakReply() {
  resetMark()
  replying.value = true
  markTimers.push(setTimeout(() => {
    replying.value = false
    cheering.value = true
    markTimers.push(setTimeout(() => {
      cheering.value = false
    }, 1100))
  }, 1800))
}

function showMarkError() {
  resetMark()
  markFailed.value = true
  markTimers.push(setTimeout(() => {
    markFailed.value = false
  }, 4000))
}

/** Pill on one line; `--radius-card` once the field is taller than that. */
function measureComposer() {
  const el = draftEl.value
  if (!el) {
    composerMultiline.value = false
    return
  }
  const style = getComputedStyle(el)
  const line = Number.parseFloat(style.lineHeight)
  const pad = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)
  if (!Number.isFinite(line) || line <= 0) {
    composerMultiline.value = el.value.includes('\n')
    return
  }
  const oneLine = line + (Number.isFinite(pad) ? pad : 0)
  composerMultiline.value = el.scrollHeight > oneLine + line * 0.5
}

let composerObserver: ResizeObserver | null = null

onMounted(() => {
  greetOnOpen()
  measureComposer()
  const el = draftEl.value
  if (el && typeof ResizeObserver !== 'undefined') {
    composerObserver = new ResizeObserver(() => {
      measureComposer()
    })
    composerObserver.observe(el)
  }
})

onUnmounted(() => {
  clearMarkTimers()
  composerObserver?.disconnect()
  if (botId.value) {
    setLive(botId.value, false)
  }
})

watch(draft, () => {
  nextTick(measureComposer)
})

watch(botId, () => {
  optimistic.value = null
  listening.value = false
  greetOnOpen()
  botPending.value = false
  sending.value = false
  sendError.value = ''
  draft.value = ''
  settingsOpen.value = false
})

watch([botId, botLive], ([id, live], previous) => {
  const previousId = previous?.[0]
  if (previousId && previousId !== id) {
    setLive(previousId, false)
  }
  if (id) {
    setLive(id, live)
  }
}, { immediate: true })

watch([timeline, botPending, showPurpose], () => {
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

function onPurpose(content: string) {
  void deliver(content, null)
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
  resetMark()
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
    if (messages.value.length > before) {
      speakReply()
    }
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
    showMarkError()
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
  --avatar-ring: var(--bg-chat);
}

.top {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 3rem;
  padding: 0.35rem 0.75rem;
  border-bottom: 1px solid var(--line-soft);
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
  padding: 0.6rem 1.15rem 0;
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

.pending-mark {
  align-self: flex-start;
  display: flex;
  padding: 0.15rem 0.1rem 0.35rem;
}

.purpose {
  list-style: none;
  max-width: min(34rem, 100%);
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: transparent;
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
  padding: 0;
}

.composer-row {
  display: flex;
  gap: 0.25rem;
  align-items: flex-end;
  padding: 0.55rem 1.15rem calc(0.7rem + env(safe-area-inset-bottom, 0px));
  /* A step lighter than the fill so the rim still reads on Chat black. */
  border: 1px solid color-mix(in srgb, var(--text) 8%, var(--composer));
  border-radius: 9999px;
  background: var(--composer);
  transition: border-radius 160ms ease;
}

.composer-row.multiline {
  border-radius: var(--radius-card);
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

@media (prefers-reduced-motion: reduce) {
  .composer-row {
    transition: none;
  }
}
</style>
