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
  expect(chatMcpToolsAsOpenAi('member').map((tool) => tool.function.name)).toEqual([
    'dostigus_messages_list',
    'dostigus_messages_create',
  ])
  expect(tools.every((tool) => tool.type === 'function')).toBe(true)

  const update = tools.find((tool) => tool.function.name === 'dostigus_bots_update')
  expect(update?.function.parameters).toEqual({
    type: 'object',
    properties: {
      avatarColor: {
        type: 'string',
        enum: [
          '#1F7AE5',
          '#B656D7',
          '#8190AE',
          '#529098',
          '#A0A24F',
          '#0AAC7B',
          '#9B8F7E',
          '#D5AC1B',
          '#E47134',
          '#DE3957',
          '#73B125',
          '#B2774F',
          '#8354E6',
          '#28A2D6',
          '#DD547E',
          '#DC4ACD',
        ],
      },
      avatarShape: {
        type: 'string',
        enum: [
          'circle',
          'bean',
          'squircle',
          'capsule',
          'triangle',
          'hex',
          'cloud',
          'teardrop',
        ],
      },
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
