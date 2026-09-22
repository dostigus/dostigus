# Dostigus — MVP spec

Product: **self-host agent OS** — portable bot packages + host UI sheets.

This spec is the day-1 / first-scaffold contract. Architecture decisions are in
[`docs/adr/`](adr/). Glossary: [`CONTEXT.md`](../CONTEXT.md).

## In scope (platform direction)

Settled now, even if this repo only scaffolds them:

| Area | Intent |
|------|--------|
| Platform git | Git holds the Dostigus monorepo only. See [ADR 0001](adr/0001-platform-git-vs-in-cluster-bot-packages.md). |
| In-cluster packages | Cluster Store holds Manifests, Module packages, data. Export/import between Clusters. |
| Host | One app: Chat + Cards + Sheets from the Kit. Sheet shell on Reka UI, plus Brand. See [ADR 0002](adr/0002-host-ui-kit-and-sheets.md) and [ADR 0013](adr/0013-kit-reka-ui-and-brand.md). |
| MCP surface | Store and UI go through the same tools. See [ADR 0003](adr/0003-mcp-as-bot-store-contract.md). |
| LLM gateway | User keys; Model tiers `cheap` \| `strong` \| `code` (plus `toy`). See [ADR 0004](adr/0004-llm-gateway-tiers.md). |
| Self-host first | `docker compose up` is the intended path. See [ADR 0005](adr/0005-self-host-first.md). |
| Declarative modules | SQL + templated MCP before arbitrary sandbox. See [ADR 0006](adr/0006-day-1-declarative-modules.md). |
| Cluster store | Drizzle + SQLite day-1 (Postgres later is fine). |
| Pilot shape | Meal-like loop later: Chat → Card → Sheet via MCP. Not a Meal port. Day-1 is create Bot + Chat only. |

## This Host (create Bot + Chat)

What the running Cluster does today:

- Store (`@dostigus/db`): Drizzle schema + SQLite on `DATABASE_URL`. Tables
  `bots` (name, Manifest: `modelTier` default `strong`, empty skills/modules),
  `messages` (`botId`, role `user` \| `assistant` \| `system`, content),
  `llm_gateway` (Cluster LLM gateway: base URL, key server-side only,
  default Model tier, optional model overrides), `owners` (exactly one
  Cluster Owner: unique email and/or username, password hash, createdAt),
  and `members` (Household Members: display name, unique email and/or
  username, password hash, createdAt, disabledAt). User Chat lines store
  `personId` (the Owner id or Member id). Host opens and migrates the
  Store on start.
- Owner auth: `nuxt-auth-utils` sealed cookie session. Fresh Cluster →
  `/onboarding` (email or username + password). Later visits → `/login`.
  Register is disabled once an Owner exists. Login accepts the Owner or a
  Member. Logout clears the session. See
  [ADR 0010](adr/0010-owner-auth-session.md) and
  [ADR 0012](adr/0012-household-members.md).
- Host UI: Bot list (empty state + Owner `+` create, default name **New Bot**),
  Chat (timeline + composer, unlabeled bubbles), Settings, and
  Members. Settings presents OpenRouter as the default LLM path (API key +
  Model tier) and stays with the Owner. A collapsed custom
  OpenAI-compatible URL remains for other gateways. Creating a Bot
  (or first open) stores an assistant greeting that asks what the Bot is
  for. The Owner adds a Member with a display name, email or username, and
  password. A Member sees the same Bot list and Chat, without create,
  delete, Members, or Settings. Turning off sign-in keeps their name on
  the Chat line. Logged-out visitors cannot open those surfaces. Host font is
  Nunito; dark charcoal + coral-orange tokens
  ([`docs/ui.md`](ui.md)). The Kit Sheet shell (`KitSheet` drawer,
  `KitDialog` modal) and `KitButton` sit on Reka UI and those tokens.
  Brand goose marks and stickers live in the Kit. The Host mark uses the
  goose logo. Empty Bots shows a sticker. Add Member opens a Sheet. See
  [ADR 0013](adr/0013-kit-reka-ui-and-brand.md). On a wide screen the Host
  is a resizable sidebar of Bots beside Chat. The sidebar can collapse to
  an icon rail. Each row shows an avatar, the Bot name, and the latest
  Chat line. Search filters that list in the Host. The Owner's `+`
  creates a Bot. A user button opens Settings (`/settings`), Members
  (`/members`), and Sign out. Chat has a narrow header: avatar and name
  open a right Sheet (rename, Model tier, delete for the Owner),
  unlabeled bubbles, and a composer. The composer has a disabled
  attachments control and shows a send arrow when there is text. On a
  narrow screen the sidebar is a drawer. Sending a line shows it at once,
  then a pending Bot reply, then the stored reply. An empty Bot list
  offers **Create a Bot** and opens that Chat. See
  [ADR 0014](adr/0014-host-messenger-shell.md) and
  [ADR 0015](adr/0015-host-desktop-shell.md).
