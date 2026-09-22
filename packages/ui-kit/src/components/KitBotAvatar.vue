<template>
  <span
    class="kit-bot-avatar"
    :class="[
      `kit-bot-avatar--${size}`,
      `kit-bot-avatar--${state}`,
      { 'kit-bot-avatar--selected': selected },
    ]"
    :style="{ '--kit-bot-body': fill, '--kit-bot-beak': beak }"
    aria-hidden="true"
  >
    <svg
      class="kit-bot-avatar__svg"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g class="kit-bot-avatar__motion">
        <path
          class="kit-bot-avatar__body"
          :d="mark.body"
        />
        <path
          class="kit-bot-avatar__beak"
          :d="mark.beak"
        />
        <ellipse
          class="kit-bot-avatar__eye-l"
          v-bind="mark.eyeL"
        />
        <ellipse
          class="kit-bot-avatar__eye-r"
          v-bind="mark.eyeR"
        />
      </g>
    </svg>
  </span>
</template>

<script setup lang="ts">
import type { BotAvatarShape, BotAvatarState } from '@dostigus/shared'
import {
  beakColorFromBody,
  DEFAULT_AVATAR_COLOR,
  DEFAULT_AVATAR_SHAPE,
  DEFAULT_AVATAR_STATE,
  migrateBotAvatarShape,
  normalizeBotAccentHex,
} from '@dostigus/shared'
import { computed } from 'vue'

type Eye = {
  cx: number
  cy: number
  rx: number
  ry: number
  transform?: string
}

type GooseMark = {
  body: string
  beak: string
  eyeL: Eye
  eyeR: Eye
}

const props = withDefaults(defineProps<{
  shape?: BotAvatarShape | string
  color?: string
  size?: 'sm' | 'md' | 'lg'
  selected?: boolean
  /** Motion hook: light idle breathe only in this release. */
  state?: BotAvatarState
}>(), {
  shape: DEFAULT_AVATAR_SHAPE,
  color: DEFAULT_AVATAR_COLOR,
  size: 'md',
  selected: false,
  state: DEFAULT_AVATAR_STATE,
})

/**
 * Soft goose-character silhouettes (not Grok blobs). Facing right-ish;
 * named parts body / beak / eye-l / eye-r for later motion.
 */
