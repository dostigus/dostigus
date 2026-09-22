<template>
  <span
    class="kit-bot-avatar"
    :class="[
      `kit-bot-avatar--${size}`,
      `kit-bot-avatar--${state}`,
      `kit-bot-avatar--${resolvedShape}`,
      { 'kit-bot-avatar--selected': selected },
    ]"
    :style="tones"
    aria-hidden="true"
  >
    <svg
      class="kit-bot-avatar__svg"
      :viewBox="`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        class="kit-bot-avatar__mark-motion"
        :style="pivots.mark"
      >
        <g class="kit-bot-avatar__tail">
          <component
            :is="piece.tag"
            v-for="(piece, index) in parts.tail"
            :key="index"
            v-bind="piece.attrs"
          />
        </g>
        <g class="kit-bot-avatar__feet">
          <component
            :is="piece.tag"
            v-for="(piece, index) in parts.feet"
            :key="index"
            v-bind="piece.attrs"
          />
        </g>
        <g class="kit-bot-avatar__body">
          <component
            :is="piece.tag"
            v-for="(piece, index) in parts.body"
            :key="index"
            v-bind="piece.attrs"
          />
        </g>
        <g class="kit-bot-avatar__belly">
          <component
            :is="piece.tag"
            v-for="(piece, index) in parts.belly"
            :key="index"
            v-bind="piece.attrs"
          />
        </g>
        <g
          class="kit-bot-avatar__wing-motion"
          :style="pivots.wing"
        >
          <g class="kit-bot-avatar__wing">
            <component
              :is="piece.tag"
              v-for="(piece, index) in parts.wing"
              :key="index"
              v-bind="piece.attrs"
            />
          </g>
        </g>
        <g
          class="kit-bot-avatar__head-motion"
          :style="pivots.head"
        >
          <g class="kit-bot-avatar__crest">
            <component
              :is="piece.tag"
              v-for="(piece, index) in parts.crest"
              :key="index"
              v-bind="piece.attrs"
            />
          </g>
          <g class="kit-bot-avatar__skull">
            <component
              :is="piece.tag"
              v-for="(piece, index) in parts.head"
              :key="index"
              v-bind="piece.attrs"
            />
          </g>
          <g
            class="kit-bot-avatar__jaw-motion"
            :style="pivots.jaw"
          >
            <g class="kit-bot-avatar__jaw">
              <component
                :is="piece.tag"
                v-for="(piece, index) in parts.jaw"
                :key="index"
                v-bind="piece.attrs"
              />
            </g>
          </g>
          <g class="kit-bot-avatar__beak">
            <component
              :is="piece.tag"
              v-for="(piece, index) in parts.beak"
              :key="index"
              v-bind="piece.attrs"
            />
          </g>
          <g
            v-for="(eye, index) in mark.eyes"
            :key="`eye-${index}`"
            class="kit-bot-avatar__eye-motion"
            :style="{ 'transform-origin': `${eye.cx}px ${eye.cy}px` }"
          >
            <g class="kit-bot-avatar__eye">
              <circle
                class="kit-bot-avatar__sclera"
                :cx="eye.cx"
                :cy="eye.cy"
                :r="eye.r"
              />
              <circle
                class="kit-bot-avatar__pupil"
                :cx="eye.cx + eye.r * 0.22"
                :cy="eye.cy"
                :r="eye.pupil"
              />
              <circle
                class="kit-bot-avatar__glint"
                :cx="eye.cx + eye.r * 0.22 - eye.pupil * 0.45"
                :cy="eye.cy - eye.pupil * 0.5"
                :r="eye.pupil * 0.36"
              />
            </g>
          </g>
        </g>
      </g>
    </svg>
  </span>
</template>

