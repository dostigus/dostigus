/**
 * Host-side Image Artifact vision wire (sharp JPEG). See ADR 0035.
 * Original volume bytes stay untouched. Never log image bytes or data URLs.
 */

import type { Artifact, OpenAiVisionImagePart } from '@dostigus/shared'
import type { OpenAiChatMessage } from './openai-tools'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  hasImageArtifacts,
  hasVisionAdmissionArtifacts,
  isVisionArtifactMime,
  modelAllowsVision,
  VISION_JPEG_MIME,
  VISION_JPEG_QUALITY,
  VISION_MAX_EDGE,
  VISION_WIRE_MAX_BYTES,
  visionTriggerText,
  visionUserContent,
} from '@dostigus/shared'
import sharp from 'sharp'
import { clusterArtifactsDir } from './artifacts'

export type VisionEncodeFn = (bytes: Uint8Array) => Promise<Uint8Array>
export type VisionReadFn = (id: string) => Promise<Uint8Array> | Uint8Array

export function visionJpegDataUrl(jpeg: Uint8Array): string {
  return `data:${VISION_JPEG_MIME};base64,${Buffer.from(jpeg).toString('base64')}`
}

export function visionImagePartFromJpeg(jpeg: Uint8Array): OpenAiVisionImagePart {
  return {
    type: 'image_url',
    image_url: {
      url: visionJpegDataUrl(jpeg),
      detail: 'auto',
    },
  }
}

/** Decode, max edge 2048, JPEG q~80. GIF → first frame. */
export async function encodeVisionJpeg(bytes: Uint8Array): Promise<Uint8Array> {
  const jpeg = await sharp(bytes, { animated: false, pages: 1, failOn: 'error' })
    .rotate()
    .resize(VISION_MAX_EDGE, VISION_MAX_EDGE, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: VISION_JPEG_QUALITY })
    .toBuffer()
  return new Uint8Array(jpeg)
}

export function readArtifactBytesFromVolume(id: string, dir?: string): Uint8Array {
  return new Uint8Array(readFileSync(join(clusterArtifactsDir(dir), id)))
}

export async function buildVisionImageParts(input: {
  artifacts: ReadonlyArray<Pick<Artifact, 'id' | 'mime'>>
  readBytes: VisionReadFn
  encode?: VisionEncodeFn
}): Promise<OpenAiVisionImagePart[]> {
  const encode = input.encode ?? encodeVisionJpeg
  const parts: OpenAiVisionImagePart[] = []
  for (const artifact of input.artifacts) {
    if (!isVisionArtifactMime(artifact.mime)) {
      continue
    }
    try {
      const bytes = await input.readBytes(artifact.id)
      const jpeg = await encode(bytes)
      if (jpeg.byteLength > VISION_WIRE_MAX_BYTES) {
        continue
      }
      parts.push(visionImagePartFromJpeg(jpeg))
    } catch {
      // That Artifact stays meta only. The turn continues.
    }
  }
  return parts
}

export function stripVisionImageParts(messages: OpenAiChatMessage[]): boolean {
  let stripped = false
  for (const message of messages) {
    if (message.role !== 'user' || !Array.isArray(message.content)) {
      continue
    }
    const hadImage = message.content.some((part) => part.type === 'image_url')
    if (!hadImage) {
      continue
    }
    const text = message.content
      .filter((part): part is { type: 'text', text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('\n\n')
    message.content = visionTriggerText({
      content: text,
      hasImageArtifacts: true,
      includeSoftNote: true,
    })
    stripped = true
  }
  return stripped
}

export async function applyTriggeringVision(input: {
  messages: OpenAiChatMessage[]
  trigger: {
    role: string
    content: string
    artifacts?: Artifact[]
  } | undefined
  modelId: string
  wake?: boolean
  artifactsDir?: string
  readArtifactBytes?: VisionReadFn
  encodeVisionJpeg?: VisionEncodeFn
}): Promise<void> {
  if (input.wake || input.trigger?.role !== 'user') {
    return
  }
  const artifacts = input.trigger.artifacts ?? []
  if (artifacts.length === 0) {
    return
  }

  const allowlisted = modelAllowsVision(input.modelId)
  const includeSoftNote = !allowlisted && hasVisionAdmissionArtifacts(artifacts)
  const text = visionTriggerText({
    content: input.trigger.content,
    hasImageArtifacts: hasImageArtifacts(artifacts),
    includeSoftNote,
  })

  let imageParts: OpenAiVisionImagePart[] = []
  if (allowlisted && hasVisionAdmissionArtifacts(artifacts)) {
    const readBytes = input.readArtifactBytes
      ?? ((id: string) => readArtifactBytesFromVolume(id, input.artifactsDir))
    imageParts = await buildVisionImageParts({
      artifacts,
      readBytes,
      encode: input.encodeVisionJpeg,
    })
  }

  const content = visionUserContent(text, imageParts)
  const index = findTriggerUserMessageIndex(input.messages, input.trigger.content)
  if (index < 0) {
    return
  }
  input.messages[index] = { role: 'user', content }
}

function findTriggerUserMessageIndex(
  messages: OpenAiChatMessage[],
  triggerContent: string,
): number {
  let found = -1
  for (const [index, message] of messages.entries()) {
    if (message.role !== 'user' || typeof message.content !== 'string') {
      continue
    }
    if (message.content === triggerContent) {
      found = index
    }
  }
  return found
}
