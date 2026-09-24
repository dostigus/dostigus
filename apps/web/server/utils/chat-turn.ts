import type { OpenedStore } from '@dostigus/db'
import type { ChatToolInvokeResult } from './mcp-platform-tools'
import type { OpenAiChatFunctionTool } from './openai-tools'
import { ChatCardTurn } from './chat-cards'
import { chatMcpToolsAsOpenAi, invokeChatMcpTool } from './mcp-platform-tools'

/**
 * One Chat turn's tool list and Schedule Card collector.
 * The Host injects a Card after a Schedule tool. See ADR 0030.
 */
export function openChatTurn(input: {
  store: OpenedStore
  role: 'owner' | 'member'
  canEditManifest: boolean
  personId: string
  turnBotId: string
}): {
  cards: ChatCardTurn
  tools: () => OpenAiChatFunctionTool[]
  invokeTool: (name: string, args: unknown) => ChatToolInvokeResult
} {
  const cards = new ChatCardTurn()
  const tools = () => chatMcpToolsAsOpenAi(input.role, {
    canEditManifest: input.canEditManifest,
  })
  const invokeTool = (name: string, args: unknown): ChatToolInvokeResult => invokeChatMcpTool({
    name,
    args,
    store: input.store,
    role: input.role,
    personId: input.personId,
    turnBotId: input.turnBotId,
    cards,
  })
  return { cards, tools, invokeTool }
}
