import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const chat = readFileSync(join(import.meta.dirname, '../../app/pages/bots/[id].vue'), 'utf8')

it('renders Markdown on assistant bubbles and leaves other roles as plain text', () => {
  const bubbleStart = chat.indexOf('v-for="message in timeline"')
  const bubbleEnd = chat.indexOf('</li>', bubbleStart)
  expect(bubbleStart).toBeGreaterThan(-1)
  expect(bubbleEnd).toBeGreaterThan(bubbleStart)
  const bubble = chat.slice(bubbleStart, bubbleEnd)

  expect(bubble).toContain('assistantBubbleUsesMarkdown(message.role)')
  expect(bubble).toContain('<KitMarkdown')
  expect(bubble).toContain(':source="chatLineText(message.content)"')
  expect(bubble).toContain('{{ chatLineText(message.content) }}')
  expect(chat).toContain('localizeGatewayErrorReply')
  expect(chat).toContain('white-space: pre-wrap')

  const markdownAt = bubble.indexOf('<KitMarkdown')
  const plainAt = bubble.indexOf('{{ chatLineText(message.content) }}')
  const elseAt = bubble.indexOf('v-else')
  expect(markdownAt).toBeGreaterThan(-1)
  expect(elseAt).toBeGreaterThan(markdownAt)
  expect(plainAt).toBeGreaterThan(elseAt)
  expect(bubble.match(/\{\{ chatLineText\(message\.content\) \}\}/g)).toHaveLength(1)

  const plain = bubble.slice(elseAt, plainAt)
  expect(plain).toContain('class="text"')
  expect(plain).not.toContain('KitMarkdown')
})
