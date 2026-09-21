import type { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

/** JSON Schema for MCP `tools/list` (`inputSchema`). */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = zodToJsonSchema(schema, {
    $refStrategy: 'none',
    target: 'jsonSchema7',
  }) as Record<string, unknown>
  const { $schema: _schema, ...rest } = json
  return rest
}
