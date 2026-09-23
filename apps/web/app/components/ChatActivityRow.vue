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
      v-else-if="kind === 'command'"
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
      aria-hidden="true"
    >
      <HostBotAvatar
        :name="name"
        :seed="seed"
        :shape="shape"
        :avatar-color="avatarColor"
        state="idle"
        size="sm"
      />
    </span>
    <span class="label">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
import type { BotAvatarShape } from '@dostigus/shared'
import type { ChatActivityKind } from '../utils/chat-activity'

withDefaults(defineProps<{
  kind: ChatActivityKind
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
  color: var(--text-muted);
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

.mark {
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

@media (prefers-reduced-motion: reduce) {
  .wave span,
  .cluster span,
  .mark {
    animation: none;
  }

  .wave span,
  .cluster span {
    opacity: 0.9;
    transform: none;
  }
}
</style>