<script setup lang="ts">
import type { BotAvatarShape, BotAvatarState } from '@dostigus/shared'
import {
  botMarkPalette,
  DEFAULT_AVATAR_COLOR,
  DEFAULT_AVATAR_SHAPE,
  DEFAULT_AVATAR_STATE,
  migrateBotAvatarShape,
  normalizeBotAccentHex,
} from '@dostigus/shared'
import { computed } from 'vue'
import { BOT_MARKS, MARK_VIEWBOX, renderPiece } from '../bot-marks'

const props = withDefaults(defineProps<{
  /** Flock bird id. Legacy ids migrate on read. */
  shape?: BotAvatarShape | string
  /** Bot accent hex. Every other tone derives from it. */
  color?: string
  size?: 'sm' | 'md' | 'lg'
  selected?: boolean
  /** `idle` breathes and blinks, `think` looks up, `reply` talks, `work` flaps. */
  state?: BotAvatarState
}>(), {
  shape: DEFAULT_AVATAR_SHAPE,
  color: DEFAULT_AVATAR_COLOR,
  size: 'md',
  selected: false,
  state: DEFAULT_AVATAR_STATE,
})

const resolvedShape = computed(() => migrateBotAvatarShape(props.shape))
const mark = computed(() => BOT_MARKS[resolvedShape.value])

const parts = computed(() => {
  const source = mark.value
  return {
    tail: source.tail.map(renderPiece),
    body: source.body.map(renderPiece),
    belly: source.belly.map(renderPiece),
    wing: source.wing.map(renderPiece),
    feet: source.feet.map(renderPiece),
    crest: source.crest.map(renderPiece),
    head: source.head.map(renderPiece),
    beak: source.beak.map(renderPiece),
    jaw: source.jaw.map(renderPiece),
  }
})

const tones = computed(() => {
  const palette = botMarkPalette(normalizeBotAccentHex(props.color) ?? DEFAULT_AVATAR_COLOR)
  return {
    '--kit-bot-body': palette.body,
    '--kit-bot-shade': palette.shade,
    '--kit-bot-light': palette.light,
    '--kit-bot-beak': palette.beak,
    '--kit-bot-ink': palette.ink,
  }
})

/**
 * SVG transform-origin resolves against the view-box, so each moving part
 * carries the user-space point it turns around.
 */
const pivots = computed(() => {
  const source = mark.value
  const origin = ([x, y]: [number, number]) => ({ 'transform-origin': `${x}px ${y}px` })
  return {
    mark: origin([MARK_VIEWBOX / 2, MARK_VIEWBOX - 6]),
    head: origin(source.headPivot),
    jaw: origin(source.jawPivot),
    wing: origin(source.wingPivot),
  }
})
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

.kit-bot-avatar__mark-motion,
.kit-bot-avatar__head-motion,
.kit-bot-avatar__jaw-motion,
.kit-bot-avatar__wing-motion,
.kit-bot-avatar__eye-motion {
  transform-box: view-box;
}

.kit-bot-avatar__tail,
.kit-bot-avatar__wing {
  fill: var(--kit-bot-shade);
  stroke: var(--kit-bot-shade);
}

.kit-bot-avatar__body,
.kit-bot-avatar__skull,
.kit-bot-avatar__crest {
  fill: var(--kit-bot-body);
  stroke: var(--kit-bot-body);
}

.kit-bot-avatar__belly {
  fill: var(--kit-bot-light);
  opacity: 0.92;
}

.kit-bot-avatar__beak,
.kit-bot-avatar__jaw,
.kit-bot-avatar__feet {
  fill: var(--kit-bot-beak);
  stroke: var(--kit-bot-beak);
}

.kit-bot-avatar__sclera {
  fill: var(--kit-bot-light);
}

.kit-bot-avatar__pupil {
  fill: var(--kit-bot-ink);
}

.kit-bot-avatar__glint {
  fill: #fff;
  opacity: 0.85;
}

