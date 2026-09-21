declare module 'h3' {
  interface H3EventContext {
    /** Set by the MCP handler when the Bearer token matches. */
    agentOk?: boolean
  }
}
