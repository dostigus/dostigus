import { StoreError } from '@dostigus/db'

export type McpInvokeCode = 'validation' | 'not_found' | 'unknown_tool' | 'internal'

export class McpInvokeError extends Error {
  readonly statusCode: number
  readonly code: McpInvokeCode

  constructor(message: string, statusCode: number, code: McpInvokeCode) {
    super(message)
    this.name = 'McpInvokeError'
    this.statusCode = statusCode
    this.code = code
  }
}

export function wrapToolError(error: unknown): never {
  if (error instanceof McpInvokeError) {
    throw error
  }
  if (error instanceof StoreError) {
    throw new McpInvokeError(
      error.message,
      error.statusCode,
      error.statusCode === 404 ? 'not_found' : 'validation',
    )
  }
  throw error
}
