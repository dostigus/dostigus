# ADR 0003: MCP as the Bot ↔ store contract

- Status: accepted
- Date: 2026-09-21

## Decision

A Bot is Storage → MCP surface → agent skills/persona. The MCP contract is the
only interface between the store and both the chat agent and the Host shell UI.
Module packages ship that contract. UI modules do not query the database
directly.

## Context

If the agent and the Sheet use different APIs, they drift. MCP is already the
tool surface agents speak; making it the store contract keeps one schema of
verbs for chat and for Sheets.

## Consequences

- Module packages include an MCP contract (templated on day-1; see ADR 0006).
- Host cards/Sheets call the same tools the Bot calls.
- `packages/db` is an implementation detail behind MCP, not a public app API.
- Do not add REST “for the UI” that bypasses the contract.

## Alternatives

- REST/tRPC for UI and MCP for the agent — rejected; two contracts will diverge.
- Direct Drizzle from Vue — rejected; breaks export/import and sandbox later.
