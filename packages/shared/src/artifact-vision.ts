/**
 * Image Artifact vision on the triggering user line. See ADR 0035.
 * History stays string content plus the ADR 0034 meta note.
 */

import type { Artifact } from './artifacts'
import { isImageArtifactMime } from './artifacts'

export const VISION_MAX_EDGE = 2048
export const VISION_JPEG_QUALITY = 80
export const VISION_WIRE_MAX_BYTES = Math.floor(1.5 * 1024 * 1024)
export const VISION_JPEG_MIME = 'image/jpeg'
export const VISION_EMPTY_CONTENT = '(изображение)'
export const VISION_SOFT_NOTE
  = 'Вложение-картинка есть; эта модель без vision — вижу только имя/размер.'

export const VISION_ADMISSION_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export type VisionAdmissionMime = typeof VISION_ADMISSION_MIMES[number]

/** Case-insensitive substring needles on the resolved model id. */
export const VISION_MODEL_NEEDLES = [
  'gpt-4o',
  'gpt-4.1',
  'gpt-5',
  'claude-3',
  'claude-4',
  'claude-sonnet',
  'claude-opus',
  'gemini',
  'gemini-flash',
] as const

export type OpenAiVisionTextPart = {
  type: 'text'
  text: string
}

export type OpenAiVisionImagePart = {
  type: 'image_url'
  image_url: {
    url: string
    detail: 'auto'
  }
}

export type OpenAiVisionContentPart = OpenAiVisionTextPart | OpenAiVisionImagePart

export function isVisionArtifactMime(mime: string): boolean {
  const normalized = mime.trim().toLowerCase()
  return (VISION_ADMISSION_MIMES as readonly string[]).includes(normalized)
}

export function modelAllowsVision(modelId: string): boolean {
  const haystack = modelId.toLocaleLowerCase()
  if (!haystack.trim()) {
    return false
  }
  return VISION_MODEL_NEEDLES.some((needle) => haystack.includes(needle))
}

export function hasImageArtifacts(
  artifacts: ReadonlyArray<Pick<Artifact, 'mime'>> | undefined,
): boolean {
  return Boolean(artifacts?.some((artifact) => isImageArtifactMime(artifact.mime)))
}

export function hasVisionAdmissionArtifacts(
  artifacts: ReadonlyArray<Pick<Artifact, 'mime'>> | undefined,
): boolean {
  return Boolean(artifacts?.some((artifact) => isVisionArtifactMime(artifact.mime)))
}

/**
 * Text for the triggering user message. Keeps the ADR 0034 meta note
 * already present in `content`. Adds the empty-image placeholder and
 * the soft no-vision note when needed.
 */
export function visionTriggerText(input: {
  content: string
  originalContent?: string
  hasImageArtifacts: boolean
  includeSoftNote: boolean
}): string {
  const pieces: string[] = []
  if (needsEmptyImagePlaceholder(input)) {
    pieces.push(VISION_EMPTY_CONTENT)
  }
  if (input.content.trim()) {
    pieces.push(input.content)
  }
  const assembled = pieces.join('\n\n')
  if (input.includeSoftNote && !assembled.includes(VISION_SOFT_NOTE)) {
    return assembled.trim() ? `${assembled}\n\n${VISION_SOFT_NOTE}` : VISION_SOFT_NOTE
  }
  return assembled
}

function needsEmptyImagePlaceholder(input: {
  content: string
  originalContent?: string
  hasImageArtifacts: boolean
}): boolean {
  if (!input.hasImageArtifacts || input.content.includes(VISION_EMPTY_CONTENT)) {
    return false
  }
  if (input.originalContent !== undefined) {
    return !input.originalContent.trim()
  }
  const trimmed = input.content.trim()
  return trimmed.length === 0 || trimmed.startsWith('Attached Artifacts:')
}

export function visionUserContent(
  text: string,
  imageParts: readonly OpenAiVisionImagePart[],
): string | OpenAiVisionContentPart[] {
  if (imageParts.length === 0) {
    return text
  }
  return [
    { type: 'text', text },
    ...imageParts,
  ]
}

export function isModalityErrorText(text: string): boolean {
  return /modalit|image_url|multimodal|\bvision\b|image input|invalid image|unsupported image|does not support image|images are not supported/i
    .test(text)
}
