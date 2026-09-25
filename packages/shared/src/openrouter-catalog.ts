/**
 * OpenRouter live catalog for Settings: parse `GET /api/v1/models`, rank the
 * quality shelf, and map shelf picks onto Model tier Policy pins.
 * No model ids are baked here. See ADR 0036 (Settings / OpenRouter catalog).
 */

import type { LlmPolicy, LlmTierBind } from './llm-providers'
import type { ModelTier } from './types'
import { MODEL_TIERS } from './types'

/** Host cache for one Provider's catalog. A Refresh bypasses it. */
export const OPENROUTER_CATALOG_CACHE_MS = 24 * 60 * 60 * 1000

export const OPENROUTER_CATALOG_TIMEOUT_MS = 10_000

/** Cards per shelf slot: the top pick plus runner-ups. */
export const OPENROUTER_SHELF_SIZE = 3

export const OPENROUTER_SHELF_SLOTS = ['free', 'smart', 'coding'] as const

export type OpenRouterShelfSlot = (typeof OPENROUTER_SHELF_SLOTS)[number]

/** Shelf labels are Settings quality slots, not Model tier names. */
export const OPENROUTER_SHELF_LABELS: Record<OpenRouterShelfSlot, string> = {
  free: 'Free',
  smart: 'Smart',
  coding: 'Coding',
}

/** Free → cheap + toy, Smart → strong, Coding → code. Matches the escalate chain. */
export const OPENROUTER_SHELF_TIERS: Record<OpenRouterShelfSlot, readonly ModelTier[]> = {
  free: ['cheap', 'toy'],
  smart: ['strong'],
  coding: ['code'],
}

export type OpenRouterCatalogModel = {
  id: string
  name: string
  contextLength: number | null
  /** USD per 1M prompt tokens. Null when OpenRouter prices the route per call. */
  promptPerM: number | null
  completionPerM: number | null
  free: boolean
  /** From `architecture.modality` (image on the input side). Settings chrome only. */
  vision: boolean
  /** Chat runs the MCP tool loop, so a pin needs `tools` support. */
  tools: boolean
  /** Artificial Analysis indexes as OpenRouter reports them. */
  intelligence: number | null
  coding: number | null
  expiresAt: string | null
  created: number | null
}

export type OpenRouterShelf = Record<OpenRouterShelfSlot, OpenRouterCatalogModel[]>

/** `benchmarks` when OpenRouter reported indexes; `fallback` ranks by recency. */
export type OpenRouterShelfRanking = 'benchmarks' | 'fallback'

export type OpenRouterCatalogError = 'auth' | 'network' | 'empty' | 'no_key' | 'not_openrouter'

/** Owner-session catalog response. Never carries the Provider key. */
export type OpenRouterCatalogPublic = {
  providerId: string
  ok: boolean
  error: OpenRouterCatalogError | null
  /** `true` accepted, `false` rejected, `null` unknown (probe did not answer). */
  keyAccepted: boolean | null
  fetchedAt: string | null
  /** Served from the Host cache after an upstream miss. */
  stale: boolean
  models: OpenRouterCatalogModel[]
  shelf: OpenRouterShelf
  ranking: OpenRouterShelfRanking
}

export type OpenRouterRoutingMode = 'meta' | 'pinned' | 'mixed' | 'none'

export function emptyOpenRouterShelf(): OpenRouterShelf {
  return { free: [], smart: [], coding: [] }
}

/** True when the input side of `text+image->text` lists image. */
export function modalityHasVision(modality: string | null | undefined): boolean {
  if (!modality) {
    return false
  }
  const input = modality.split('->')[0] ?? ''
  return input.split('+').some((part) => part.trim().toLowerCase() === 'image')
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null
}

/** OpenRouter prices per token as strings. Negative means variable (a router). */
function perMillion(value: unknown): number | null {
  const perToken = finiteNumber(value)
  if (perToken == null || perToken < 0) {
    return null
  }
  return Math.round(perToken * 1e6 * 10_000) / 10_000
}

function hasTextOutput(architecture: Record<string, unknown> | null): boolean {
  const outputs = architecture?.output_modalities
  if (Array.isArray(outputs)) {
    return outputs.includes('text')
  }
  const modality = typeof architecture?.modality === 'string' ? architecture.modality : ''
  const output = modality.split('->')[1]
  return output == null || output.split('+').includes('text')
}

