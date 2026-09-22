<template>
  <span
    class="frame"
    :class="size"
  >
    <KitBotAvatar
      v-if="shape"
      :shape="shape"
      :color="fill"
      :size="size"
      :state="state"
    />
    <span
      v-else
      class="avatar"
      :class="size"
      :style="{ background: fill }"
      aria-hidden="true"
    >{{ letters }}</span>
    <span
      v-if="live"
      class="live"
      aria-hidden="true"
    />
    <span
      v-if="live"
      class="sr-only"
    >Online</span>
  </span>
</template>

<script setup lang="ts">
import type { BotAvatarShape, BotAvatarState } from '@dostigus/shared'
import { KitBotAvatar } from '@dostigus/ui-kit'

const props = withDefaults(defineProps<{
  name: string
  seed?: string
  size?: 'sm' | 'md' | 'lg'
  /** Initials-mode fill (person button). Ignored when shape is set. */
  color?: string
  shape?: BotAvatarShape | ''
  avatarColor?: string
  /** Bot mark motion. Sidebar rows rest on idle; Chat drives the flock states. */
  state?: BotAvatarState
  /** Green live dot while this Bot is busy. */
  live?: boolean
}>(), {
  seed: '',
  size: 'md',
  color: '',
  shape: '',
  avatarColor: '',
  state: 'idle',
  live: false,
})

const letters = computed(() => initialsFromName(props.name))
const fill = computed(() => {
  if (props.shape) {
    return props.avatarColor || props.color
  }
  return props.color || avatarColor(props.seed || props.name)
})
</script>

<style scoped>
.frame {
  position: relative;
  display: inline-flex;
  flex: none;
  line-height: 0;
}

.avatar {
  display: inline-grid;
  place-items: center;
  flex: none;
  border-radius: 999px;
  color: var(--accent-ink);
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
  user-select: none;
}

.avatar.md {
  width: 2.4rem;
  height: 2.4rem;
  font-size: 0.78rem;
}

.avatar.sm {
  width: 1.7rem;
  height: 1.7rem;
  font-size: 0.62rem;
}

.avatar.lg {
  width: 3.4rem;
  height: 3.4rem;
  font-size: 1rem;
}

.live {
  position: absolute;
  z-index: 1;
  right: 0;
  bottom: 0;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: var(--live, #3ddc84);
  box-shadow: 0 0 0 2px var(--avatar-ring, var(--bg));
  pointer-events: none;
}

.frame.sm .live {
  width: 0.42rem;
  height: 0.42rem;
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
