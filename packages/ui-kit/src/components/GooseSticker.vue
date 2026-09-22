<template>
  <img
    class="kit-sticker"
    :class="{ 'kit-sticker--sm': size === 'sm' }"
    :src="src"
    :alt="alt"
    decoding="async"
  >
</template>

<script setup lang="ts">
import type { GooseStickerName } from '../brand'
import { computed } from 'vue'
import { gooseStickerSrc } from '../brand'

const props = withDefaults(defineProps<{
  name: GooseStickerName
  alt?: string
  size?: 'md' | 'sm'
}>(), {
  alt: '',
  size: 'md',
})

const src = computed(() => gooseStickerSrc(props.name))
</script>

<style src="../kit.css"></style>
