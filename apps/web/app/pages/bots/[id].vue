<template>
  <div
    ref="pageEl"
    class="page"
  >
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

    <div
      ref="stageEl"
      class="stage"
    >
      <div class="bots-toggle">
        <HostMenuButton />
      </div>
      <button
        ref="pillEl"
        type="button"
        class="identity"
        :disabled="!bot"
        :aria-label="identityLabel"
        @click="settingsOpen = true"
      >
        <span class="identity-copy">
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
        </span>
        <span
          class="cue-slot"
          aria-hidden="true"
        >
          <svg
            class="cue"
            viewBox="0 0 24 24"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </button>

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
          v-if="showPurpose"
          class="purpose"
        >
          <BotPurposeCard
            :busy="sending"
            @answer="onPurpose"
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
            :name="bot?.name ?? 'Bot'"
            :seed="bot?.id ?? ''"
            :shape="bot?.manifest.avatarShape"
            :avatar-color="bot?.manifest.avatarColor"
          />
        </li>
        <li
          v-else-if="botPending"
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
          v-if="timeline.length === 0 && !botPending && !threadActivity && !loadError"
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

      <div
        v-if="dropActive"
        class="drop-mask"
        aria-hidden="true"
      >
        Drop files here
      </div>
      <form
        ref="composerEl"
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
        <div class="composer-foot">
          <div
            ref="composerRowEl"
            class="composer-row"
            :class="{ multiline: composerMultiline }"
          >
            <ul
              v-if="pendingAttachments.length"
              class="pending-chips"
              aria-label="Attachments"
            >
              <li
                v-for="item in pendingAttachments"
                :key="item.localId"
                class="pending-chip"
                :class="[item.status, { image: item.previewUrl }]"
                :title="item.error ?? item.filename"
              >
                <img
                  v-if="item.previewUrl"
                  :src="item.previewUrl"
                  :alt="item.filename"
                  class="pending-thumb"
                >
                <template v-else>
                  <span
                    class="pending-icon"
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                      <path d="M14 3v5h5" />
                    </svg>
                  </span>
                  <span class="pending-copy">
                    <span class="pending-name">{{ item.filename }}</span>
                    <span class="pending-meta">{{ pendingMeta(item) }}</span>
                  </span>
                </template>
                <span
                  v-if="item.previewUrl && item.status !== 'ready'"
                  class="pending-veil"
                >{{ item.status === 'uploading' ? 'Uploading…' : 'Failed' }}</span>
                <button
                  type="button"
                  class="pending-remove"
                  :aria-label="`Remove ${item.filename}`"
                  @click="removeAttachment(item.localId)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M7 7l10 10M17 7L7 17" />
                  </svg>
                </button>
              </li>
            </ul>
            <div class="composer-line">
              <input
                ref="fileInputEl"
                type="file"
                class="sr-only"
                multiple
                accept="image/*,application/pdf,text/plain,text/markdown,.md,.txt,.pdf"
                @change="onFileInput"
              >
              <button
                type="button"
                class="attach"
                :disabled="!bot"
                aria-label="Attach"
                title="Attach"
                @click="pickFiles()"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
              <label class="draft">
                <span class="sr-only">Message</span>
                <textarea
                  ref="draftEl"
                  v-model="draft"
                  rows="1"
                  maxlength="16000"
                  :placeholder="pendingAttachments.length > 0
                    ? 'Добавьте сообщение или просто отправьте'
                    : `Сообщение для ${bot?.name ?? 'Bot'}`"
                  :disabled="!bot"
                  @keydown.enter.exact.prevent="send"
                  @paste="onAttachPaste"
                  @focus="listening = true"
                  @blur="listening = false"
                />
              </label>
              <button
                v-if="draft.trim() || canSendAttachments"
                type="submit"
                class="send"
                :disabled="sending || !bot || attachmentsUploading"
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
        </div>
      </form>

      <button
        v-if="showLatestJump"
        type="button"
        class="to-latest"
        aria-label="Scroll to latest"
        @click="jumpToLatest"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M12 5v13M7 13l5 5 5-5" />
        </svg>
      </button>
    </div>

    <BotSettingsSheet
      v-model:open="settingsOpen"
      :bot="bot"
      @saved="onBotSaved"
    />
    <KitSheet
      v-model:open="sheetOpen"
      :title="openSheetTitle"
      :description="openSheet?.kind === 'kitchen' ? 'Pantry, one recipe, and a cooked log.' : undefined"
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
        {{ openSheetBody }}
      </p>
    </KitSheet>
  </div>
