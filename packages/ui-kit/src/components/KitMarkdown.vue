<template>
  <!-- renderChatMarkdown emits allowlisted tags only (ADR 0022). -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div
    class="kit-markdown"
    v-html="html"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { renderChatMarkdown } from '../markdown'

const props = defineProps<{
  source: string
}>()

const html = computed(() => renderChatMarkdown(props.source))
</script>

<style scoped>
.kit-markdown {
  margin: 0;
  line-height: 1.45;
  white-space: normal;
  overflow-wrap: anywhere;
  overflow-x: auto;
  min-width: 0;
}

.kit-markdown :deep(> :first-child) {
  margin-top: 0;
}

.kit-markdown :deep(> :last-child) {
  margin-bottom: 0;
}

.kit-markdown :deep(p) {
  margin: 0.4rem 0;
}

.kit-markdown :deep(strong) {
  font-weight: 700;
}

.kit-markdown :deep(em) {
  font-style: italic;
}

.kit-markdown :deep(a) {
  color: var(--accent, #f25630);
  text-decoration: underline;
  text-underline-offset: 0.14em;
}

.kit-markdown :deep(a:hover) {
  color: var(--accent-dim, #d94a28);
}

.kit-markdown :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.92em;
  background: color-mix(in srgb, var(--text, #fff) 12%, transparent);
  padding: 0.08em 0.35em;
  border-radius: 0.35rem;
}

.kit-markdown :deep(pre) {
  margin: 0.55rem 0;
  padding: 0.7rem 0.85rem;
  overflow-x: auto;
  background: var(--bg-chat, #000);
  border: 1px solid var(--line, #333);
  border-radius: var(--radius, 0.75rem);
}

.kit-markdown :deep(pre code) {
  background: none;
  padding: 0;
  font-size: 0.84rem;
  white-space: pre;
  border-radius: 0;
}

.kit-markdown :deep(ul),
.kit-markdown :deep(ol) {
  margin: 0.35rem 0;
  padding-left: 1.3rem;
}

.kit-markdown :deep(ul) {
  list-style: disc;
}

.kit-markdown :deep(ol) {
  list-style: decimal;
}

.kit-markdown :deep(li) {
  margin: 0.15rem 0;
}

.kit-markdown :deep(li > p) {
  margin: 0.2rem 0;
}

.kit-markdown :deep(table) {
  margin: 0.45rem 0;
  border-collapse: collapse;
  width: max-content;
  max-width: none;
}

.kit-markdown :deep(th),
.kit-markdown :deep(td) {
  padding: 0.28rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--text, #fff) 16%, transparent);
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
  white-space: normal;
}

.kit-markdown :deep(th) {
  font-weight: 700;
}
</style>
