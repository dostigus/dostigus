<template>
  <div
    class="user"
    :class="{ collapsed }"
  >
    <KitMenu
      :side="menuSide"
      :align="menuSide === 'bottom' ? 'end' : 'start'"
    >
      <template #trigger>
        <button
          type="button"
          class="user-btn"
          :aria-label="$t('host.menu.accountAria', { name: label })"
        >
          <HostBotAvatar
            :name="label"
            color="var(--surface)"
            :size="collapsed ? 'sm' : 'md'"
          />
          <span
            v-if="!collapsed"
            class="user-name"
          >{{ label }}</span>
        </button>
      </template>
      <KitMenuItem
        v-if="isOwner && !hideSettings"
        :as="NuxtLink"
        to="/dashboard/settings"
        @select="close()"
      >
        {{ $t('host.menu.settings') }}
      </KitMenuItem>
      <KitMenuItem
        v-if="(isOwner || isAdmin) && !hideMembers"
        :as="NuxtLink"
        to="/dashboard/members"
        @select="close()"
      >
        {{ $t('host.menu.members') }}
      </KitMenuItem>
      <KitMenuSeparator v-if="(isOwner && !(hideSettings && hideMembers)) || (isAdmin && !hideMembers)" />
      <KitMenuItem
        :disabled="busy"
        @select="onLogout"
      >
        {{ busy ? $t('host.logout.busy') : $t('host.logout.action') }}
      </KitMenuItem>
    </KitMenu>
  </div>
</template>

<script setup lang="ts">
import { NuxtLink } from '#components'
import { KitMenu, KitMenuItem, KitMenuSeparator } from '@dostigus/ui-kit'

withDefaults(defineProps<{
  collapsed?: boolean
  hideSettings?: boolean
  hideMembers?: boolean
  /** The Dashboard stacked nav puts the button at the top, so it opens down. */
  menuSide?: 'top' | 'bottom'
}>(), {
  menuSide: 'top',
})

const { user, isOwner, isAdmin } = useHostAccount()
const { close } = useHostNav()
const { busy, logout } = useHostLogout()

const { t } = useI18n()
const label = computed(() => user.value?.displayName?.trim() || t('host.menu.account'))

function onLogout(event: Event) {
  event.preventDefault()
  void logout()
}
</script>

<style scoped>
.user-btn {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  min-width: 0;
  appearance: none;
  border: 0;
  border-radius: var(--radius);
  padding: 0.35rem 0.45rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.user-btn:hover,
.user-btn[aria-expanded='true'] {
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

.user-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.user:not(.collapsed) :deep(.avatar) {
  width: 2rem;
  height: 2rem;
  font-size: 0.68rem;
}

.user-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 400;
  font-size: 0.86rem;
  color: var(--text-muted);
}

.user.collapsed .user-btn {
  justify-content: center;
  padding: 0.25rem;
}
</style>