</template>

<script setup lang="ts">
import type { Bot, BotAvatarState, Message } from '@dostigus/shared'
import type { PendingAttachment } from '../../composables/useComposerAttachments'
import type { HostSheetEntry } from '../../utils/host-sheets'
import { assistantBubbleUsesMarkdown, KitChatParts, KitMarkdown, KitSheet } from '@dostigus/ui-kit'
import { hostChatParts, hostSheetById } from '../../utils/host-sheets'

definePageMeta({ layout: 'host' })

type ChatMessage = Message & { authorName: string | null }
type TimelineLine = ChatMessage & {
  pending?: boolean
  failed?: boolean
}

const route = useRoute()
const { user, isOwner } = useHostAccount()
const { refresh: refreshBots } = await useHostBots()
const { threads, refresh: refreshThreads } = await useHostThreads()
const botId = computed(() => String(route.params.id ?? ''))

const { data: botData, error: botError, refresh: refreshBot } = await useFetch<{ bot: Bot }>(
  () => `/api/bots/${botId.value}`,
  { key: computed(() => `bot-${botId.value}-${user.value?.id ?? 'anon'}`) },
)
const { data: messageData, error: messageError, refresh } = await useFetch<{ messages: ChatMessage[] }>(
  () => `/api/bots/${botId.value}/messages`,
  { key: computed(() => `bot-messages-${botId.value}-${user.value?.id ?? 'anon'}`) },
)
const { data: readyData } = await useFetch<{ configured: boolean }>('/api/chat/ready')

const bot = computed(() => botData.value?.bot)
const messages = computed(() => messageData.value?.messages ?? [])
const loadError = computed(() => Boolean(botError.value || messageError.value))
const gatewayUnset = computed(() => readyData.value?.configured === false)

useHead({
  title: computed(() => bot.value ? `Dostigus · ${bot.value.name}` : 'Dostigus · Chat'),
})

const {
  items: pendingAttachments,
  fileInput: fileInputEl,
  dropActive,
  readyIds: readyArtifactIds,
  uploading: attachmentsUploading,
  canSendAttachments,
  formatArtifactBytes: formatPendingBytes,
  pick: pickFiles,
  onFileInput,
  remove: removeAttachment,
  onPaste: onAttachPaste,
  clear: clearAttachments,
  bindWindow: bindAttachmentWindow,
  unbindWindow: unbindAttachmentWindow,
} = useComposerAttachments()

function pendingMeta(item: PendingAttachment) {
  if (item.status === 'uploading') {
    return 'Uploading…'
  }
  if (item.status === 'error') {
    return item.error ?? 'Failed'
  }
  return formatPendingBytes(item.byteSize)
}

const draft = ref('')
const draftEl = ref<HTMLTextAreaElement | null>(null)
const pageEl = ref<HTMLElement | null>(null)
const composerEl = ref<HTMLFormElement | null>(null)
const composerRowEl = ref<HTMLElement | null>(null)
const composerMultiline = ref(false)
/** Bumps when a newer corner ease should win over an in-flight one. */
let composerRadiusTicket = 0
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
const sheetOpen = ref(false)
const openSheet = ref<HostSheetEntry | null>(null)
const sheetTargetId = ref('')
const openSheetTitle = computed(() => openSheet.value?.title ?? 'Sheet')
const openSheetBody = computed(() => openSheet.value?.body ?? '')
const threadEl = ref<HTMLOListElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
const pillEl = ref<HTMLButtonElement | null>(null)
/** Shown while the thread is scrolled above the latest line. */
const showLatestJump = ref(false)
let threadScrollEl: HTMLElement | null = null
const { pendingId: pendingSheetId } = useHostBotSheet()

