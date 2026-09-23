<template>
  <div class="empty">
    <GooseSticker
      class="sticker"
      name="wave"
      size="md"
      alt=""
    />
    <p class="kicker">
      Threads
    </p>
    <h1>No Threads yet</h1>
    <p class="hint">
      <template v-if="isOwner">
        Create a Bot and start a Chat. You can tell it what it is for.
      </template>
      <template v-else>
        Threads on this Host show up here. Open a Chat when one is here.
      </template>
    </p>
    <div class="actions">
      <KitButton
        v-if="isOwner"
        type="button"
        @click="openCreate"
      >
        Create a Bot
      </KitButton>
      <KitButton
        type="button"
        variant="ghost"
        @click="openThreadCreate"
      >
        New thread
      </KitButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { GooseSticker, KitButton } from '@dostigus/ui-kit'

const { isOwner } = useHostAccount()
const { openCreate } = useHostCreate()
const { openThreadCreate } = useHostThreadCreate()
</script>

<style scoped>
.empty {
  text-align: center;
}

.sticker {
  margin-bottom: 0.35rem;
}

.kicker {
  margin: 0 0 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  color: var(--accent);
}

h1 {
  margin: 0 0 0.6rem;
  font-size: 1.7rem;
  font-weight: 700;
}

.hint {
  margin: 0 0 1.2rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6rem;
}
</style>
