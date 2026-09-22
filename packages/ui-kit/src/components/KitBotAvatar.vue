<template>
  <span
    class="kit-bot-avatar"
    :class="[`kit-bot-avatar--${size}`, { 'kit-bot-avatar--selected': selected }]"
    :style="{ color: fill }"
    aria-hidden="true"
  >
    <svg
      class="kit-bot-avatar__svg"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        class="kit-bot-avatar__body"
        :d="bodyPath"
      />
      <ellipse
        class="kit-bot-avatar__eye"
        cx="34"
        cy="24"
        rx="3.2"
        ry="4.4"
        transform="rotate(-18 34 24)"
      />
      <ellipse
        class="kit-bot-avatar__eye"
        cx="44"
        cy="22"
        rx="3.2"
        ry="4.4"
        transform="rotate(-18 44 22)"
      />
    </svg>
  </span>
</template>

<script setup lang="ts">
import type { BotAvatarShape } from '@dostigus/shared'
import { DEFAULT_AVATAR_COLOR, DEFAULT_AVATAR_SHAPE, normalizeBotAccentHex } from '@dostigus/shared'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  shape?: BotAvatarShape
  color?: string
  size?: 'sm' | 'md' | 'lg'
  selected?: boolean
}>(), {
  shape: DEFAULT_AVATAR_SHAPE,
  color: DEFAULT_AVATAR_COLOR,
  size: 'md',
  selected: false,
})

const SHAPE_PATHS: Record<BotAvatarShape, string> = {
  circle: 'M32 6a26 26 0 1 1 0 52a26 26 0 1 1 0-52z',
  bean: 'M18 18c-8 6-10 18-4 28c6 10 18 14 28 10c10-4 16-14 14-24c-2-10-10-18-20-20c-8-2-14 0-18 6z',
  squircle: 'M16 10h32c8 0 14 6 14 14v16c0 8-6 14-14 14H16c-8 0-14-6-14-14V24c0-8 6-14 14-14z',
  capsule: 'M18 16h28a16 16 0 0 1 0 32H18a16 16 0 0 1 0-32z',
  triangle: 'M32 8c2.2 0 4.2 1.2 5.2 3.2l18 34c1.1 2.1 0.3 4.6-1.8 5.8c-0.7 0.4-1.5 0.6-2.2 0.6H12.8c-2.4 0-4.4-1.9-4.4-4.4c0-0.7 0.2-1.5 0.6-2.2l18-34C27.8 9.2 29.8 8 32 8z',
  hex: 'M32 6l20 12v28L32 58L12 46V18z',
  cloud: 'M18 28c-6 0-10 4.5-10 10s4 10 10 10h30c7 0 12-5 12-11c0-5.5-4-10-9.2-10.8C49.5 19.5 42 14 33.5 14c-7.2 0-13.4 4-16 9.8C16.8 23.3 17.3 28 18 28z',
  teardrop: 'M32 6c1.4 0 12 14.5 14.8 26.2C49.2 42.5 42.5 52 32 52s-17.2-9.5-14.8-19.8C20 20.5 30.6 6 32 6z',
}

const bodyPath = computed(() => SHAPE_PATHS[props.shape] ?? SHAPE_PATHS[DEFAULT_AVATAR_SHAPE])
const fill = computed(() => normalizeBotAccentHex(props.color) ?? DEFAULT_AVATAR_COLOR)
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

.kit-bot-avatar__body {
  fill: currentColor;
}

.kit-bot-avatar__eye {
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
</style>
