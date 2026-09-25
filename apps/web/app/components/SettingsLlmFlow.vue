<template>
  <section
    class="flow"
    aria-labelledby="llm-flow-title"
  >
    <p class="kicker">
      {{ $t('settings.providers.flow.how') }}
    </p>
    <h2 id="llm-flow-title">
      {{ $t('settings.providers.flow.botsThink') }}
    </h2>
    <p class="lead">
      {{ $t('settings.providers.flow.lead') }}
    </p>

    <div class="node bots-node">
      <div
        v-if="bots.length > 0"
        class="stack"
        aria-hidden="true"
      >
        <HostBotAvatar
          v-for="bot in shownBots"
          :key="bot.id"
          class="stacked"
          size="sm"
          :name="bot.name"
          :seed="bot.id"
          :shape="bot.manifest.avatarShape"
          :avatar-color="bot.manifest.avatarColor"
        />
      </div>
      <div class="node-copy">
        <p class="node-title">
          {{ botsTitle }}
        </p>
        <p class="node-detail">
          {{ bots.length > 0 ? botNames : $t('settings.providers.flow.newBotsJoin') }}
        </p>
      </div>
    </div>

    <div
      class="wire"
      aria-hidden="true"
    />

    <ol
      class="tiers"
      :aria-label="$t('settings.providers.flow.tiersAria')"
    >
      <li
        v-for="row in rows"
        :key="row.tier"
        class="tier"
        :class="{ off: !row.bind, escalate: row.tier === 'code', toy: row.tier === 'toy' }"
      >
        <span
          class="dot"
          :class="row.state"
          aria-hidden="true"
        />
        <div class="tier-copy">
          <p class="tier-title">
            {{ row.title }}
            <code>{{ row.tier }}</code>
          </p>
          <p class="tier-detail">
            {{ row.detail }}
          </p>
          <p
            class="tier-bind"
            :class="{ none: !row.bind, pinned: row.bind?.pinned }"
            :title="row.bind ? bindTitle(row.bind) : undefined"
          >
            <template v-if="row.bind">
              <span class="bind-provider">{{ row.bind.provider }}</span>
              <span class="bind-policy">{{ row.bind.policy }}</span>
            </template>
            <template v-else>
              {{ $t('settings.providers.unset') }}
            </template>
          </p>
        </div>
      </li>
    </ol>

    <div
      class="wire"
      aria-hidden="true"
    />

    <div
      class="node provider-node"
      :class="{ empty: providerLabels.length === 0 }"
    >
      <span
        class="plug"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24">
          <path d="M9 3.5v4M15 3.5v4M7 7.5h10v3.2a5 5 0 0 1-10 0zM12 15.7v4.8" />
        </svg>
      </span>
      <div class="node-copy">
        <p class="node-title">
          {{ providerLabels.length > 0 ? providerLabels.join(' + ') : $t('settings.providers.flow.noProvider') }}
        </p>
        <p class="node-detail">
          {{ providerLabels.length > 0 ? 'Provider' : $t('settings.providers.flow.noKeyQuiet') }}
        </p>
      </div>
    </div>

    <p class="foot">
      {{ $t('settings.providers.flow.escalateChain') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import type { BotListItem, LlmProviderKind, LlmTierBind, ModelTier } from '@dostigus/shared'
import { LLM_PROVIDER_KIND_LABELS } from '@dostigus/shared'
import { bindCopy, tierSituations } from '../utils/provider-settings'

const props = defineProps<{
  bots: BotListItem[]
  providers: Array<{ id: string, kind: LlmProviderKind, hasApiKey: boolean }>
  tierBinds: Partial<Record<ModelTier, LlmTierBind>>
  names: Record<string, string>
  /** Providers whose key the soft probe saw rejected. */
  rejected?: string[]
}>()

const { locale, t } = useI18n()
const hostLocale = computed(() => locale.value === 'ru' ? 'ru' as const : 'en' as const)
const TIER_SITUATIONS = computed(() => tierSituations(hostLocale.value))

const shownBots = computed(() => props.bots.slice(0, 5))

const botsTitle = computed(() => {
  const count = props.bots.length
  if (count === 0) {
    return t('settings.providers.flow.noBots')
  }
  return t('settings.providers.flow.botsOnHost', { count })
})

const botNames = computed(() => {
  const names = props.bots.slice(0, 3).map((bot) => bot.name)
  const rest = props.bots.length - names.length
  return rest > 0 ? `${names.join(', ')} ${t('settings.providers.flow.andMore', { count: rest })}` : names.join(', ')
})

const rows = computed(() => TIER_SITUATIONS.value.map((situation) => {
  const bind = props.tierBinds[situation.tier]
  const provider = props.providers.find((entry) => entry.id === bind?.providerId)
  const rejected = Boolean(provider && props.rejected?.includes(provider.id))
  return {
    ...situation,
    bind: bindCopy(bind, props.providers, props.names),
    state: !bind || !provider?.hasApiKey ? 'idle' : rejected ? 'bad' : 'ready',
  }
}))

function bindTitle(bind: { provider: string, policy: string, pinned: boolean }): string {
  return bind.pinned
    ? t('settings.providers.flow.pinnedBind', bind)
    : t('settings.providers.flow.routingBind', bind)
}

const providerLabels = computed(() => {
  const labels = props.providers
    .filter((provider) => provider.hasApiKey)
    .map((provider) => LLM_PROVIDER_KIND_LABELS[provider.kind])
  return [...new Set(labels)]
})
</script>

<style scoped>
.flow {
  padding: 1.35rem 1.3rem 1.25rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--card);
}

.kicker {
  margin: 0 0 0.4rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.7rem;
  color: var(--accent);
}

h2 {
  margin: 0 0 0.4rem;
  font-size: 1.15rem;
}

.lead {
  margin: 0 0 1.2rem;
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.node {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--line);
  border-radius: 1.1rem;
  background: var(--bg);
}

.stack {
  display: flex;
  flex: none;
  padding-left: 0.35rem;
}

.stacked {
  margin-left: -0.45rem;
  border-radius: 999px;
  box-shadow: 0 0 0 2px var(--bg);
}

.node-copy {
  min-width: 0;
}

.node-title {
  margin: 0;
  font-weight: 700;
  font-size: 0.92rem;
}

.node-detail {
  margin: 0.1rem 0 0;
  color: var(--text-muted);
  font-size: 0.8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wire {
  width: 2px;
  height: 1.1rem;
  margin-left: 1.55rem;
  background: linear-gradient(var(--line), color-mix(in srgb, var(--text) 30%, var(--line)));
}

.tiers {
  list-style: none;
  margin: 0;
  padding: 0.35rem 0;
  border: 1px solid var(--line);
  border-radius: 1.1rem;
  background: var(--bg);
}

.tier {
  display: flex;
  gap: 0.75rem;
  padding: 0.6rem 0.85rem;
}

.tier + .tier {
  border-top: 1px solid var(--line-soft);
}

.tier.toy {
  opacity: 0.72;
}

.dot {
  flex: none;
  width: 0.6rem;
  height: 0.6rem;
  margin-top: 0.42rem;
  margin-left: 0.3rem;
  border-radius: 999px;
}

.dot.ready {
  background: var(--live);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--live) 22%, transparent);
}

