<template>
  <KitMenu
    v-model:open="open"
    :side="rail ? 'right' : 'bottom'"
    :align="rail ? 'end' : 'start'"
    @close-auto-focus="onCloseAutoFocus"
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
const { open: createOpen, openCreate, closeCreate } = useHostCreate()
const { open: threadOpen, openThreadCreate, closeThreadCreate } = useHostThreadCreate()
const { openMemberAdd, closeMemberAdd } = useHostMemberAdd()

watch(() => route.fullPath, () => {
  closePlusMenu()
})

/**
 * The modal menu traps focus until it unmounts, so a pane opened from
 * `select` loses the focus it takes on mount. Open the Bot picker or the
 * thread composer once the menu has closed. Returns true when a pane mounts.
 */
let openPane: (() => boolean) | null = null

function onFindBot() {
  openPane = () => {
    const mounts = !createOpen.value || threadOpen.value
    closeThreadCreate()
    closeMemberAdd()
    openCreate()
    return mounts
  }
}

function onThread(kind: MessengerThreadKind) {
  openPane = () => {
    const mounts = !threadOpen.value
    closeCreate()
    closeMemberAdd()
    openThreadCreate(kind)
    return mounts
  }
}

function onCloseAutoFocus(event: Event) {
  const run = openPane
  openPane = null
  if (run?.()) {
    event.preventDefault()
  }
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
