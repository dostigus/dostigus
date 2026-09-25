import type { LlmTierBind, ModelTier } from '../../src/index'
import { describe, expect, it } from 'vitest'
import {
  clearOpenRouterPins,
  modalityHasVision,
  OPENROUTER_SHELF_TIERS,
  openRouterRoutingMode,
  parseOpenRouterModels,
  pinOpenRouterShelf,
  pinOpenRouterTiers,
  rankOpenRouterShelf,
  shelfSlotPin,
} from '../../src/index'

type Row = {
  id: string
  prompt?: string
  completion?: string
  intelligence?: number | null
  coding?: number | null
  modality?: string
  tools?: boolean
  expires?: string | null
  created?: number
  outputs?: string[]
}

function row(input: Row): Record<string, unknown> {
  return {
    id: input.id,
    name: `Lab: ${input.id}`,
    created: input.created ?? 1,
    context_length: 128_000,
    architecture: {
      modality: input.modality ?? 'text->text',
      output_modalities: input.outputs ?? ['text'],
    },
    pricing: { prompt: input.prompt ?? '0.000001', completion: input.completion ?? '0.000002' },
    supported_parameters: input.tools === false ? ['temperature'] : ['tools', 'tool_choice'],
    expiration_date: input.expires ?? null,
    benchmarks: input.intelligence === undefined && input.coding === undefined
      ? undefined
      : {
          artificial_analysis: {
            intelligence_index: input.intelligence ?? null,
            coding_index: input.coding ?? null,
          },
        },
  }
}

function catalog(rows: Row[]) {
  return parseOpenRouterModels({ data: rows.map(row) })
}

describe('parseOpenRouterModels', () => {
  it('reads price per 1M, free, vision, tools, and Artificial Analysis indexes', () => {
    const [model] = catalog([{
      id: 'lab/seeing',
      prompt: '0.0000025',
      completion: '0.00001',
      intelligence: 41.5,
      coding: 60,
      modality: 'text+image->text',
    }])
    expect(model).toMatchObject({
      id: 'lab/seeing',
      name: 'Lab: lab/seeing',
      promptPerM: 2.5,
      completionPerM: 10,
      free: false,
      vision: true,
      tools: true,
      intelligence: 41.5,
      coding: 60,
    })
  })

  it('treats a negative price as variable and drops non-text outputs', () => {
    const models = catalog([
      { id: 'openrouter/router', prompt: '-1', completion: '-1' },
      { id: 'lab/music', outputs: ['audio'] },
      { id: 'lab/free', prompt: '0', completion: '0' },
    ])
    expect(models.map((model) => model.id)).toEqual(['openrouter/router', 'lab/free'])
    expect(models[0]?.promptPerM).toBeNull()
    expect(models[1]?.free).toBe(true)
  })

  it('returns an empty list for a malformed payload', () => {
    expect(parseOpenRouterModels(null)).toEqual([])
    expect(parseOpenRouterModels({ data: 'nope' })).toEqual([])
    expect(parseOpenRouterModels({ data: [{ name: 'no id' }] })).toEqual([])
  })
})

describe('modalityHasVision', () => {
  it('looks at the input side of architecture.modality', () => {
    expect(modalityHasVision('text+image->text')).toBe(true)
    expect(modalityHasVision('text->text+image')).toBe(false)
    expect(modalityHasVision('text->text')).toBe(false)
    expect(modalityHasVision(null)).toBe(false)
  })
})