.dot.idle {
  border: 1.5px solid var(--text-muted);
}

.dot.bad {
  background: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
}

.tier-copy {
  min-width: 0;
  flex: 1;
}

.tier-title {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  font-weight: 700;
  font-size: 0.9rem;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  font-weight: 500;
  padding: 0.05rem 0.4rem;
  border-radius: 0.4rem;
  background: color-mix(in srgb, var(--text) 8%, transparent);
  color: var(--text-muted);
}

.tier-detail {
  margin: 0.1rem 0 0.3rem;
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.4;
}

.tier-bind {
  margin: 0;
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--live) 30%, var(--line));
  background: color-mix(in srgb, var(--live) 8%, transparent);
  font-size: 0.76rem;
  overflow: hidden;
}

.bind-provider,
.bind-policy {
  padding: 0.1rem 0.5rem;
  white-space: nowrap;
}

.bind-provider {
  flex: none;
  color: var(--text-muted);
  border-right: 1px solid color-mix(in srgb, var(--live) 25%, var(--line));
}

.bind-policy {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: color-mix(in srgb, var(--live) 70%, var(--text));
}

.tier-bind.pinned {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--line));
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.tier-bind.pinned .bind-provider {
  border-right-color: color-mix(in srgb, var(--accent) 30%, var(--line));
}

.tier-bind.pinned .bind-policy {
  color: color-mix(in srgb, var(--accent) 55%, var(--text));
}

.tier-bind.none {
  padding: 0.1rem 0.55rem;
  border-style: dashed;
  border-color: var(--line);
  background: transparent;
  color: var(--text-muted);
}

.plug {
  display: grid;
  place-items: center;
  flex: none;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--live) 18%, var(--surface));
  color: var(--live);
}

.provider-node.empty .plug {
  background: var(--surface);
  color: var(--text-muted);
}

.plug svg {
  width: 1.05rem;
  height: 1.05rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.foot {
  margin: 1rem 0 0;
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.6;
}
</style>
