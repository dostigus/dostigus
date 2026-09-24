<template>
  <div class="page">
    <p
      v-if="loadError"
      class="banner"
    >
      Could not open this Chat.
    </p>
    <p
      v-else-if="thread?.kind === 'room' && gatewayUnset"
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

    <div class="stage">
      <div class="bots-toggle">
        <HostMenuButton />
      </div>
      <div
        class="identity"
        :aria-label="thread?.title ?? 'Thread'"
      >
        <span class="identity-copy">
          <HostBotAvatar
            :name="thread?.mark.name ?? 'Thread'"
            :seed="thread?.mark.seed ?? ''"
            :shape="thread?.mark.shape ?? ''"
            :avatar-color="thread?.mark.color"
            size="sm"
          />
          <span class="name">{{ thread?.title ?? 'Thread' }}</span>
        </span>
      </div>

      <ol
        ref="threadEl"
        class="thread"
        aria-label="Chat"
      >
        <li
          v-for="message in timeline"
          :key="message.id"
          class="bubble"
          :class="[message.role, { mine: isMine(message) }]"
        >
          <p
            v-if="speaker(message)"
            class="who"
          >
            {{ speaker(message) }}
          </p>
          <KitMarkdown
            v-if="assistantBubbleUsesMarkdown(message.role)"
            :source="message.content"
          />
          <p
            v-else
            class="text"
          >
            {{ message.content }}
          </p>
          <KitChatParts
            v-if="assistantBubbleUsesMarkdown(message.role) && hostChatParts(message.parts).length"
            :parts="hostChatParts(message.parts)"
            @open-sheet="onOpenSheet"
          />
          <ChatMessageArtifacts
            v-if="message.artifacts?.length"
            :artifacts="message.artifacts"
          />
        </li>
        <li
          v-if="threadActivity"
          class="activity"
          aria-live="polite"
        >
          <ChatActivityRow
            :kind="threadActivity.kind"
            :label="threadActivity.label"
            :name="activityBot?.name ?? 'Bot'"
            :seed="activityBot?.id ?? ''"
            :shape="activityBot?.avatarShape ?? ''"
            :avatar-color="activityBot?.avatarColor"
          />
        </li>
        <li
          v-else-if="replying"
          class="pending-mark"
          aria-live="polite"
          aria-label="Replying"
        >
          <HostBotAvatar
            :name="replyBot?.name ?? 'Bot'"
            :seed="replyBot?.id ?? ''"
            :shape="replyBot?.avatarShape ?? ''"
            :avatar-color="replyBot?.avatarColor"
            state="think"
            size="lg"
          />
        </li>
        <li
          v-if="timeline.length === 0 && !replying && !threadActivity && !loadError"
          class="empty-chat"
        >
          <p class="empty-title">
            Start the Chat
          </p>
          <p class="empty-hint">
            {{ thread?.kind === 'room' ? 'Mention a Bot with @Name so it replies.' : 'Say hello.' }}
          </p>
        </li>
      </ol>

      <form
        class="composer"
        @submit.prevent="send"
      >
        <p
          v-if="thread?.kind === 'room'"
          class="mention-hint"
        >
          Mention a Bot with @Name so it replies.
        </p>
        <p
          v-if="sendError"
          class="send-error"
        >
          {{ sendError }}
        </p>
        <div class="composer-foot">
          <div class="composer-row">
            <label class="draft">
              <span class="sr-only">Message</span>
              <textarea
                v-model="draft"
                rows="1"
                maxlength="16000"
                placeholder="Сообщение"
                :disabled="!thread || sending"
                @keydown.enter.exact.prevent="send"
              />
            </label>
            <button
              v-if="draft.trim()"
              type="submit"
              class="send"
              :disabled="sending || !thread"
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
        </div>
      </form>
    </div>
    <KitSheet
      v-model:open="sheetOpen"
      :title="openSheet?.title ?? 'Sheet'"
    >
      <KitchenSheet v-if="openSheet?.kind === 'kitchen'" />
      <ScheduleSheet
        v-else-if="openSheet?.kind === 'schedule'"
        :schedule-id="sheetTargetId"
      />
      <p
        v-else
        class="sheet-copy"
      >
        {{ openSheet?.body }}
      </p>
    </KitSheet>
  </div>
