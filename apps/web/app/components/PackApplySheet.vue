<template>
  <div class="pack-apply">
    <p
      v-if="pack"
      class="id"
    >
      {{ pack.manifest.id }}@{{ pack.manifest.version }}
    </p>
    <p
      v-if="plan?.engine.severity === 'warn'"
      class="warn"
    >
      {{ plan.engine.message || $t('pack.engineWarn', { range: plan.engine.range }) }}
    </p>
    <p
      v-if="plan && plan.blockers.length > 0"
      class="error"
    >
      {{ plan.blockers[0] }}
    </p>
    <fieldset
      v-if="plan && plan.blockers.length === 0"
      class="targets"
    >
      <legend>{{ $t('pack.target') }}</legend>
      <label>
        <input
          v-model="target"
          type="radio"
          value="update"
          :disabled="!canUpdate"
        >
        <span>{{ $t('pack.targetThis') }}</span>
      </label>
      <label>
        <input
          v-model="target"
          type="radio"
          value="create"
        >
        <span>{{ $t('pack.targetNew') }}</span>
      </label>
    </fieldset>
    <section
      v-if="plan"
      class="block"
    >
      <h3>{{ $t('pack.skills') }}</h3>
      <ul>
        <li
          v-for="row in plan.skills"
          :key="`${row.action}-${row.id}`"
        >
          {{ row.action }} · {{ row.id }}
        </li>
      </ul>
    </section>
    <section
      v-if="plan && plan.schedules.length > 0"
      class="block"
    >
      <h3>{{ $t('pack.schedules') }}</h3>
      <ul>
        <li
          v-for="row in plan.schedules"
          :key="`${row.name}-${row.timeLocal}`"
        >
          {{ row.name || row.timeLocal }} · {{ row.cadence }}
        </li>
      </ul>
    </section>
    <p
      v-if="plan?.unboundIntegrations.length"
      class="hint"
    >
      {{ $t('pack.unbound') }}
    </p>
    <p
      v-if="target === 'update'"
      class="hint"
    >
      {{ $t('pack.chatKept') }}
    </p>
    <p
      v-if="error"
      class="error"
    >
      {{ error }}
    </p>
    <div class="actions">
      <KitButton
        type="button"
        variant="ghost"
        :disabled="busy"
        @click="emit('cancel')"
      >
        {{ $t('common.cancel') }}
      </KitButton>
      <KitButton
        type="button"
        :disabled="busy || !plan || plan.blockers.length > 0 || (target === 'update' && !canUpdate)"
        @click="confirm"
      >
        {{ busy ? $t('pack.confirmBusy') : $t('pack.confirm') }}
      </KitButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PackApplyPlan, PackTree } from '@dostigus/shared'
import { KitButton } from '@dostigus/ui-kit'

const props = defineProps<{
  pack: PackTree
  plan: PackApplyPlan
  canUpdate: boolean
  botId: string
}>()

const emit = defineEmits<{
  applied: [botId: string]
  cancel: []
}>()

const { t } = useI18n()
const target = ref<'create' | 'update'>(props.canUpdate ? 'update' : 'create')
const busy = ref(false)
const error = ref('')
const plan = ref(props.plan)

watch(() => props.plan, (next) => {
  plan.value = next
})

watch(target, () => {
  void refreshPlan()
})

async function refreshPlan() {
  error.value = ''
  try {
    const body = await $fetch<{ plan: PackApplyPlan }>('/api/packs/preview', {
      method: 'POST',
      body: {
        pack: props.pack,
        target: target.value,
        botId: target.value === 'update' ? props.botId : undefined,
      },
    })
    plan.value = body.plan
  } catch {
    error.value = t('pack.previewFailed')
  }
}

async function confirm() {
  if (busy.value || !plan.value || plan.value.blockers.length > 0) {
    return
  }
  busy.value = true
  error.value = ''
  try {
    const body = await $fetch<{ bot: { id: string } }>('/api/packs/apply', {
      method: 'POST',
      body: {
        pack: props.pack,
        target: target.value,
        botId: target.value === 'update' ? props.botId : undefined,
      },
    })
    emit('applied', body.bot.id)
  } catch {
    error.value = t('pack.applyFailed')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.pack-apply {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.id {
  margin: 0;
  font-weight: 800;
  word-break: break-all;
}

.targets {
  margin: 0;
  border: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.targets legend {
  padding: 0;
  margin-bottom: 0.35rem;
  color: var(--text-muted);
  font-size: 0.92rem;
  font-weight: 700;
}

.targets label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
}

.block h3 {
  margin: 0 0 0.35rem;
  font-size: 0.92rem;
  color: var(--text-muted);
}

.block ul {
  margin: 0;
  padding-left: 1.1rem;
}

.hint,
.warn,
.error {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.4;
}

.warn,
.error {
  color: var(--accent);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 0.35rem;
}
</style>
