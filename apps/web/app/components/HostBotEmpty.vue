<template>
  <div class="empty">
    <GooseSticker
      class="sticker"
      name="wave"
      size="md"
      alt=""
    />
    <p class="kicker">
      {{ $t('host.empty.title') }}
    </p>
    <h1>{{ $t('host.empty.none') }}</h1>
    <p class="hint">
      <template v-if="isOwner">
        {{ $t('host.empty.ownerHint') }}
      </template>
      <template v-else>
        {{ $t('host.empty.memberHint') }}
      </template>
    </p>
    <div class="actions">
      <KitButton
        v-if="isOwner"
        type="button"
        @click="openCreate"
      >
        {{ $t('host.empty.createBot') }}
      </KitButton>
      <KitButton
        type="button"
        variant="ghost"
        @click="openThreadCreate('room')"
      >
        {{ $t('host.empty.createGroup') }}
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