.kit-bot-avatar--sm {
  width: 1.75rem;
  height: 1.75rem;
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

/* idle: a slow breath, a small head settle, and a rare blink. */
.kit-bot-avatar--idle .kit-bot-avatar__mark-motion {
  animation: kit-bot-breathe 3.6s ease-in-out infinite;
}

.kit-bot-avatar--idle .kit-bot-avatar__head-motion {
  animation: kit-bot-idle-head 3.6s ease-in-out infinite;
}

.kit-bot-avatar--idle .kit-bot-avatar__eye-motion,
.kit-bot-avatar--think .kit-bot-avatar__eye-motion,
.kit-bot-avatar--reply .kit-bot-avatar__eye-motion {
  animation: kit-bot-blink 5.4s ease-in-out infinite;
}

/* think: beak up, a long sway, wing tucked still. */
.kit-bot-avatar--think .kit-bot-avatar__head-motion {
  animation: kit-bot-think-head 2.8s ease-in-out infinite;
}

.kit-bot-avatar--think .kit-bot-avatar__mark-motion {
  animation: kit-bot-think-sway 2.8s ease-in-out infinite;
}

/* reply: the jaw talks, the head bobs with it, the wing flicks. */
.kit-bot-avatar--reply .kit-bot-avatar__jaw-motion {
  animation: kit-bot-talk 0.42s ease-in-out infinite;
}

.kit-bot-avatar--reply .kit-bot-avatar__head-motion {
  animation: kit-bot-reply-head 0.84s ease-in-out infinite;
}

.kit-bot-avatar--reply .kit-bot-avatar__wing-motion {
  animation: kit-bot-wing-flick 1.68s ease-in-out infinite;
}

/* work: a steady flap. */
.kit-bot-avatar--work .kit-bot-avatar__wing-motion {
  animation: kit-bot-flap 0.68s ease-in-out infinite;
}

.kit-bot-avatar--work .kit-bot-avatar__mark-motion {
  animation: kit-bot-work-bob 0.68s ease-in-out infinite;
}

@keyframes kit-bot-breathe {
  0%,
  100% {
    transform: scale(1, 1);
  }

  50% {
    transform: scale(1.015, 0.985) translateY(0.4px);
  }
}

@keyframes kit-bot-idle-head {
  0%,
  100% {
    transform: none;
  }

  40% {
    transform: translateY(-0.5px) rotate(-1.6deg);
  }

  72% {
    transform: rotate(0.9deg);
  }
}

@keyframes kit-bot-blink {
  0%,
  91%,
  100% {
    transform: scaleY(1);
  }

  94%,
  96% {
    transform: scaleY(0.08);
  }

  98% {
    transform: scaleY(1);
  }
}

@keyframes kit-bot-think-head {
  0%,
  100% {
    transform: translateY(-0.8px) rotate(-9deg);
  }

  50% {
    transform: translateY(0.2px) rotate(-3.5deg);
  }
}

@keyframes kit-bot-think-sway {
  0%,
  100% {
    transform: rotate(-1.2deg);
  }

  50% {
    transform: rotate(1.2deg);
  }
}

@keyframes kit-bot-talk {
  0%,
  100% {
    transform: none;
  }

  45% {
    transform: translateY(1.1px) rotate(12deg);
  }
}

@keyframes kit-bot-reply-head {
  0%,
  100% {
    transform: none;
  }

  25% {
    transform: translateY(-0.8px) rotate(-2.6deg);
  }

  62% {
    transform: translateY(0.3px) rotate(1deg);
  }
}

@keyframes kit-bot-wing-flick {
  0%,
  62%,
  100% {
    transform: none;
  }

  78% {
    transform: rotate(-9deg) translateY(-0.6px);
  }
}

@keyframes kit-bot-flap {
  0%,
  100% {
    transform: none;
  }

  50% {
    transform: rotate(-17deg) translateY(-0.9px);
  }
}

@keyframes kit-bot-work-bob {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-0.7px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .kit-bot-avatar [class$='-motion'] {
    animation: none !important;
  }
}
</style>
