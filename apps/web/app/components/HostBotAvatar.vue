<template>
  <span
    class="avatar"
    :class="size"
    :style="{ background: fill }"
    aria-hidden="true"
  >{{ letters }}</span>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  name: string
  seed?: string
  size?: 'sm' | 'md'
  color?: string
}>(), {
  seed: '',
  size: 'md',
  color: '',
})

const letters = computed(() => initialsFromName(props.name))
const fill = computed(() => props.color || avatarColor(props.seed || props.name))
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
