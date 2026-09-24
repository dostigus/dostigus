import type { OpenedStore } from '@dostigus/db'
import type { ChatToolInvokeResult } from './mcp-platform-tools'
import type { OpenAiChatFunctionTool } from './openai-tools'
import { ChatCardTurn } from './chat-cards'
import { chatMcpToolsAsOpenAi, invokeChatMcpTool } from './mcp-platform-tools'
import { chatToolNamesForTurn } from './mcp-surface'

/**
 * One Chat turn's tool list and Schedule Card collector.
 * The Host injects a Card after a Schedule tool. A Skill or self-settings
 * success writes a system line on the bot-thread. See ADR 0030 and ADR 0032.
 */
export function openChatTurn(input: {
  store: OpenedStore
  role: 'owner' | 'member'
  canEditManifest: boolean
  personId: string
  turnBotId: string
  expand?: boolean
  wake?: boolean
}): {
  cards: ChatCardTurn
  tools: () => OpenAiChatFunctionTool[]
  invokeTool: (name: string, args: unknown) => ChatToolInvokeResult | Promise<ChatToolInvokeResult>
} {
  const cards = new ChatCardTurn()
  const allowedTools = chatToolNamesForTurn({
    role: input.role,
    canEditManifest: input.canEditManifest,
    expand: input.expand,
    wake: input.wake,
  })
  const tools = () => chatMcpToolsAsOpenAi(input.role, {
    canEditManifest: input.canEditManifest,
    expand: input.expand,
    wake: input.wake,
  })
  const invokeTool = (
    name: string,
    args: unknown,
  ): ChatToolInvokeResult | Promise<ChatToolInvokeResult> => invokeChatMcpTool({
    name,
    args,
    store: input.store,
    role: input.role,
    personId: input.personId,
    turnBotId: input.turnBotId,
    cards,
    allowedTools,
  })
  return { cards, tools, invokeTool }
}