const timeline = computed(() => withOptimisticUser<TimelineLine>(messages.value, optimistic.value))
const showPurpose = computed(() => showsBotPurposeCard(timeline.value))
const { setLive } = useHostBotActivity()
const botLive = computed(() => botIsLive({
  pending: botPending.value,
  replying: replying.value,
  cheering: cheering.value,
  failed: markFailed.value,
}))
/**
 * In-thread status. A configured reply follows the polled Activity phase.
 * No key keeps the think mark below. `?activity=` is a local nuxt dev
 * preview force and wins over the live phase.
 */
const forcedActivity = computed(() => (
  import.meta.dev ? parseChatActivityKind(route.query.activity) : null
))
const botThreadId = computed(() => (
  threads.value.find((item) => item.kind === 'bot' && item.botId === botId.value)?.id ?? null
))
const activityLive = computed(() => (
  botPending.value
  && readyData.value?.configured === true
  && !forcedActivity.value
))
const { phase: liveActivityPhase } = useChatActivityPhase({
  active: activityLive,
  threadId: botThreadId,
  botId,
})
const threadActivity = computed(() => chatActivityStatus({
  pending: botPending.value,
  gatewayConfigured: readyData.value?.configured === true,
  phase: liveActivityPhase.value,
  forced: forcedActivity.value,
  connectTarget: import.meta.dev && typeof route.query.target === 'string'
    ? route.query.target
    : null,
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
 * Pill mark states, strongest first: a failed send beats a reply in
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

/**
 * Pill on one line; a concentric corner once the field is taller than that
 * or the attachment tray sits inside it.
 * Easing `9999px` down to 28px stays a pill until the last moment, so the
 * transition is pinned to the corner already on screen (half the row).
 */
function measureComposer() {
  const el = draftEl.value
  if (!el) {
    setComposerMultiline(false)
    return
  }
  if (pendingAttachments.value.length > 0) {
    setComposerMultiline(true)
    return
  }
  const style = getComputedStyle(el)
  const line = Number.parseFloat(style.lineHeight)
  const pad = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)
  if (!Number.isFinite(line) || line <= 0) {
    setComposerMultiline(el.value.includes('\n'))
    return
  }
  const oneLine = line + (Number.isFinite(pad) ? pad : 0)
  setComposerMultiline(el.scrollHeight > oneLine + line * 0.5)
}

function setComposerMultiline(next: boolean) {
  if (next === composerMultiline.value) {
    return
  }
  const row = composerRowEl.value
  const reduce = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!row || reduce) {
    if (row) {
      row.style.transition = ''
      row.style.borderRadius = ''
    }
    composerMultiline.value = next
    return
  }
  const ticket = ++composerRadiusTicket
  const used = `${row.getBoundingClientRect().height / 2}px`
  row.style.transition = 'none'
  row.style.borderRadius = used
  composerMultiline.value = next
  nextTick(() => {
    if (ticket !== composerRadiusTicket || !row.isConnected) {
      return
    }
    void row.offsetWidth
    row.style.transition = ''
    row.style.borderRadius = ''
  })
}

let composerObserver: ResizeObserver | null = null
let composerFrameObserver: ResizeObserver | null = null
let pillObserver: ResizeObserver | null = null

/** Close enough to the end that a layout change should keep the latest line in view. */
const NEAR_END_PX = 64

function threadNearEnd(): boolean {
  const el = threadEl.value
  if (!el) {
    return true
  }
  return el.scrollHeight - el.clientHeight - el.scrollTop <= NEAR_END_PX
}

function pinThreadToEnd() {
  const el = threadEl.value
  if (!el?.isConnected) {
    return
  }
  el.scrollTop = el.scrollHeight
  syncLatestJump()
}

function syncLatestJump() {
  showLatestJump.value = !threadNearEnd()
}

function onThreadScroll() {
  syncLatestJump()
}

/** Smooth return to the latest line. Reduced motion jumps. */
function jumpToLatest() {
  const el = threadEl.value
  if (!el?.isConnected) {
    return
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollTo({
    top: el.scrollHeight,
    behavior: reduce ? 'auto' : 'smooth',
  })
}

/** Pin after the overlay padding is in the scroll height, not only on the next tick. */
function pinAfterLayout() {
  pinThreadToEnd()
  if (typeof requestAnimationFrame !== 'function') {
    return
  }
  requestAnimationFrame(() => {
    pinThreadToEnd()
    requestAnimationFrame(pinThreadToEnd)
  })
}

/**
 * Thread end padding tracks the overlay so the latest line rests above the
 * field. Follow only when the pane was already at the end.
 */
function syncComposerClearance() {
  const page = pageEl.value
  const form = composerEl.value
  if (!page || !form) {
    return
  }
  const next = `${Math.ceil(form.getBoundingClientRect().height)}px`
  if (page.style.getPropertyValue('--composer-clearance') === next) {
    return
  }
  const follow = threadNearEnd()
  page.style.setProperty('--composer-clearance', next)
  if (follow) {
    pinThreadToEnd()
  } else {
    syncLatestJump()
  }
}

/**
 * Top padding tracks the overlay pill so the first line sits clear of it
 * when the thread is at the top. Later lines still scroll under the pill.
 * Follow the end only when the pane was already there.
 */
function syncPillClearance() {
  const page = pageEl.value
  const stage = stageEl.value
  const pill = pillEl.value
  if (!page || !stage || !pill) {
    return
  }
  const stageTop = stage.getBoundingClientRect().top
  const pillBottom = pill.getBoundingClientRect().bottom
  const next = `${Math.ceil(pillBottom - stageTop + 12)}px`
  if (page.style.getPropertyValue('--thread-top-gap') === next) {
    return
  }
  const follow = threadNearEnd()
  page.style.setProperty('--thread-top-gap', next)
  if (follow) {
    pinThreadToEnd()
  }
}

onMounted(() => {
  bindAttachmentWindow()
  greetOnOpen()
  measureComposer()
  const el = draftEl.value
  if (el && typeof ResizeObserver !== 'undefined') {
    composerObserver = new ResizeObserver(() => {
      measureComposer()
    })
    composerObserver.observe(el)
  }
  const form = composerEl.value
  if (form && typeof ResizeObserver !== 'undefined') {
    composerFrameObserver = new ResizeObserver(() => {
      syncComposerClearance()
    })
    composerFrameObserver.observe(form)
  }
  syncComposerClearance()
  const pill = pillEl.value
  if (pill && typeof ResizeObserver !== 'undefined') {
    pillObserver = new ResizeObserver(() => {
      syncPillClearance()
    })
    pillObserver.observe(pill)
  }
  syncPillClearance()
  pinAfterLayout()
  threadScrollEl = threadEl.value
  threadScrollEl?.addEventListener('scroll', onThreadScroll, { passive: true })
  void document.fonts?.ready.then(() => {
    pinAfterLayout()
  })
})

onUnmounted(() => {
  unbindAttachmentWindow()
  clearAttachments()
  clearMarkTimers()
  threadScrollEl?.removeEventListener('scroll', onThreadScroll)
  threadScrollEl = null
  composerObserver?.disconnect()
  composerFrameObserver?.disconnect()
  pillObserver?.disconnect()
  if (botId.value) {
    setLive(botId.value, false)
  }
})

watch([draft, () => pendingAttachments.value.length], () => {
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
  clearAttachments()
  settingsOpen.value = false
  pinAfterLayout()
})

watch([pendingSheetId, botId], () => {
  const id = pendingSheetId.value
  if (id && id === botId.value) {
    settingsOpen.value = true
    pendingSheetId.value = null
  }
}, { immediate: true })

watch([botId, botLive], ([id, live], previous) => {
  const previousId = previous?.[0]
  if (previousId && previousId !== id) {
    setLive(previousId, false)
  }
  if (id) {
    setLive(id, live)
  }
}, { immediate: true })

watch([timeline, botPending, showPurpose, threadActivity], () => {
  pinAfterLayout()
}, { flush: 'post', immediate: true })

function onOpenSheet(sheetId: string, targetId?: string) {
  const sheet = hostSheetById(sheetId)
  if (!sheet) {
    return
  }
  sheetTargetId.value = targetId ?? ''
  openSheet.value = sheet
  sheetOpen.value = true
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
  void deliver(draft.value, null, [...readyArtifactIds.value])
}

function onPurpose(content: string) {
  void deliver(content, null)
}

function retry() {
  const failed = optimistic.value
  if (!failed?.failed || sending.value) {
    return
  }
  void deliver(failed.content, failed, failed.artifacts?.map((item) => item.id) ?? [])
}

async function deliver(raw: string, existing: TimelineLine | null, artifactIds: string[] = []) {
  const content = raw.trim()
  if ((!content && artifactIds.length === 0) || sending.value || !bot.value || attachmentsUploading.value) {
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
    parts: [],
    artifacts: existing?.artifacts ?? pendingAttachments.value
      .filter((item) => item.artifactId && artifactIds.includes(item.artifactId))
      .map((item) => ({
        id: item.artifactId!,
        filename: item.filename,
        mime: item.mime,
        byteSize: item.byteSize,
        createdAt: new Date().toISOString(),
      })),
    authorName: user.value?.displayName ?? null,
    pending: true,
    failed: false,
  }
  botPending.value = true
  resetMark()
  try {
    await $fetch(`/api/bots/${targetId}/messages`, {
      method: 'POST',
      // Preview seed only. Production builds drop this (`import.meta.dev`).
      query: import.meta.dev && previewHoldRequested(route.query.hold)
        ? { hold: '1' }
        : undefined,
      body: { content, artifactIds },
    })
    if (botId.value !== targetId) {
      return
    }
    clearAttachments()
    await Promise.all([refresh(), refreshBot(), refreshBots(), refreshThreads()])
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
  await Promise.all([refreshBot(), refreshBots(), refreshThreads()])
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
  --avatar-ring: var(--bg-chat);
  /* Thread and composer share this so the block lines up with bubbles. */
  --thread-inset: 1.15rem;
  /* Fallback until the overlay is measured. One line plus the screen-edge gap. */
  --composer-clearance: 4.5rem;
  /* Empty canvas under the latest line when the thread is fully at the bottom. */
  --thread-end-gap: 5rem;
  /* Fallback until the overlay pill is measured. About the pill’s height. */
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
  gap: 0;
  min-width: 0;
  max-width: min(18rem, calc(100% - 6.5rem));
  appearance: none;
  border: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
  background: color-mix(in srgb, var(--sheet) 62%, transparent);
  backdrop-filter: blur(14px);
  color: inherit;
  border-radius: 999px;
  /* Equal inset around the mark and name. The arrow is not reserved. */
  padding: 0.18rem 0.7rem;
  cursor: pointer;
  font: inherit;
  box-shadow: 0 0.35rem 1.1rem rgb(0 0 0 / 28%);
}

.identity:hover:not(:disabled) {
  background: color-mix(in srgb, var(--sheet) 78%, transparent);
}

.identity:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.identity:disabled {
  cursor: default;
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

.cue-slot {
  display: flex;
  flex: none;
  align-items: center;
  width: 0;
  margin-inline-start: 0;
  overflow: hidden;
  opacity: 0;
  transition:
    width 180ms ease,
    margin-inline-start 180ms ease,
    opacity 160ms ease;
}

.identity:hover:not(:disabled) .cue-slot,
.identity:focus-visible .cue-slot {
  width: 1.05rem;
  margin-inline-start: 0.32rem;
  opacity: 1;
}

.cue {
  width: 1.05rem;
  height: 1.05rem;
  flex: none;
  fill: none;
  stroke: currentcolor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  color: var(--text-muted);
  transform: translateX(-0.2rem);
  transition: transform 180ms ease, color 160ms ease;
}

.identity:hover:not(:disabled) .cue,
.identity:focus-visible .cue {
  transform: none;
  color: var(--text);
}

.banner {
  position: relative;
  z-index: 3;
  margin: 0;
  padding: 0.7rem 1.25rem;
  color: var(--accent);
  border-bottom: 1px solid var(--line);
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
  /* Top gap clears the overlay pill at scroll top. End clearance matches
     the composer, plus an empty canvas under the latest line so that
     bubble is not flush with the field. Lines still scroll under both. */
  padding: var(--thread-top-gap) var(--thread-inset) calc(var(--composer-clearance) + var(--thread-end-gap));
  overflow: auto;
  overflow-anchor: none;
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

.bubble.failed {
  box-shadow: inset 0 0 0 1px var(--accent-dim);
}

.text {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.45;
}

.sheet-copy {
  margin: 0;
  line-height: 1.45;
}

.pending-mark,
.activity {
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

.to-latest {
  position: absolute;
  z-index: 3;
  left: 50%;
  bottom: calc(var(--composer-clearance) + 0.65rem);
  transform: translateX(-50%);
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--text) 8%, var(--composer));
  border-radius: 999px;
  background: var(--composer);
  color: var(--text);
  box-shadow: 0 0.35rem 1rem rgb(0 0 0 / 45%);
  cursor: pointer;
}

.to-latest svg {
  width: 1.15rem;
  height: 1.15rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.composer {
  --composer-gap: calc(0.85rem + env(safe-area-inset-bottom, 0px));
  position: absolute;
  z-index: 2;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  /* Inset matches the thread. Side margins beside the row stay clear.
     The strip under the row is a --bg-chat fill, so the thread cannot
     show through the screen-edge gap. */
  padding: 0.35rem var(--thread-inset) var(--composer-gap);
  background: linear-gradient(
    to top,
    var(--bg-chat) calc(var(--composer-gap) + 2px),
    transparent calc(var(--composer-gap) + 2px)
  );
  pointer-events: none;
}

/* Footer band: only the bottom half of the row, plus a hair past its
   edge. Used radius never passes the midline, so this seals the lower
   pockets and the strip under the field without filling the top pockets. */
.composer-foot {
  position: relative;
}

.composer-foot::before {
  content: "";
  position: absolute;
  z-index: 0;
  left: 0;
  right: 0;
  top: 50%;
  bottom: -2px;
  background: var(--bg-chat);
  pointer-events: none;
}

.composer-row,
.send-error {
  pointer-events: auto;
}

.composer-row {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  --composer-button: 2.25rem;
  --composer-pad: 0.3rem;
  --composer-rim: 1px;
  /* Anything inset by --composer-pad shares the button bend, so the
     outer corner is that bend plus the pad and the rim (concentric). */
  --composer-inner-radius: calc(var(--composer-button) / 2);
  gap: var(--composer-pad);
  overflow: hidden;
  /* Equal on every side so each circle sits concentric with its end cap. */
  padding: var(--composer-pad);
  /* A step lighter than the fill so the rim still reads on Chat black. */
  border: var(--composer-rim) solid color-mix(in srgb, var(--text) 8%, var(--composer));
  border-radius: 9999px;
  background: var(--composer);
  /* Same clock for the corner, the rim, and the fill so the stroke does not hitch. */
  transition-property: border-radius, border-color, background-color;
  transition-duration: 640ms;
  transition-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
}

.composer-row.multiline {
  border-radius: calc(var(--composer-inner-radius) + var(--composer-pad) + var(--composer-rim));
}

.composer-line {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.composer-row.multiline .composer-line {
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
  width: var(--composer-button);
  height: var(--composer-button);
  flex: none;
  border: 0;
  border-radius: 999px;
  padding: 0;
  cursor: pointer;
}

/* Ghost twin of Send: same circle, a soft fill and a hairline rim drawn
   inside so the footprint stays exactly the Send diameter. */
.attach {
  background: color-mix(in srgb, var(--text) 7%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text) 12%, transparent);
  color: var(--text);
  transition: background-color 160ms ease;
}

.attach:hover:not(:disabled) {
  background: color-mix(in srgb, var(--text) 13%, transparent);
}

.attach:focus-visible,
.send:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.attach:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.attach svg {
  width: 1.15rem;
  height: 1.15rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 2.2;
  stroke-linecap: round;
}

.drop-mask {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: grid;
  place-items: center;
  pointer-events: none;
  background: color-mix(in srgb, var(--bg-chat) 55%, transparent);
  color: var(--text);
  font-weight: 600;
  border: 2px dashed color-mix(in srgb, var(--accent) 55%, var(--line));
}

.pending-chips {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.45rem;
}

.pending-chip {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  max-width: 15rem;
  height: 3.5rem;
  --chip-inset: 0.625rem;
  padding: 0 2rem 0 var(--chip-inset);
  border-radius: var(--composer-inner-radius);
  border: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
  background: color-mix(in srgb, var(--text) 4%, transparent);
  font-size: 0.82rem;
}

.pending-chip.image {
  width: 3.5rem;
  padding: 0;
  overflow: hidden;
}

.pending-chip.error {
  border-color: var(--accent);
}

.pending-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.pending-chip.uploading .pending-thumb {
  opacity: 0.55;
}

.pending-veil {
  position: absolute;
  inset: auto 0 0;
  padding: 0.1rem 0;
  text-align: center;
  font-size: 0.62rem;
  background: color-mix(in srgb, var(--bg-chat) 70%, transparent);
  color: var(--text);
}

.pending-chip.error .pending-veil {
  color: var(--accent);
}

.pending-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: calc(var(--composer-inner-radius) - var(--chip-inset));
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent);
}

.pending-icon svg {
  width: 1.1rem;
  height: 1.1rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.9;
  stroke-linejoin: round;
}

.pending-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.pending-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-weight: 600;
}

.pending-meta {
  color: var(--text-muted);
  font-size: 0.74rem;
  white-space: nowrap;
}

.pending-chip.error .pending-meta {
  color: var(--accent);
}

.pending-remove {
  appearance: none;
  position: absolute;
  top: calc(var(--composer-inner-radius) - 0.65rem);
  right: calc(var(--composer-inner-radius) - 0.65rem);
  display: grid;
  place-items: center;
  width: 1.3rem;
  height: 1.3rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-chat) 72%, transparent);
  color: var(--text);
  cursor: pointer;
}

.pending-remove:hover {
  background: var(--bg-chat);
}

.pending-remove:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.pending-remove svg {
  width: 0.8rem;
  height: 0.8rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 2.4;
  stroke-linecap: round;
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
  /* One line is exactly the 2.25rem button box: 1.45rem + 2 × 0.4rem. */
  padding: 0.4rem 0.25rem;
  line-height: 1.45rem;
  min-height: 2.25rem;
  max-height: 8rem;
  field-sizing: content;
}

textarea:focus {
  outline: none;
}

@media (prefers-reduced-motion: reduce) {
  .composer-row,
  .cue-slot,
  .cue {
    transition: none;
  }
}
</style>
