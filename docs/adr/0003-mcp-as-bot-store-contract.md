# ADR 0003: MCP as the Bot ↔ store contract

- Status: accepted
- Date: 2026-09-21

## Decision

A Bot talks to the Store through an MCP surface (tools + Skills/persona). The
MCP contract is the interface definition of that surface. The Host UI uses the
same tools. Module packages ship the surface. UI modules do not query the
Store directly.

## Context

If the Bot and the Sheet use different APIs, they drift. MCP is already the
tool surface Bots speak; making it the Store interface keeps one schema of
verbs for Chat and for Sheets.

## Consequences

- Module packages include an MCP surface (templated on day-1; see ADR 0006).
- Host Cards/Sheets call the same tools the Bot calls.
- `packages/db` is an implementation detail behind MCP, not a public app API.
- Do not add REST “for the UI” that bypasses the contract.
- Day-1 exception: Host Nitro routes write Bots and Chat until the MCP
  surface exists ([ADR 0008](0008-host-store-routes.md)).

## Alternatives

- REST/tRPC for UI and MCP for the agent — rejected; two contracts will diverge.
- Direct Drizzle from Vue — rejected; breaks export/import and sandbox later.
