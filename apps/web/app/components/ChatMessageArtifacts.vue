<template>
  <ul
    v-if="artifacts.length"
    class="artifacts"
  >
    <li
      v-for="item in artifacts"
      :key="item.id"
    >
      <a
        v-if="isImageArtifactMime(item.mime)"
        class="thumb"
        :href="href(item.id)"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          :src="href(item.id)"
          :alt="item.filename"
        >
      </a>
      <a
        v-else
        class="chip"
        :href="href(item.id, true)"
      >
        <span class="name">{{ item.filename }}</span>
        <span class="meta">{{ formatArtifactBytes(item.byteSize) }}</span>
      </a>
    </li>
  </ul>
</template>

<script setup lang="ts">
import type { Artifact } from '@dostigus/shared'
import { formatArtifactBytes, isImageArtifactMime } from '@dostigus/shared'

defineProps<{
  artifacts: Artifact[]
}>()

function href(id: string, download = false) {
  return download ? `/api/artifacts/${id}?download=1` : `/api/artifacts/${id}`
}
</script>

<style scoped>
.artifacts {
  list-style: none;
  margin: 0.45rem 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.thumb {
  display: block;
  overflow: hidden;
  border-radius: var(--radius);
  border: 1px solid var(--line);
  max-width: 12rem;
}

.thumb img {
  display: block;
  width: 100%;
  max-height: 10rem;
  object-fit: cover;
}

.chip {
  display: inline-flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  max-width: 12rem;
  padding: 0.4rem 0.65rem;
  border-radius: var(--radius);
  border: 1px solid var(--line);
  background: color-mix(in srgb, var(--text) 6%, var(--surface));
  color: inherit;
  text-decoration: none;
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.88rem;
}

.meta {
  color: var(--text-muted);
  font-size: 0.75rem;
}
</style>