- Host routes: `/api/bots` CRUD, `/api/bots/:id/messages` list/post,
  `/api/members` list/create and `/api/members/:id/disable`,
  `/api/settings/llm-gateway` get/put/ping, `/api/chat/ready` (configured
  flag only). Persist in SQLite via the same Store helpers as the MCP
  surface. Bot list, Bot read, and Chat accept an Owner or Member session.
  Bot create/update/delete, Members, and Settings require the Owner. See
  [ADR 0008](adr/0008-host-store-routes.md).
- MCP surface: `@nuxtjs/mcp-toolkit` at `/mcp` (name `Dostigus`). File-based
  tools under `apps/web/server/mcp/tools/` wrap Bots and Chat messages.
  Bearer `NUXT_AGENT_TOKEN` (or `DOSTIGUS_MCP_TOKEN`); empty token → tools
  stay disabled. Soft auth (no 401). The MCP token is **not** the Host
  Owner session. See
  [ADR 0009](adr/0009-mcp-toolkit-endpoint.md).
- LLM gateway: OpenAI-compatible client, Model tiers mapped to
  OpenRouter-friendly default model ids. The Owner sets base URL + key in
  Host Settings (Store) or via compose env (env overrides Store). Chat
  sends greeting + history and a system prompt (new Bot, learn purpose,
  keep Manifest). When a key is set, Chat also sends Cluster MCP surface
  tools and runs an in-process tool loop (same handlers as `/mcp`, no
  HTTP hop). Owner Chat tools: Bots list/get/create/update and messages
  list/create. Member Chat tools: messages list/create only. Delete stays
  off Chat. No key → quiet reply + banner (no tools). Configured call that
  fails → clear error, not a stub. The
  full key is never returned to the client or written to logs. Greeting
  is always stored. Keys are **not** required for compose. See
  [ADR 0011](adr/0011-chat-mcp-tool-loop.md).
- `/health` stays `{ ok: true }`.
- No seed/demo domain Bot. No Builder or Meal. Household on this Host is
  the Owner plus Members ([ADR 0012](adr/0012-household-members.md)).

`pnpm install` and `pnpm check` must stay green.

## Self-host (compose)

`docker compose -f docker/compose.yml up --build` serves the Host on port 3000
and mounts volume `cluster-data` for the Store. Image publishing is
`ghcr.io/dostigus/dostigus` (see [ADR 0007](adr/0007-platform-image-tags.md)
and [`docs/deploy.md`](deploy.md)).

## Out of scope (do not implement yet)

- Full agent runtime (parity with Grok Bot or otherwise)
- Meal product port
- Builder that writes Module packages (chat Bot ≠ Builder)
- Marketplace
- Share link, guests, invites by email, QR, person-to-person Chat
- Roles beyond Owner and Member, hard-delete of a Member
- OAuth, passkeys, email verify, password reset
- Mobile native
- Per-bot domains (the `meal.kosarev.space` pattern is temporary and to be replaced)
- Arbitrary in-cluster sandbox code
- Managed/cloud hosting (optional later; not the default)

## Success for later MVPs (not this PR)

A self-hosted Cluster that can install a declarative Bot, chat with it, and open
a Sheet that reads/writes through the same MCP surface.