function readIndex(benchmarks: Record<string, unknown> | null, key: string): number | null {
  const aa = record(benchmarks?.artificial_analysis)
  return finiteNumber(aa?.[key])
}

/** Chat-capable (text out) models from `GET /api/v1/models`. Unknown fields are ignored. */
export function parseOpenRouterModels(payload: unknown): OpenRouterCatalogModel[] {
  const data = record(payload)?.data
  if (!Array.isArray(data)) {
    return []
  }
  const out: OpenRouterCatalogModel[] = []
  const seen = new Set<string>()
  for (const item of data) {
    const row = record(item)
    const id = typeof row?.id === 'string' ? row.id.trim() : ''
    if (!row || !id || seen.has(id)) {
      continue
    }
    const architecture = record(row.architecture)
    if (!hasTextOutput(architecture)) {
      continue
    }
    seen.add(id)
    const pricing = record(row.pricing)
    const promptPerM = perMillion(pricing?.prompt)
    const completionPerM = perMillion(pricing?.completion)
    const benchmarks = record(row.benchmarks)
    const params = Array.isArray(row.supported_parameters) ? row.supported_parameters : []
    const name = typeof row.name === 'string' && row.name.trim() ? row.name.trim() : id
    const contextLength = finiteNumber(row.context_length)
    const expires = typeof row.expiration_date === 'string' && row.expiration_date.trim()
      ? row.expiration_date.trim()
      : null
    out.push({
      id,
      name,
      contextLength: contextLength != null && contextLength > 0 ? contextLength : null,
      promptPerM,
      completionPerM,
      free: promptPerM === 0 && completionPerM === 0,
      vision: modalityHasVision(typeof architecture?.modality === 'string' ? architecture.modality : null),
      tools: params.includes('tools'),
      intelligence: readIndex(benchmarks, 'intelligence_index'),
      coding: readIndex(benchmarks, 'coding_index'),
      expiresAt: expires,
      created: finiteNumber(row.created),
    })
  }
  return out
}

/** Routers, aliases, batch variants, and models on a removal date stay off the shelf. */
export function isShelfEligible(model: OpenRouterCatalogModel): boolean {
  return model.tools
    && !model.id.startsWith('openrouter/')
    && !model.id.startsWith('~')
    && !model.id.endsWith(':batch')
    && !model.expiresAt
    && model.promptPerM != null
    && model.completionPerM != null
}

/** Artificial Analysis blend: three prompt tokens per completion token. */
export function blendedPricePerM(model: OpenRouterCatalogModel): number {
  return ((model.promptPerM ?? 0) * 3 + (model.completionPerM ?? 0)) / 4
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) {
    return Number.POSITIVE_INFINITY
  }
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))
  return sorted[index] ?? Number.POSITIVE_INFINITY
}

function byScore(
  score: (model: OpenRouterCatalogModel) => number | null,
): (a: OpenRouterCatalogModel, b: OpenRouterCatalogModel) => number {
  return (a, b) => {
    const left = score(a)
    const right = score(b)
    if (left !== right) {
      return (right ?? Number.NEGATIVE_INFINITY) - (left ?? Number.NEGATIVE_INFINITY)
    }
    const price = blendedPricePerM(a) - blendedPricePerM(b)
    if (price !== 0) {
      return price
    }
    const context = (b.contextLength ?? 0) - (a.contextLength ?? 0)
    return context !== 0 ? context : a.id.localeCompare(b.id)
  }
}

/**
 * Rank Free / Smart / Coding from the live list.
 * Free: best Intelligence Index among free models.
 * Smart / Coding: best Intelligence / Coding Index among paid models priced at
 * or below the catalog's 75th-percentile blended price, so the default Smart
 * pick is strong without the premium tier.
 * When OpenRouter reports no indexes, rank the newest models instead.
 */
