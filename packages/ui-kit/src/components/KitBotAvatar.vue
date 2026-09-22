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
              <g class="kit-bot-avatar__gaze">
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
  /**
   * Motion. `idle` breathes, `think` lifts the bill, `reply` talks,
   * `work` flaps, `greet` and `celebrate` play once, `listen` leans in,
   * `error` tilts confused, `sleep` shuts the eyes.
   */
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
  outline: 2px solid var(--line, #333333);
  outline-offset: 3px;
  border-radius: 0.55rem;
}

/* idle: a slow breath, a small head settle, and a rare blink. */
.kit-bot-avatar--idle .kit-bot-avatar__mark-motion {
  animation: kit-bot-breathe 4.2s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}

.kit-bot-avatar--idle .kit-bot-avatar__head-motion {
  animation: kit-bot-idle-head 4.2s ease-in-out infinite;
}

.kit-bot-avatar--idle .kit-bot-avatar__eye-motion {
  animation: kit-bot-blink 6.4s ease-in-out infinite;
}

/* think: bill up, a long sway, eyes searching the ceiling. */
.kit-bot-avatar--think .kit-bot-avatar__head-motion {
  animation: kit-bot-think-head 3.2s ease-in-out infinite;
}

.kit-bot-avatar--think .kit-bot-avatar__mark-motion {
  animation: kit-bot-think-sway 3.2s ease-in-out infinite;
}

.kit-bot-avatar--think .kit-bot-avatar__gaze {
  animation: kit-bot-think-gaze 3.2s ease-in-out infinite;
}

.kit-bot-avatar--think .kit-bot-avatar__eye-motion {
  animation: kit-bot-slow-blink 5.2s ease-in-out infinite;
}

/* reply: three syllables a cycle, the head riding them, one wing flick. */
.kit-bot-avatar--reply .kit-bot-avatar__jaw-motion {
  animation: kit-bot-talk 0.92s ease-in-out infinite;
}

.kit-bot-avatar--reply .kit-bot-avatar__head-motion {
  animation: kit-bot-reply-head 0.92s ease-in-out infinite;
}

.kit-bot-avatar--reply .kit-bot-avatar__wing-motion {
  animation: kit-bot-wing-flick 1.84s ease-in-out infinite;
}

.kit-bot-avatar--reply .kit-bot-avatar__eye-motion {
  animation: kit-bot-blink 6.4s ease-in-out infinite;
}

/* work: a steady flap that loops without a seam. */
.kit-bot-avatar--work .kit-bot-avatar__wing-motion {
  animation: kit-bot-flap 0.62s ease-in-out infinite;
}

.kit-bot-avatar--work .kit-bot-avatar__mark-motion {
  animation: kit-bot-work-bob 0.62s ease-in-out infinite;
}

.kit-bot-avatar--work .kit-bot-avatar__eye-motion {
  animation: kit-bot-blink 6.4s ease-in-out infinite;
}

/* greet: one nod and a wave, then still. The Host drops back to idle. */
.kit-bot-avatar--greet .kit-bot-avatar__head-motion {
  animation: kit-bot-greet-head 1.15s ease-in-out 1 both;
}

.kit-bot-avatar--greet .kit-bot-avatar__wing-motion {
  animation: kit-bot-greet-wing 1.15s ease-in-out 1 both;
}

.kit-bot-avatar--greet .kit-bot-avatar__mark-motion {
  animation: kit-bot-greet-hop 1.15s ease-out 1 both;
}

/* listen: leaning in, eyes forward, breathing held small. */
.kit-bot-avatar--listen .kit-bot-avatar__head-motion {
  animation: kit-bot-listen-head 2.8s ease-in-out infinite;
}

.kit-bot-avatar--listen .kit-bot-avatar__mark-motion {
  animation: kit-bot-listen-lean 2.8s ease-in-out infinite;
}

.kit-bot-avatar--listen .kit-bot-avatar__gaze {
  animation: kit-bot-listen-gaze 2.8s ease-in-out infinite;
}

.kit-bot-avatar--listen .kit-bot-avatar__eye-motion {
  animation: kit-bot-blink 7.6s ease-in-out infinite;
}

/* celebrate: one hop and a wing cheer after a reply lands. */
.kit-bot-avatar--celebrate .kit-bot-avatar__mark-motion {
  animation: kit-bot-celebrate-hop 1.05s cubic-bezier(0.3, 1.4, 0.5, 1) 1 both;
}

