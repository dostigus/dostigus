import { expect, it } from 'vitest'
import { chatMcpToolsAsOpenAi, listChatMcpToolSpecs } from '../../server/utils/mcp-platform-tools'
import { CHAT_MCP_TOOLS } from '../../server/utils/mcp-surface'
import {
  mcpToolsToOpenAiFunctions,
  parseToolCallArguments,
  zodShapeToOpenAiParameters,
} from '../../server/utils/openai-tools'

it('maps MCP Zod tools to OpenAI function schemas', () => {
  const tools = chatMcpToolsAsOpenAi()
  expect(tools.map((tool) => tool.function.name)).toEqual([...CHAT_MCP_TOOLS])
  expect(tools.every((tool) => tool.type === 'function')).toBe(true)

  const update = tools.find((tool) => tool.function.name === 'dostigus_bots_update')
  expect(update?.function.parameters).toEqual({
    type: 'object',
    properties: {
      id: { type: 'string', minLength: 1 },
      name: { type: 'string' },
      modelTier: {
        type: 'string',
        enum: ['cheap', 'strong', 'code', 'toy'],
      },
    },
    required: ['id'],
    additionalProperties: false,
  })

  const list = tools.find((tool) => tool.function.name === 'dostigus_bots_list')
  expect(list?.function.parameters).toEqual({
    type: 'object',
    properties: {},
    additionalProperties: false,
  })
})

it('does not expose delete on the Chat OpenAI tool list', () => {
  expect(mcpToolsToOpenAiFunctions(listChatMcpToolSpecs()).map((tool) => tool.function.name))
    .not
    .toContain('dostigus_bots_delete')
})

it('maps an empty Zod shape to an object schema', () => {
  expect(zodShapeToOpenAiParameters()).toEqual({
    type: 'object',
    properties: {},
    additionalProperties: false,
  })
})

it('parses OpenAI tool-call argument strings', () => {
  expect(parseToolCallArguments('')).toEqual({})
  expect(parseToolCallArguments('{"id":"b1"}')).toEqual({ id: 'b1' })
  expect(parseToolCallArguments({ id: 'b1' })).toEqual({ id: 'b1' })
  expect(() => parseToolCallArguments('{')).toThrow('invalid tool arguments JSON')
})