export function rankOpenRouterShelf(
  models: readonly OpenRouterCatalogModel[],
  size: number = OPENROUTER_SHELF_SIZE,
): { shelf: OpenRouterShelf, ranking: OpenRouterShelfRanking } {
  const eligible = models.filter(isShelfEligible)
  const free = eligible.filter((model) => model.free)
  const paid = eligible.filter((model) => !model.free)
  const benchmarked = paid.filter((model) => model.intelligence != null)
  const ranking: OpenRouterShelfRanking = benchmarked.length > 0 ? 'benchmarks' : 'fallback'
  const priced = (ranking === 'benchmarks' ? benchmarked : paid)
    .map(blendedPricePerM)
    .sort((a, b) => a - b)
  const cap = quantile(priced, 0.75)
  const affordable = paid.filter((model) => blendedPricePerM(model) <= cap)

  if (ranking === 'fallback') {
    const newest = byScore((model) => model.created)
    return {
      ranking,
      shelf: {
        free: [...free].sort(newest).slice(0, size),
        smart: [...affordable].sort(newest).slice(0, size),
        coding: [],
      },
    }
  }

  const freeRanked = [...free].sort(byScore((model) => model.intelligence ?? model.coding))
  return {
    ranking,
    shelf: {
      free: freeRanked.slice(0, size),
      smart: affordable
        .filter((model) => model.intelligence != null)
        .sort(byScore((model) => model.intelligence))
        .slice(0, size),
      coding: affordable
        .filter((model) => (model.coding ?? model.intelligence) != null)
        .sort(byScore((model) => model.coding ?? model.intelligence))
        .slice(0, size),
    },
  }
}

/** Casual meta Policy: cheap + toy → free, strong + code → auto. */
export function openRouterMetaPolicy(tier: ModelTier): LlmPolicy {
  return tier === 'cheap' || tier === 'toy' ? { kind: 'free' } : { kind: 'auto' }
}

type Binds = Partial<Record<ModelTier, LlmTierBind>>

export function openRouterRoutingMode(binds: Binds, providerId: string): OpenRouterRoutingMode {
  let meta = 0
  let pinned = 0
  for (const tier of MODEL_TIERS) {
    const bind = binds[tier]
    if (!bind || bind.providerId !== providerId) {
      continue
    }
    if (bind.policy.kind === 'model') {
      pinned += 1
    } else {
      meta += 1
    }
  }
  if (meta === 0 && pinned === 0) {
    return 'none'
  }
  if (pinned === 0) {
    return 'meta'
  }
  return meta === 0 ? 'pinned' : 'mixed'
}

/** Pin `modelId` on `tiers`, or restore meta free / auto when `modelId` is null. */
export function pinOpenRouterTiers(
  binds: Binds,
  providerId: string,
  tiers: readonly ModelTier[],
  modelId: string | null,
): Binds {
  const out: Binds = { ...binds }
  const id = modelId?.trim()
  for (const tier of tiers) {
    out[tier] = {
      providerId,
      policy: id ? { kind: 'model', modelId: id } : openRouterMetaPolicy(tier),
    }
  }
  return out
}

export function pinOpenRouterShelf(
  binds: Binds,
  providerId: string,
  slot: OpenRouterShelfSlot,
  modelId: string,
): Binds {
  return pinOpenRouterTiers(binds, providerId, OPENROUTER_SHELF_TIERS[slot], modelId)
}

/**
 * «Оставить маршрутизацию OpenRouter»: every pin on this Provider goes back
 * to meta free / auto. Tiers bound to another Provider stay. Empty tiers are
 * filled only when `fillEmpty` (this is the sole Provider).
 */
export function clearOpenRouterPins(
  binds: Binds,
  providerId: string,
  options: { fillEmpty?: boolean } = {},
): Binds {
  const out: Binds = { ...binds }
  for (const tier of MODEL_TIERS) {
    const bind = out[tier]
    if (bind ? bind.providerId === providerId : options.fillEmpty) {
      out[tier] = { providerId, policy: openRouterMetaPolicy(tier) }
    }
  }
  return out
}

/** The model id a shelf slot is pinned to, when every tier of that slot shares it. */
export function shelfSlotPin(
  binds: Binds,
  providerId: string,
  slot: OpenRouterShelfSlot,
): string | null {
  let pinned: string | null = null
  for (const tier of OPENROUTER_SHELF_TIERS[slot]) {
    const bind = binds[tier]
    if (!bind || bind.providerId !== providerId || bind.policy.kind !== 'model') {
      return null
    }
    if (pinned && pinned !== bind.policy.modelId) {
      return null
    }
    pinned = bind.policy.modelId
  }
  return pinned
}
