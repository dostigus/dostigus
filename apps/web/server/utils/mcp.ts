export function mcpJson(data: unknown): string {
  return JSON.stringify(data, null, 2)
}