const GOOSE_MARKS: Record<BotAvatarShape, GooseMark> = {
  round: {
    body: 'M20 40c-1-12 7-22 18-24c3-0.5 6-0.2 9 1.2c4 2 7 5.5 8 10c0.6 2.8 0.2 5.5-1 8C51 41 45 46 36 47c-10 1-15-3-16-7zM34 16c0.5-5 5-9 10.5-8.5C49 8 53 12 53.5 17c0.3 3-1 5.5-3.2 7.2C47 26.5 43 27 39 26c-4-0.8-5.5-4-5-10z',
    beak: 'M52 20.5c5.5 1.2 9.5 3.8 9.5 6.8c0 2.4-2.8 4.2-7.2 4.8c-2 0.3-3.8-0.2-4.8-1.2c-0.9-0.9-1-2.2-0.3-3.3c0.9-1.6 1.7-4.2 2.8-7.1z',
    eyeL: { cx: 40, cy: 15.5, rx: 2.3, ry: 3, transform: 'rotate(-10 40 15.5)' },
    eyeR: { cx: 48, cy: 14.5, rx: 2.3, ry: 3, transform: 'rotate(-10 48 14.5)' },
  },
  tall: {
    body: 'M28 54c-3.5-1.2-5.5-5.5-4.8-12c0.8-9 2.5-18 5.2-26c1.2-3.5 4.5-5.5 8.2-5.2c3.5 0.3 6.2 2.8 7.2 6.2c1.8 6.5 2.2 15 1.5 23c-0.5 5.5-2.8 10-7 12c-3.2 1.5-7.2 2-10.3 2zM38 12c0.4-4.2 3.8-7.2 7.8-7c3.5 0.2 6.2 2.8 6.8 6.2c0.5 2.8-0.8 5.2-3 6.5C47 19.5 43.5 20 40.5 19c-2.8-0.9-3-3.5-2.5-7z',
    beak: 'M50 10c4.8 0.8 8 3 8 5.6c0 1.9-2.4 3.4-6 4c-1.7 0.3-3.2-0.2-4-1.1c-0.8-0.8-0.8-2-0.2-2.9c0.7-1.3 1.4-3.4 2.2-5.6z',
    eyeL: { cx: 41.5, cy: 9.5, rx: 1.9, ry: 2.5, transform: 'rotate(-8 41.5 9.5)' },
    eyeR: { cx: 48, cy: 8.8, rx: 1.9, ry: 2.5, transform: 'rotate(-8 48 8.8)' },
  },
  squat: {
    body: 'M12 40c0-9 7-16 17-18c4-0.8 8-0.5 12 1c7 2.5 13 8 14 15c0.8 6-3.5 11-12 13c-10 2-22-1-28-6c-1.2-1-1.6-2.6-1-4C13 39.5 12.5 39.8 12 40zM30 24c0.8-4.5 4.8-7.5 9.5-7c4 0.4 7 3.2 7.8 6.8c0.5 2.2-0.5 4.2-2.2 5.4C42.5 31.5 38 32 34.5 31c-3.2-0.9-4.2-3.2-4.5-7z',
    beak: 'M50 28c5.5 1.8 9 4.2 9 7c0 2.2-2.6 3.8-6.8 4.4c-1.9 0.3-3.6-0.2-4.6-1.2c-0.9-0.9-1-2.2-0.3-3.3c0.9-1.5 1.8-4 2.7-6.9z',
    eyeL: { cx: 36, cy: 23, rx: 2.3, ry: 3, transform: 'rotate(-8 36 23)' },
    eyeR: { cx: 43.5, cy: 22, rx: 2.3, ry: 3, transform: 'rotate(-8 43.5 22)' },
  },
  lean: {
    body: 'M31 54c-3-1-4.5-5-3.8-11c0.9-9 2.2-20 4.5-28c1.2-4 4.5-6.2 8.2-5.8c3.2 0.3 5.8 2.8 6.5 6c1.5 7 2 18 1.2 27c-0.5 5.5-2.8 9.5-6.8 11c-3.2 1.2-7 1.5-9.8 0.8zM42 12c0.3-3.5 3.2-6 6.5-5.8c2.8 0.2 5 2.4 5.5 5.2c0.4 2.2-0.6 4.2-2.5 5.2C49 18 46 18.2 43.5 17.2c-2.2-0.9-2-2.8-1.5-5.2z',
    beak: 'M51 10.5c4.5 0.7 7.5 2.8 7.5 5.2c0 1.7-2.2 3-5.5 3.5c-1.5 0.2-2.9-0.2-3.7-1c-0.7-0.7-0.8-1.8-0.2-2.7c0.6-1.2 1.2-3.2 1.9-5z',
    eyeL: { cx: 44.5, cy: 9.2, rx: 1.8, ry: 2.4, transform: 'rotate(-6 44.5 9.2)' },
    eyeR: { cx: 50.5, cy: 8.5, rx: 1.8, ry: 2.4, transform: 'rotate(-6 50.5 8.5)' },
  },
  plump: {
    body: 'M14 38c-1.5-12 7-24 21-26c4-0.6 8 0 11.5 2c6 3.2 10 9 11 15.5c1 7-1.5 13-7.5 17C44 51 36 53 28 52c-10-1.2-14-7-14-14zM34 14c0.5-5 5.2-9 11-8.5c5 0.5 8.5 4.2 9 9c0.3 2.8-1 5.2-3.2 6.8C47.5 24 43 24.5 39 23.5c-4-1-5.5-4.2-5-9.5z',
    beak: 'M52 19c6 1.5 10.5 4.2 10.5 7.5c0 2.5-3.2 4.5-8.2 5.1c-2.2 0.3-4.2-0.3-5.4-1.5c-1-1-1.1-2.5-0.4-3.7c1-2 2.4-5.2 3.5-7.4z',
    eyeL: { cx: 40, cy: 14, rx: 2.5, ry: 3.3, transform: 'rotate(-12 40 14)' },
    eyeR: { cx: 49, cy: 13, rx: 2.5, ry: 3.3, transform: 'rotate(-12 49 13)' },
  },
  chick: {
    body: 'M24 42c0-9 6.5-16 14.5-16c7 0 12.5 5.5 13.5 12c0.7 4.5-1.5 9-5.5 11.5c-3 1.8-7 2.8-11.5 2.5c-6.5-0.4-11-4.5-11-10zM34 28c0.5-3.8 3.8-6.2 7.5-5.8c3.2 0.4 5.5 2.8 6 5.8c0.3 1.8-0.5 3.5-1.8 4.5C43.5 34.5 40 35 37 34c-2.5-0.8-3.2-2.8-3-6z',
    beak: 'M46 29.5c4 1 6.5 2.8 6.5 5c0 1.7-2 3-5 3.4c-1.4 0.2-2.7-0.2-3.4-1c-0.7-0.7-0.7-1.7-0.2-2.5c0.5-1 1.2-2.8 2.1-4.9z',
    eyeL: { cx: 37.5, cy: 26.5, rx: 2, ry: 2.6, transform: 'rotate(-8 37.5 26.5)' },
    eyeR: { cx: 44, cy: 25.8, rx: 2, ry: 2.6, transform: 'rotate(-8 44 25.8)' },
  },
  honk: {
    body: 'M10 38c0-8 6.5-15 16.5-17c4.5-1 9.5-0.6 14 1.5c9 4 16 11 18 19c1 4-1.2 8-5.5 10.5c-4 2.2-10 3.2-17 3c-13-0.4-24-6-26-14C9.2 39.5 9.5 38.5 10 38zM30 24c0.8-5 5.5-8.5 11-8c4.5 0.4 8 3.8 9 8c0.5 2.2-0.4 4.2-2 5.5C45 32 40.5 32.5 36.5 31.5c-3.5-0.9-5-3.5-6.5-7.5z',
    beak: 'M54 28c8 2.2 13.5 5.8 13.5 9.8c0 3-4 5.2-10.5 5.8c-2.8 0.3-5.2-0.4-6.6-1.8c-1.2-1.2-1.3-3-0.4-4.4c1.3-2.2 2.8-6 4-9.4z',
    eyeL: { cx: 37, cy: 22.5, rx: 2.4, ry: 3.1, transform: 'rotate(-6 37 22.5)' },
    eyeR: { cx: 46, cy: 21.5, rx: 2.4, ry: 3.1, transform: 'rotate(-6 46 21.5)' },
  },
  peek: {
    body: 'M34 50c-2.5-1-4-4.5-3.2-10c1.2-10 4-18 8.5-22c2.5-2.2 6-2.8 9.5-1.2c3 1.4 5 4.5 5.2 8c0.5 7.5-1.5 15.5-4.5 21.5c-2 4-5.5 6.5-9.5 7c-2.5 0.3-5-0.8-6-3.3zM48 20c0.5-3.2 3.2-5.2 6-4.8c2.2 0.3 4 2.2 4.4 4.5c0.3 1.8-0.5 3.5-1.8 4.4C54.5 25.5 51.5 26 49 25c-2-0.8-1.5-2.5-1-5z',
    beak: 'M56 21c4.8 1.2 8 3.5 8 6.2c0 2-2.2 3.5-5.8 4c-1.7 0.25-3.2-0.2-4-1.1c-0.8-0.8-0.8-2-0.2-2.9c0.7-1.4 1.3-3.6 2-6.2z',
    eyeL: { cx: 50, cy: 18.5, rx: 2.1, ry: 2.7, transform: 'rotate(-16 50 18.5)' },
    eyeR: { cx: 56.5, cy: 17.5, rx: 2.1, ry: 2.7, transform: 'rotate(-16 56.5 17.5)' },
  },
}