</template>

<script setup lang="ts">
import type { Message, ThreadListItem, ThreadParticipantView } from '@dostigus/shared'
import type { HostSheetEntry } from '../../utils/host-sheets'
import { mentionedRoomBot } from '@dostigus/shared'
import { assistantBubbleUsesMarkdown, KitChatParts, KitMarkdown, KitSheet } from '@dostigus/ui-kit'
import { hostChatParts, hostSheetById } from '../../utils/host-sheets'

definePageMeta({ layout: 'host' })

type ChatMessage = Message & { authorName: string | null }

type Payload = {
  thread: ThreadListItem
  messages: ChatMessage[]
}

const route = useRoute()
const { user, isOwner } = useHostAccount()
const { refresh: refreshThreads } = await useHostThreads()
const threadId = computed(() => String(route.params.id ?? ''))

const { data, error, refresh } = await useFetch<Payload>(
  () => `/api/threads/${threadId.value}`,
)
const { data: readyData } = await useFetch<{ configured: boolean }>('/api/chat/ready')

const draft = ref('')
const sending = ref(false)
const sendError = ref('')
const replying = ref(false)
const sheetOpen = ref(false)
const openSheet = ref<HostSheetEntry | null>(null)
const sheetTargetId = ref('')

function onOpenSheet(sheetId: string, targetId?: string) {
  const sheet = hostSheetById(sheetId)
  if (!sheet) {
    return
  }
  sheetTargetId.value = targetId ?? ''
  openSheet.value = sheet
  sheetOpen.value = true
}
const replyBot = ref<ThreadParticipantView | null>(null)
const threadEl = ref<HTMLElement | null>(null)

const thread = computed(() => data.value?.thread ?? null)
const timeline = computed(() => data.value?.messages ?? [])
const loadError = computed(() => Boolean(error.value))
const gatewayUnset = computed(() => readyData.value?.configured === false)
const forcedActivity = computed(() => (
  import.meta.dev ? parseChatActivityKind(route.query.activity) : null
))
const replyBotId = computed(() => replyBot.value?.id ?? null)
const activityLive = computed(() => (
  replying.value
  && readyData.value?.configured === true
  && thread.value?.kind === 'room'
  && !forcedActivity.value
))
const { phase: liveActivityPhase } = useChatActivityPhase({
  active: activityLive,
  threadId,
  botId: replyBotId,
})
const threadActivity = computed(() => chatActivityStatus({
  pending: replying.value && thread.value?.kind === 'room',
  gatewayConfigured: readyData.value?.configured === true,
  phase: liveActivityPhase.value,
  forced: forcedActivity.value,
  connectTarget: import.meta.dev && typeof route.query.target === 'string'
    ? route.query.target
    : null,
}))
const activityBot = computed(() => {
  if (replyBot.value) {
    return replyBot.value
  }
  return thread.value?.participants.find((person) => person.kind === 'bot') ?? null
})

useHead({
  title: computed(() => thread.value ? `Dostigus · ${thread.value.title}` : 'Dostigus'),
})

watch([timeline, threadActivity, replying], async () => {
  await nextTick()
  const el = threadEl.value
  if (el) {
    el.scrollTop = el.scrollHeight
  }
})

function isMine(message: ChatMessage) {
  return message.role === 'user' && message.personId === user.value?.id
}

function speaker(message: ChatMessage): string | null {
  if (isMine(message)) {
    return null
  }
  if (message.role === 'assistant') {
    const bot = thread.value?.participants.find((person) => person.kind === 'bot' && person.id === message.botId)
    return bot?.name ?? 'Bot'
  }
  return message.authorName || 'Someone'
}

async function send() {
  const content = draft.value.trim()
  const current = thread.value
  if (!content || sending.value || !current) {
    return
  }
  const bots = current.participants.filter((person) => person.kind === 'bot')
  const mentioned = current.kind === 'room' ? mentionedRoomBot(content, bots) : null
  sending.value = true
  sendError.value = ''
  draft.value = ''
  replying.value = Boolean(mentioned)
  replyBot.value = mentioned
  try {
    await $fetch(`/api/threads/${current.id}/messages`, {
      method: 'POST',
      body: { content },
    })
    await Promise.all([refresh(), refreshThreads()])
  } catch {
    draft.value = content
    sendError.value = 'Could not send that message.'
  } finally {
    sending.value = false
    replying.value = false
    replyBot.value = null
  }
}
</script>

