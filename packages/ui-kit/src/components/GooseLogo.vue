<template>
  <img
    class="kit-logo"
    :class="{ 'kit-logo--banner': mark === 'banner' }"
    :src="src"
    :alt="alt"
    decoding="async"
  >
</template>

<script setup lang="ts">
import type { GooseLogoMark } from '../brand'
import { computed } from 'vue'
import { gooseLogoSrc } from '../brand'

const props = withDefaults(defineProps<{
  mark?: GooseLogoMark
  alt?: string
}>(), {
  mark: 'logo',
  alt: 'Dostigus',
})

const src = computed(() => gooseLogoSrc(props.mark))
</script>

<style src="../kit.css"></style>
