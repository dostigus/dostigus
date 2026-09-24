<template>
  <span class="row">
    <span
      v-if="kind === 'typing'"
      class="wave"
      aria-hidden="true"
    >
      <span />
      <span />
      <span />
    </span>
    <span
      v-else-if="kind === 'tool'"
      class="cluster"
      aria-hidden="true"
    >
      <span />
      <span />
      <span />
      <span />
      <span />
    </span>
    <span
      v-else
      class="mark"
      :class="kind === 'thinking' ? 'think' : 'connect'"
      aria-hidden="true"
    >
      <HostBotAvatar
        :name="name"
        :seed="seed"
        :shape="shape"
        :avatar-color="avatarColor"
        :state="kind === 'thinking' ? 'think' : 'idle'"
        size="sm"
      />
    </span>
    <span class="label">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
import type { BotAvatarShape } from '@dostigus/shared'
import type { ChatActivityKindShown } from '../utils/chat-activity'

withDefaults(defineProps<{
  kind: ChatActivityKindShown
  label: string
  name?: string
  seed?: string
  shape?: BotAvatarShape | ''
  avatarColor?: string
}>(), {
  name: 'Bot',
  seed: '',
  shape: '',
  avatarColor: '',
})
</script>

<style scoped>
.row {
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 1.7rem;
  color: var(--text-muted);
  font-family: Nunito, ui-sans-serif, system-ui, sans-serif;
  font-size: 0.98rem;
  font-weight: 400;
  line-height: 1.2;
}

.label {
  display: inline-block;
  color: transparent;
  background-color: var(--text-muted);
  background-image: linear-gradient(
    100deg,
    transparent 0%,
    transparent 34%,
    color-mix(in srgb, var(--text) 18%, transparent) 41%,
    color-mix(in srgb, var(--text) 52%, transparent) 47%,
    color-mix(in srgb, var(--text) 62%, transparent) 50%,
    color-mix(in srgb, var(--text) 52%, transparent) 53%,
    color-mix(in srgb, var(--text) 18%, transparent) 59%,
    transparent 66%,
    transparent 100%
  );
  /*
   * One tile is 3x the label. At size 300%, position p offsets the tile by
   * -2p label widths, so 150% -> 0% moves it exactly one tile: the first and
   * last frames match and the loop has no seam. The band sits in the middle
   * third, so a gap of plain muted text trails each pass.
   */
  background-size: 300% 100%;
  background-repeat: repeat-x;
  background-position: 150% 50%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: activity-label-shimmer 2.4s linear infinite;
}

.wave,
.cluster,
.mark {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
}

.wave {
  gap: 0.28rem;
  height: 1.15rem;
}

.wave span {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: var(--live, #3ddc84);
  animation: wave 1.05s ease-in-out infinite;
}

.wave span:nth-child(2) {
  animation-delay: 0.16s;
}

.wave span:nth-child(3) {
  animation-delay: 0.32s;
}

.cluster {
  position: relative;
  width: 1.15rem;
  height: 1.15rem;
}

.cluster span {
  position: absolute;
  border-radius: 999px;
  background: #ff7a1a;
  animation: cluster 1.15s ease-in-out infinite;
}

.cluster span:nth-child(1) {
  left: 0.02rem;
  top: 0.38rem;
  width: 0.32rem;
  height: 0.32rem;
}

.cluster span:nth-child(2) {
  left: 0.34rem;
  top: 0.05rem;
  width: 0.26rem;
  height: 0.26rem;
  animation-delay: 0.12s;
}

.cluster span:nth-child(3) {
  left: 0.62rem;
  top: 0.34rem;
  width: 0.28rem;
  height: 0.28rem;
  animation-delay: 0.24s;
}

.cluster span:nth-child(4) {
  left: 0.28rem;
  top: 0.58rem;
  width: 0.2rem;
  height: 0.2rem;
  animation-delay: 0.36s;
}

.cluster span:nth-child(5) {
  left: 0.72rem;
  top: 0.08rem;
  width: 0.16rem;
  height: 0.16rem;
  animation-delay: 0.48s;
}

.mark.connect {
  animation: connect 1.6s ease-in-out infinite;
}

@keyframes wave {
  0%,
  70%,
  100% {
    transform: translateY(0);
    opacity: 0.35;
  }

  35% {
    transform: translateY(-0.16rem);
    opacity: 1;
  }
}

@keyframes cluster {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.8);
  }

  45% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes connect {
  0%,
  100% {
    opacity: 0.72;
    transform: scale(0.96);
  }

  50% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes activity-label-shimmer {
  0% {
    background-position: 150% 50%;
  }

  100% {
    background-position: 0% 50%;
  }
}

@keyframes activity-label-pulse {
  0%,
  100% {
    opacity: 0.62;
  }

  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wave span,
  .cluster span,
  .mark.connect {
    animation: none;
  }

  .wave span,
  .cluster span {
    opacity: 0.9;
    transform: none;
  }

  .label {
    animation: activity-label-pulse 2.6s ease-in-out infinite;
    background-image: none;
    background-color: transparent;
    background-clip: border-box;
    -webkit-background-clip: border-box;
    color: var(--text-muted);
    -webkit-text-fill-color: currentcolor;
  }
}
</style>