<style scoped>
.page {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-chat);
  --thread-inset: 1.15rem;
  --composer-clearance: 4.5rem;
  --thread-end-gap: 5rem;
  --thread-top-gap: 3.5rem;
}

.stage {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.bots-toggle {
  position: absolute;
  z-index: 4;
  top: 0.55rem;
  left: 0.65rem;
}

.identity {
  position: absolute;
  z-index: 4;
  top: 0.55rem;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  max-width: min(18rem, calc(100% - 6.5rem));
  border: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
  background: color-mix(in srgb, var(--sheet) 62%, transparent);
  backdrop-filter: blur(14px);
  border-radius: 999px;
  padding: 0.18rem 0.7rem;
  box-shadow: 0 0.35rem 1.1rem rgb(0 0 0 / 28%);
}

.identity-copy {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.98rem;
  font-weight: 700;
}

.banner {
  position: relative;
  z-index: 3;
  margin: 0;
  padding: 0.7rem 1.25rem;
  color: var(--accent);
  background: var(--bg-chat);
}

.quiet-banner {
  position: relative;
  z-index: 3;
  margin: 0;
  padding: 0.55rem 1.25rem;
  color: var(--text-muted);
  font-size: 0.88rem;
  border-bottom: 1px solid var(--line);
  background: var(--bg-chat);
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
  padding: var(--thread-top-gap) var(--thread-inset) calc(var(--composer-clearance) + var(--thread-end-gap));
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.bubble {
  max-width: min(34rem, 86%);
  padding: 0.7rem 0.95rem;
  border-radius: var(--radius-bubble);
  background: var(--surface);
}

.bubble.user.mine {
  align-self: flex-end;
  background: color-mix(in srgb, var(--text) 8%, var(--surface));
}

.bubble.assistant,
.bubble.user:not(.mine) {
  align-self: flex-start;
}

.bubble.system {
  align-self: center;
  max-width: min(28rem, 92%);
  padding: 0.15rem 0.6rem;
  border-radius: 0;
  background: transparent;
  color: var(--text-muted);
  text-align: center;
  font-size: 0.82rem;
}

.who {
  margin: 0 0 0.25rem;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 700;
}

.text {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.45;
}

.pending-mark,
.activity,
.empty-chat {
  align-self: flex-start;
}

.pending-mark,
.activity {
  display: flex;
  padding: 0.15rem 0.1rem 0.35rem;
}

.empty-chat {
  margin: auto 0;
  align-self: center;
  text-align: center;
}

.empty-title {
  margin: 0 0 0.4rem;
  font-size: 1.2rem;
  font-weight: 700;
}

.empty-hint,
.mention-hint,
.send-error {
  margin: 0;
  color: var(--text-muted);
}

.send-error {
  color: var(--accent);
  pointer-events: auto;
}

.composer {
  position: absolute;
  z-index: 2;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.35rem var(--thread-inset) calc(0.85rem + env(safe-area-inset-bottom, 0px));
  pointer-events: none;
}

.mention-hint {
  pointer-events: none;
  font-size: 0.82rem;
}

.composer-foot {
  position: relative;
}

.composer-row,
.send-error {
  pointer-events: auto;
}

.composer-row {
  display: flex;
  gap: 0.25rem;
  align-items: flex-end;
  padding: 0.3rem 0.4rem;
  border: 1px solid color-mix(in srgb, var(--text) 8%, var(--composer));
  border-radius: 9999px;
  background: var(--composer);
}

.draft {
  flex: 1;
  min-width: 0;
  display: flex;
}

.draft textarea {
  width: 100%;
  resize: none;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: 1.4;
  padding: 0.45rem 0.35rem;
  max-height: 8rem;
}

.draft textarea:focus {
  outline: none;
}

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
  background: var(--accent);
  color: var(--accent-ink);
  cursor: pointer;
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
</style>
