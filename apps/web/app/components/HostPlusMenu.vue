<template>
  <KitMenu
    v-model:open="open"
    :side="rail ? 'right' : 'bottom'"
    :align="rail ? 'end' : 'start'"
  >
    <template #trigger>
      <button
        type="button"
        class="chrome"
        :aria-label="$t('host.plus.aria')"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M12 5.5v13M5.5 12h13" />
        </svg>
      </button>
    </template>
    <KitMenuItem
      :hint="$t('host.plus.botList')"
      @select="onFindBot"
    >
      {{ $t('host.plus.findOrCreateBot') }}
    </KitMenuItem>
    <KitMenuItem
      :hint="$t('host.plus.onePerson')"
      @select="onThread('dm')"
    >
      {{ $t('host.plus.writeDm') }}
    </KitMenuItem>
    <KitMenuItem
      :hint="$t('host.plus.peopleOptionalBot')"
      @select="onThread('room')"
    >
      {{ $t('host.plus.createGroup') }}
    </KitMenuItem>
    <KitMenuItem
      v-if="isOwner"
      :hint="$t('host.plus.inviteOrPassword')"
      @select="onMember"
    >
      {{ $t('host.plus.addMember') }}
    </KitMenuItem>
  </KitMenu>
</template>

<script setup lang="ts">
import type { MessengerThreadKind } from '@dostigus/shared'
import { KitMenu, KitMenuItem } from '@dostigus/ui-kit'

defineProps<{
  rail?: boolean
}>()

const route = useRoute()
const { isOwner } = useHostAccount()
const { open, closePlusMenu } = useHostPlusMenu()
const { openCreate, closeCreate } = useHostCreate()
const { openThreadCreate, closeThreadCreate } = useHostThreadCreate()
const { openMemberAdd, closeMemberAdd } = useHostMemberAdd()

watch(() => route.fullPath, () => {
  closePlusMenu()
})

function onFindBot() {
  closeThreadCreate()
  closeMemberAdd()
  openCreate()
}

function onThread(kind: MessengerThreadKind) {
  closeCreate()
  closeMemberAdd()
  openThreadCreate(kind)
}

function onMember() {
  closeCreate()
  closeThreadCreate()
  openMemberAdd()
}
</script>

<style scoped>
.chrome {
  appearance: none;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  padding: 0;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.chrome svg {
  width: 1.05rem;
  height: 1.05rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.chrome:hover,
.chrome[aria-expanded='true'] {
  border-color: color-mix(in srgb, var(--text) 28%, var(--line));
}

.chrome:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
