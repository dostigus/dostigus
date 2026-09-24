# ADR 0006: Day-1 declarative modules (before arbitrary sandbox)

- Status: accepted (MVP constraint; sandbox remains open)
- Date: 2026-09-21

## Decision

Day-1 Module packages are declarative: SQL schema/migrations + a templated MCP
surface + Kit UI bindings + Skill diffs. Arbitrary in-cluster sandbox code
(eval, containers of user JS/Python, unrestricted tools) is out of scope until
a later ADR. This is an MVP constraint, not a claim that sandbox will never
exist.

## Context

A Meal-like pilot (chat → card → Cook/Shopping Sheet) does not need a general
code runtime. Shipping a sandbox on day-1 would dominate security, packaging,
and the Host before the MCP surface is real.

## Consequences

- Do not add a module runner that executes user-supplied code in this MVP.
- MCP tools are declared and templated against SQL, not generated from random
  scripts.
- Builder “write me a module” Jobs are also out of scope (see SPEC).
- This monorepo does not ship stock Module package seeds. Schedule
  Chat Cards are [ADR 0030](0030-chat-cards-module-catalog.md). A
  Marketplace of packages is later. That is not a sandbox and not a
  Builder Job.
- Revisit sandbox only after declarative install/export and Host Sheets work.

## Alternatives

- WASM/container sandbox on day-1 — open for later; too much for the scaffold.
- Only hardcoded built-in Bots — too rigid; packages must still be data.
