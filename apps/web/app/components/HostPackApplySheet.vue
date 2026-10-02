<template>
  <KitSheet
    v-model:open="sheetOpen"
    edge="end"
    :title="$t('pack.previewTitle')"
    title-align="center"
    close="icon"
  >
    <div class="host-pack-apply">
      <p
        v-if="previewing"
        class="status"
      >
        {{ $t('common.loading') }}
      </p>
      <p
        v-else-if="error"
        class="error"
        role="alert"
      >
        {{ error }}
      </p>
      <PackApplySheet
        v-else-if="pack && plan"
        :pack="pack"
        :plan="plan"
        :can-update="false"
        bot-id=""
        @applied="onApplied"
        @cancel="close"
      />
    </div>
  </KitSheet>
</template>

<script setup lang="ts">
import { KitSheet } from '@dostigus/ui-kit'

const { open, previewing, error, pack, plan, close } = useHostPackApply()
const router = useRouter()

const sheetOpen = computed({
  get: () => open.value,
  set: (value) => {
    if (!value) {
      close()
    }
  },
})

async function onApplied(botId: string) {
  close()
  await router.push(`/bots/${botId}`)
}
</script>

<style scoped>
.host-pack-apply {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.status {
  margin: 0;
  color: var(--text-muted);
}

.error {
  margin: 0;
  color: var(--accent);
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.45;
}
</style>