.kit-bot-avatar--celebrate .kit-bot-avatar__wing-motion {
  animation: kit-bot-celebrate-wing 1.05s ease-in-out 1 both;
}

.kit-bot-avatar--celebrate .kit-bot-avatar__head-motion {
  animation: kit-bot-celebrate-head 1.05s ease-in-out 1 both;
}

/* error: a confused tilt and a slower blink. */
.kit-bot-avatar--error .kit-bot-avatar__head-motion {
  animation: kit-bot-error-head 3.6s ease-in-out infinite;
}

.kit-bot-avatar--error .kit-bot-avatar__mark-motion {
  animation: kit-bot-error-sway 3.6s ease-in-out infinite;
}

.kit-bot-avatar--error .kit-bot-avatar__eye-motion {
  animation: kit-bot-slow-blink 3.2s ease-in-out infinite;
}

/* sleep: eyes shut to a slit, head down, a long breath. */
.kit-bot-avatar--sleep .kit-bot-avatar__mark-motion {
  animation: kit-bot-sleep-breathe 5.6s ease-in-out infinite;
}

.kit-bot-avatar--sleep .kit-bot-avatar__head-motion {
  animation: kit-bot-sleep-head 5.6s ease-in-out infinite;
}

.kit-bot-avatar--sleep .kit-bot-avatar__eye-motion {
  transform: scaleY(0.16);
}

@keyframes kit-bot-breathe {
  0%,
  100% {
    transform: scale(1, 1);
  }

  50% {
    transform: scale(1.018, 0.982) translateY(0.5px);
  }
}

@keyframes kit-bot-idle-head {
  0%,
  100% {
    transform: none;
  }

  38% {
    transform: translateY(-0.6px) rotate(-1.8deg);
  }

  70% {
    transform: rotate(1deg);
  }
}

@keyframes kit-bot-blink {
  0%,
  90%,
  100% {
    transform: scaleY(1);
  }

  93%,
  95% {
    transform: scaleY(0.06);
  }

  97% {
    transform: scaleY(1);
  }
}

@keyframes kit-bot-slow-blink {
  0%,
  84%,
  100% {
    transform: scaleY(1);
  }

  89%,
  94% {
    transform: scaleY(0.14);
  }

  98% {
    transform: scaleY(1);
  }
}

@keyframes kit-bot-think-head {
  0%,
  100% {
    transform: translateY(-0.9px) rotate(-10deg);
  }

  50% {
    transform: translateY(0) rotate(-4.5deg);
  }
}

@keyframes kit-bot-think-sway {
  0%,
  100% {
    transform: rotate(-1.4deg);
  }

  50% {
    transform: rotate(1.4deg);
  }
}

@keyframes kit-bot-think-gaze {
  0%,
  100% {
    transform: translate(0.3px, -0.5px);
  }

  50% {
    transform: translate(-0.3px, -0.65px);
  }
}

@keyframes kit-bot-talk {
  0%,
  22%,
  46%,
  72%,
  100% {
    transform: none;
  }

  10% {
    transform: translateY(1.2px) rotate(13deg);
  }

  34% {
    transform: translateY(0.7px) rotate(8deg);
  }

  58% {
    transform: translateY(1.3px) rotate(14deg);
  }
}

@keyframes kit-bot-reply-head {
  0%,
  80%,
  100% {
    transform: none;
  }

  12% {
    transform: translateY(-0.9px) rotate(-3deg);
  }

  36% {
    transform: translateY(0.2px) rotate(0.8deg);
  }

  60% {
    transform: translateY(-0.7px) rotate(-2.2deg);
  }
}

@keyframes kit-bot-wing-flick {
  0%,
  70%,
  100% {
    transform: none;
  }

  80% {
    transform: rotate(-12deg) translateY(-0.7px);
  }

  90% {
    transform: rotate(-3deg);
  }
}

@keyframes kit-bot-flap {
  0%,
  100% {
    transform: rotate(0);
  }

  50% {
    transform: rotate(-18deg) translateY(-1px);
  }
}

@keyframes kit-bot-work-bob {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-0.8px);
  }
}

