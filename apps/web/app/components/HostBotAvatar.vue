<template>
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
</template>

<script setup lang="ts">
import type { BotAvatarShape, BotAvatarState } from '@dostigus/shared'
import { KitBotAvatar } from '@dostigus/ui-kit'

const props = withDefaults(defineProps<{
  name: string
  seed?: string
  size?: 'sm' | 'md'
  /** Initials-mode fill (person button). Ignored when shape is set. */
  color?: string
  shape?: BotAvatarShape | ''
  avatarColor?: string
  /** Goose mark motion; Host list/header use idle. */
  state?: BotAvatarState
}>(), {
  seed: '',
  size: 'md',
  color: '',
  shape: '',
  avatarColor: '',
  state: 'idle',
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

.md {
  width: 2.4rem;
  height: 2.4rem;
  font-size: 0.78rem;
}

.sm {
  width: 1.7rem;
  height: 1.7rem;
  font-size: 0.62rem;
}
</style>