describe('rankOpenRouterShelf', () => {
  const rows: Row[] = [
    { id: 'lab/free-small', prompt: '0', completion: '0', intelligence: 12 },
    { id: 'lab/free-best', prompt: '0', completion: '0', intelligence: 30 },
    { id: 'lab/free-notools', prompt: '0', completion: '0', intelligence: 50, tools: false },
    { id: 'lab/cheap', prompt: '0.0000001', completion: '0.0000004', intelligence: 35, coding: 70 },
    { id: 'lab/mid', prompt: '0.000001', completion: '0.000004', intelligence: 44, coding: 65 },
    { id: 'lab/mid-b', prompt: '0.0000008', completion: '0.000003', intelligence: 40, coding: 72 },
    { id: 'lab/premium', prompt: '0.00001', completion: '0.00005', intelligence: 58, coding: 82 },
    { id: 'lab/leaving', prompt: '0.0000005', completion: '0.000001', intelligence: 57, expires: '2099-01-01' },
    { id: 'lab/mid:batch', prompt: '0.0000005', completion: '0.000002', intelligence: 44 },
    { id: '~lab/latest', prompt: '0.000001', completion: '0.000004', intelligence: 44 },
    { id: 'openrouter/free', prompt: '0', completion: '0' },
  ]

  it('ranks Free by intelligence among free tools-capable models', () => {
    const { shelf, ranking } = rankOpenRouterShelf(catalog(rows))
    expect(ranking).toBe('benchmarks')
    expect(shelf.free.map((model) => model.id)).toEqual(['lab/free-best', 'lab/free-small'])
  })

  it('keeps the premium price quartile off Smart and Coding', () => {
    const { shelf } = rankOpenRouterShelf(catalog(rows))
    expect(shelf.smart.map((model) => model.id)).toEqual(['lab/mid', 'lab/mid-b', 'lab/cheap'])
    expect(shelf.coding.map((model) => model.id)).toEqual(['lab/mid-b', 'lab/cheap', 'lab/mid'])
    const ids = [...shelf.smart, ...shelf.coding].map((model) => model.id)
    expect(ids).not.toContain('lab/premium')
    expect(ids).not.toContain('lab/leaving')
    expect(ids).not.toContain('lab/mid:batch')
    expect(ids).not.toContain('~lab/latest')
  })

  it('falls back to the newest models when OpenRouter reports no indexes', () => {
    const { shelf, ranking } = rankOpenRouterShelf(catalog([
      { id: 'lab/old', created: 1 },
      { id: 'lab/new', created: 9 },
      { id: 'lab/free', prompt: '0', completion: '0', created: 5 },
    ]))
    expect(ranking).toBe('fallback')
    expect(shelf.smart[0]?.id).toBe('lab/new')
    expect(shelf.free[0]?.id).toBe('lab/free')
    expect(shelf.coding).toEqual([])
  })
})

describe('shelf pins', () => {
  const meta: Partial<Record<ModelTier, LlmTierBind>> = {
    cheap: { providerId: 'or', policy: { kind: 'free' } },
    toy: { providerId: 'or', policy: { kind: 'free' } },
    strong: { providerId: 'or', policy: { kind: 'auto' } },
    code: { providerId: 'or', policy: { kind: 'auto' } },
  }

  it('maps Free → cheap + toy, Smart → strong, Coding → code', () => {
    expect(OPENROUTER_SHELF_TIERS).toEqual({
      free: ['cheap', 'toy'],
      smart: ['strong'],
      coding: ['code'],
    })
    const binds = pinOpenRouterShelf(meta, 'or', 'free', 'lab/free-best')
    expect(binds.cheap?.policy).toEqual({ kind: 'model', modelId: 'lab/free-best' })
    expect(binds.toy?.policy).toEqual({ kind: 'model', modelId: 'lab/free-best' })
    expect(binds.strong?.policy).toEqual({ kind: 'auto' })
    expect(shelfSlotPin(binds, 'or', 'free')).toBe('lab/free-best')
    expect(shelfSlotPin(binds, 'or', 'smart')).toBeNull()
    expect(openRouterRoutingMode(binds, 'or')).toBe('mixed')
  })

  it('clears every pin on the Provider back to meta free / auto', () => {
    let binds = pinOpenRouterShelf(meta, 'or', 'smart', 'lab/mid')
    binds = pinOpenRouterShelf(binds, 'or', 'coding', 'lab/mid-b')
    binds = { ...binds, toy: { providerId: 'other', policy: { kind: 'model', modelId: 'x/y' } } }
    const cleared = clearOpenRouterPins(binds, 'or')
    expect(cleared.strong?.policy).toEqual({ kind: 'auto' })
    expect(cleared.code?.policy).toEqual({ kind: 'auto' })
    expect(cleared.cheap?.policy).toEqual({ kind: 'free' })
    expect(cleared.toy?.providerId).toBe('other')
    expect(openRouterRoutingMode(clearOpenRouterPins(meta, 'or'), 'or')).toBe('meta')
  })

  it('fills empty tiers with meta only for the sole Provider', () => {
    expect(clearOpenRouterPins({}, 'or')).toEqual({})
    expect(clearOpenRouterPins({}, 'or', { fillEmpty: true })).toEqual(meta)
  })

  it('restores meta on one tier when an Advanced pin is cleared', () => {
    const pinned = pinOpenRouterTiers(meta, 'or', ['strong'], 'lab/mid')
    expect(openRouterRoutingMode(pinned, 'or')).toBe('mixed')
    const back = pinOpenRouterTiers(pinned, 'or', ['strong'], null)
    expect(back.strong?.policy).toEqual({ kind: 'auto' })
    expect(openRouterRoutingMode(back, 'or')).toBe('meta')
    expect(openRouterRoutingMode({}, 'or')).toBe('none')
  })
})