@keyframes kit-bot-greet-head {
  0%,
  100% {
    transform: none;
  }

  22% {
    transform: translateY(-1.4px) rotate(-5deg);
  }

  46% {
    transform: translateY(1px) rotate(4.5deg);
  }

  70% {
    transform: translateY(-0.6px) rotate(-2deg);
  }
}

@keyframes kit-bot-greet-wing {
  0%,
  100% {
    transform: none;
  }

  20% {
    transform: rotate(-30deg);
  }

  40% {
    transform: rotate(-14deg);
  }

  60% {
    transform: rotate(-28deg);
  }

  80% {
    transform: rotate(-8deg);
  }
}

@keyframes kit-bot-greet-hop {
  0%,
  55%,
  100% {
    transform: translateY(0);
  }

  30% {
    transform: translateY(-1.6px);
  }
}

@keyframes kit-bot-listen-head {
  0%,
  100% {
    transform: translateY(0.9px) rotate(5deg);
  }

  50% {
    transform: translateY(0.5px) rotate(3deg);
  }
}

@keyframes kit-bot-listen-lean {
  0%,
  100% {
    transform: translateX(0.5px) rotate(1.4deg);
  }

  50% {
    transform: translateX(0.2px) rotate(0.5deg);
  }
}

@keyframes kit-bot-listen-gaze {
  0%,
  100% {
    transform: translate(0.5px, 0.25px);
  }

  50% {
    transform: translate(0.65px, 0.1px);
  }
}

@keyframes kit-bot-celebrate-hop {
  0%,
  42%,
  80%,
  100% {
    transform: translateY(0);
  }

  20% {
    transform: translateY(-3px) scale(1.02, 0.98);
  }

  60% {
    transform: translateY(-1.5px);
  }
}

@keyframes kit-bot-celebrate-wing {
  0%,
  100% {
    transform: none;
  }

  25% {
    transform: rotate(-34deg);
  }

  50% {
    transform: rotate(-12deg);
  }

  75% {
    transform: rotate(-28deg);
  }
}

@keyframes kit-bot-celebrate-head {
  0%,
  100% {
    transform: none;
  }

  30% {
    transform: translateY(-0.6px) rotate(-7deg);
  }

  65% {
    transform: rotate(2deg);
  }
}

@keyframes kit-bot-error-head {
  0%,
  100% {
    transform: translateY(0.4px) rotate(10deg);
  }

  50% {
    transform: rotate(-4deg);
  }
}

@keyframes kit-bot-error-sway {
  0%,
  100% {
    transform: rotate(-0.8deg);
  }

  50% {
    transform: rotate(0.8deg);
  }
}

@keyframes kit-bot-sleep-breathe {
  0%,
  100% {
    transform: scale(1, 1);
  }

  50% {
    transform: scale(1.022, 0.978) translateY(0.7px);
  }
}

@keyframes kit-bot-sleep-head {
  0%,
  100% {
    transform: translateY(0.5px) rotate(3deg);
  }

  50% {
    transform: translateY(1.1px) rotate(4.5deg);
  }
}

/*
 * Reduced motion: nothing moves, but a state that means something still
 * looks like it — the thinker keeps its bill up, the sleeper stays shut.
 * Two classes deep so these win over the state rules above.
 */
@media (prefers-reduced-motion: reduce) {
  .kit-bot-avatar .kit-bot-avatar__mark-motion,
  .kit-bot-avatar .kit-bot-avatar__head-motion,
  .kit-bot-avatar .kit-bot-avatar__jaw-motion,
  .kit-bot-avatar .kit-bot-avatar__wing-motion,
  .kit-bot-avatar .kit-bot-avatar__eye-motion,
  .kit-bot-avatar .kit-bot-avatar__gaze {
    animation: none;
    transform: none;
  }

  .kit-bot-avatar--think .kit-bot-avatar__head-motion {
    transform: translateY(-0.9px) rotate(-8deg);
  }

  .kit-bot-avatar--listen .kit-bot-avatar__head-motion,
  .kit-bot-avatar--sleep .kit-bot-avatar__head-motion {
    transform: translateY(0.9px) rotate(4.5deg);
  }

  .kit-bot-avatar--error .kit-bot-avatar__head-motion {
    transform: translateY(0.4px) rotate(10deg);
  }

  .kit-bot-avatar--sleep .kit-bot-avatar__eye-motion {
    transform: scaleY(0.16);
  }
}
</style>
