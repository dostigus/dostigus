import { expect, it } from 'vitest'
import {
  hasImageArtifacts,
  isModalityErrorText,
  isVisionArtifactMime,
  modelAllowsVision,
  VISION_EMPTY_CONTENT,
  VISION_SOFT_NOTE,
  visionTriggerText,
  visionUserContent,
} from '../../src/index'

it('admits jpeg png webp gif and rejects other image mime', () => {
  expect(isVisionArtifactMime('image/jpeg')).toBe(true)
  expect(isVisionArtifactMime('image/png')).toBe(true)
  expect(isVisionArtifactMime('image/webp')).toBe(true)
  expect(isVisionArtifactMime('image/gif')).toBe(true)
  expect(isVisionArtifactMime('IMAGE/JPEG')).toBe(true)
  expect(isVisionArtifactMime('image/bmp')).toBe(false)
  expect(isVisionArtifactMime('image/svg+xml')).toBe(false)
  expect(isVisionArtifactMime('application/pdf')).toBe(false)
})

it('matches the vision allowlist as a case-insensitive substring', () => {
  expect(modelAllowsVision('openai/gpt-4o')).toBe(true)
  expect(modelAllowsVision('openai/gpt-4o-mini')).toBe(true)
  expect(modelAllowsVision('GPT-4.1')).toBe(true)
  expect(modelAllowsVision('openai/gpt-5')).toBe(true)
  expect(modelAllowsVision('anthropic/claude-3.5-sonnet')).toBe(true)
  expect(modelAllowsVision('anthropic/claude-4-opus')).toBe(true)
  expect(modelAllowsVision('anthropic/claude-sonnet-4')).toBe(true)
  expect(modelAllowsVision('google/gemini-2.0-flash')).toBe(true)
  expect(modelAllowsVision('meta-llama/llama-3.1-70b')).toBe(false)
  expect(modelAllowsVision('openai/o1-mini')).toBe(false)
  expect(modelAllowsVision('')).toBe(false)
})

it('adds the empty-image placeholder and the soft no-vision note', () => {
  const meta = 'Attached Artifacts:\n- photo.jpg (image/jpeg, 12 bytes, id a1)'
  expect(visionTriggerText({
    content: meta,
    originalContent: '',
    hasImageArtifacts: true,
    includeSoftNote: false,
  })).toBe(`${VISION_EMPTY_CONTENT}\n\n${meta}`)
  expect(visionTriggerText({
    content: `Look\n\n${meta}`,
    originalContent: 'Look',
    hasImageArtifacts: true,
    includeSoftNote: true,
  })).toBe(`Look\n\n${meta}\n\n${VISION_SOFT_NOTE}`)
  expect(visionTriggerText({
    content: `${VISION_EMPTY_CONTENT}\n\n${meta}\n\n${VISION_SOFT_NOTE}`,
    hasImageArtifacts: true,
    includeSoftNote: true,
  })).toBe(`${VISION_EMPTY_CONTENT}\n\n${meta}\n\n${VISION_SOFT_NOTE}`)
  expect(hasImageArtifacts([{ mime: 'image/jpeg' }])).toBe(true)
})

it('keeps a string when there are no image parts', () => {
  expect(visionUserContent('Hi', [])).toBe('Hi')
  expect(visionUserContent('Hi', [{
    type: 'image_url',
    image_url: { url: 'data:image/jpeg;base64,QQ==', detail: 'auto' },
  }])).toEqual([
    { type: 'text', text: 'Hi' },
    {
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,QQ==', detail: 'auto' },
    },
  ])
})

it('detects a provider modality error without needing the raw body later', () => {
  expect(isModalityErrorText('This model does not support image input')).toBe(true)
  expect(isModalityErrorText('invalid image_url part')).toBe(true)
  expect(isModalityErrorText('unsupported modality')).toBe(true)
  expect(isModalityErrorText('missing required field model')).toBe(false)
})
