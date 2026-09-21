import type { PlatformToolInputs, PlatformToolName, PlatformToolResults } from '@dostigus/mcp'
import { invokePlatformTool, McpInvokeError } from '@dostigus/mcp'

export async function callPlatformTool<K extends PlatformToolName>(
  name: K,
  input: PlatformToolInputs[K],
): Promise<PlatformToolResults[K]> {
  try {
    return await invokePlatformTool(name, input, { store: useStore() })
  } catch (error) {
    if (error instanceof McpInvokeError) {
      throw createError({
        statusCode: error.statusCode,
        statusMessage: error.message,
      })
    }
    throwStoreError(error)
  }
}
