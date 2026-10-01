<template>
  <div
    ref="pageEl"
    class="page"
  >
    <p
      v-if="loadError"
      class="banner"
    >
      {{ $t('chat.loadError') }}
    </p>
    <p
      v-else-if="gatewayUnset"
      class="quiet-banner"
    >
      <template v-if="isOwner">
        {{ $t('chat.quietOwnerShort') }}
        <NuxtLink to="/dashboard/providers">
          {{ $t('dashboard.nav.providers') }}
        </NuxtLink>
      </template>
      <template v-else>
        {{ $t('chat.quietMember') }}
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
        :aria-label="$t('chat.ariaChat')"
      >
        <li
          v-for="message in timeline"
          :key="message.id"
          class="bubble"
          :class="[message.role, { mine: isMine(message), failed: message.failed }]"
        >
          <KitMarkdown
            v-if="assistantBubbleUsesMarkdown(message.role)"
            :source="chatLineText(message.content)"
          />
          <p
            v-else
            class="text"
          >
            {{ chatLineText(message.content) }}
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
          :aria-label="$t('chat.aria.replying')"
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
            {{ $t('chat.emptyTitle') }}
          </p>
          <p class="empty-hint">
            {{ $t('chat.emptyHint') }}
          </p>
        </li>
      </ol>

      <div
        v-if="dropActive"
        class="drop-mask"
        aria-hidden="true"
      >
        {{ $t('chat.dropFiles') }}
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
            {{ $t('chat.retry') }}
          </button>
        </p>
        <input
          ref="fileInputEl"
          type="file"
          class="sr-only"
          multiple
          accept="image/*,application/pdf,text/plain,text/markdown,.md,.txt,.pdf"
          @change="onFileInput"
        >
        <ChatComposerPill
          :tall="pendingAttachments.length > 0"
          attach
          :attach-disabled="!bot"
          :show-send="Boolean(draft.trim() || canSendAttachments)"
          :send-disabled="sending || !bot || attachmentsUploading"
          @attach="pickFiles()"
        >
          <template #tray>
            <ChatPendingAttachments
              :items="pendingAttachments"
              @remove="removeAttachment"
            />
          </template>
          <label class="draft">
            <span class="sr-only">{{ $t('chat.aria.message') }}</span>
            <textarea
              v-model="draft"
              rows="1"
              maxlength="16000"
              :placeholder="pendingAttachments.length > 0
                ? $t('chat.placeholderOrSend')
                : $t('chat.placeholderFor', { name: bot?.name ?? 'Bot' })"
              :disabled="!bot"
              @keydown.enter.exact.prevent="send"
              @paste="onAttachPaste"
              @focus="listening = true"
              @blur="listening = false"
            />
          </label>
        </ChatComposerPill>
      </form>

      <button
        v-if="showLatestJump"
        type="button"
        class="to-latest"
        :aria-label="$t('chat.aria.scrollLatest')"
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
      @applied="onPackApplied"
    />
    <KitSheet
      v-model:open="sheetOpen"
      :title="openSheetTitle"
      :description="openSheet?.kind === 'kitchen' ? $t('chat.sheet.kitchenDescription') : undefined"
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
import type { HostSheetEntry } from '../../utils/host-sheets'
import { assistantBubbleUsesMarkdown, KitChatParts, KitMarkdown, KitSheet, localizeGatewayErrorReply } from '@dostigus/ui-kit'
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
  pick: pickFiles,
  onFileInput,
  remove: removeAttachment,
  onPaste: onAttachPaste,
  clear: clearAttachments,
  bindWindow: bindAttachmentWindow,
  unbindWindow: unbindAttachmentWindow,
} = useComposerAttachments()

const draft = ref('')
const pageEl = ref<HTMLElement | null>(null)
const composerEl = ref<HTMLFormElement | null>(null)
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
const openSheetTitle = computed(() => openSheet.value?.title ?? t('chat.sheet.defaultTitle'))
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
const { locale, t } = useI18n()
const hostLocale = computed(() => locale.value === 'ru' ? 'ru' as const : 'en' as const)
function chatLineText(content: string) {
  return localizeGatewayErrorReply(content, hostLocale.value)
}
const threadActivity = computed(() => chatActivityStatus({
  pending: botPending.value,
  gatewayConfigured: readyData.value?.configured === true,
  phase: liveActivityPhase.value,
  forced: forcedActivity.value,
  connectTarget: import.meta.dev && typeof route.query.target === 'string'
    ? route.query.target
    : null,
  locale: hostLocale.value,
}))
const identityLabel = computed(() => {
  if (!bot.value) {
    return t('chat.identityAria.settings')
  }
  return botLive.value
    ? t('chat.identityAria.onlineSettings', { name: bot.value.name })
    : `${bot.value.name}, ${t('chat.identityAria.settings')}`
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
  composerFrameObserver?.disconnect()
  pillObserver?.disconnect()
  if (botId.value) {
    setLive(botId.value, false)
  }
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
  const sheet = hostSheetById(sheetId, hostLocale.value)
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
  if (!existing) {
    clearAttachments()
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
    sendError.value = t('chat.sendError')
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

async function onPackApplied(id: string) {
  settingsOpen.value = false
  if (id !== botId.value) {
    await navigateTo(`/bots/${id}`)
    return
  }
  await onBotSaved()
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
  min-width: 0;
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

.send-error {
  margin: 0;
  pointer-events: auto;
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

@media (prefers-reduced-motion: reduce) {
  .cue-slot,
  .cue {
    transition: none;
  }
}
</style>