const resolvedShape = computed(() => migrateBotAvatarShape(props.shape))
const mark = computed(() => GOOSE_MARKS[resolvedShape.value] ?? GOOSE_MARKS[DEFAULT_AVATAR_SHAPE])
const fill = computed(() => normalizeBotAccentHex(props.color) ?? DEFAULT_AVATAR_COLOR)
const beak = computed(() => beakColorFromBody(fill.value))
</script>

<style src="../kit.css"></style>

<style scoped>
.kit-bot-avatar {
  display: inline-grid;
  place-items: center;
  flex: none;
  line-height: 0;
  user-select: none;
}

.kit-bot-avatar__svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.kit-bot-avatar__motion {
  transform-origin: 50% 72%;
  transform-box: fill-box;
}

.kit-bot-avatar__body {
  fill: var(--kit-bot-body);
}

.kit-bot-avatar__beak {
  fill: var(--kit-bot-beak);
}

.kit-bot-avatar__eye-l,
.kit-bot-avatar__eye-r {
  fill: #121212;
}

.kit-bot-avatar--sm {
  width: 1.7rem;
  height: 1.7rem;
}

.kit-bot-avatar--md {
  width: 2.4rem;
  height: 2.4rem;
}

.kit-bot-avatar--lg {
  width: 3.4rem;
  height: 3.4rem;
}

.kit-bot-avatar--selected {
  outline: 2px solid #3a3a3a;
  outline-offset: 3px;
  border-radius: 0.55rem;
}

.kit-bot-avatar--idle .kit-bot-avatar__motion {
  animation: kit-bot-idle-breathe 3.2s ease-in-out infinite;
}

/* think / reply / work: hooks only — full choreography later */
.kit-bot-avatar--think .kit-bot-avatar__motion,
.kit-bot-avatar--reply .kit-bot-avatar__motion,
.kit-bot-avatar--work .kit-bot-avatar__motion {
  transform: none;
}

@keyframes kit-bot-idle-breathe {
  0%,
  100% {
    transform: translateY(0) scale(1, 1);
  }

  50% {
    transform: translateY(-1.2%) scale(1.025, 0.97);
  }
}

@media (prefers-reduced-motion: reduce) {
  .kit-bot-avatar--idle .kit-bot-avatar__motion {
    animation: none;
  }
}
</style>
