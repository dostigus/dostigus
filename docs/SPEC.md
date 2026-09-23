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
  `bots` (name, Manifest: `modelTier` default `strong`, `avatarShape`
  default `goose` (Bot mark), `avatarColor` default `#1F7AE5` /
  `--bot-accent-10`, optional `label` and `description` default empty,
  empty skills/modules),
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
- Host UI: Bot list (empty state + `+` picker), Chat (timeline + composer,
  unlabeled bubbles), Settings, and Members. Settings presents OpenRouter
  as the default LLM path (API key + Model tier) and stays with the Owner.
  A collapsed custom OpenAI-compatible URL remains for other gateways.
  The `+` replaces the Chat pane with a picker
  ([ADR 0019](adr/0019-bot-picker-and-chat-purpose.md)). Search there
  filters Bots by name. The Owner row **Create new Bot** stores a Bot named
  **New Bot** with a random flock mark and accent, then opens that Chat.
  A Member's picker is search and existing Bots only. Creating a Bot (or
  first open) stores an assistant greeting. Until the first user message,
  Chat shows a purpose Card: Personal, Work, Learning, Other, or free text.
  That answer is a normal Chat line. Purpose is not a Manifest field.
  The Owner adds a Member with a display name, email or username, and
  password. A Member sees the same Bot list and Chat, without create,
  delete, Members, or Settings. Turning off sign-in keeps their name on
  the Chat line. Logged-out visitors cannot open those surfaces. Host font is
  Nunito; charcoal canvas + firm coral-orange tokens
  ([`docs/ui.md`](ui.md)). The Kit Sheet shell (`KitSheet` drawer,
  `KitDialog` modal) and `KitButton` sit on Reka UI and those tokens.
  The Brand goose logo, stickers, and Bot marks live in the Kit. The Host
  mark uses the goose logo. With no Bots, the sidebar centers a short line
  and the main pane shows the wave sticker and **Create a Bot**. Add Member opens a Sheet. See
  [ADR 0013](adr/0013-kit-reka-ui-and-brand.md). On a wide screen the Host
  is a resizable sidebar of Bots beside Chat. The sidebar can collapse to
  an icon rail. Each row shows an avatar, the Bot name, and the latest
  Chat line. A loupe and a `+` sit at the top of the sidebar, both quiet
  icon buttons with no accent fill. The loupe opens a centered search
  Sheet (Bot names, Chat lines, and Host settings that person can open).
  The `+` opens
  the Bot picker. A user button opens Settings (`/settings`), Members
  (`/members`), and Sign out. Chat overlays a centered pill on the thread:
  avatar and name, translucent, so lines scroll under it. A top inset about
  the pill’s height keeps the first line clear of the pill when the thread
  is at the top. There is no full-width header bar. At rest the pill is
  only the mark and the name, with the same tight inset on both sides.
  Hover or focus fades an arrow in on the trailing side and the pill grows
  to fit it, with padding still sitting past that arrow. The pill opens a
  right Sheet titled Параметры (name, optional label, description, and a
  large Bot mark). A small pencil badge on the bottom-right corner of
  that mark stays visible for the Owner and opens appearance (flock and
  accent) in a modal, with Save. Flock tiles in that modal are square,
  including the selected frame. Accent swatches are smaller, and the
  palette is the same width as that flock grid.
  Model tier stays on Host
  Settings. Delete is not on this Sheet. Members may read the fields.
  Bubbles stay unlabeled. The composer stays on screen. Sidebar Bot
  rows and the Chat pill show the Manifest Bot mark (`KitBotAvatar`
  idle); the pill greets on open, listens at the composer, thinks while a
  reply is in flight, speaks and cheers it when it lands, tilts on a failed
  send, and sleeps while no key is set. The composer has a disabled
  attachments control and
  shows a send arrow when there is text. The thread keeps about 5rem
  (~80px) of clear space under the latest line when it is scrolled to
  the bottom. A circular control, centered above the composer, scrolls
  there when the thread is above the bottom. On a narrow screen the sidebar
  is a drawer. Sending a line shows it at once, then that Bot’s flock mark
  while the reply is in flight, then the stored reply. A green live dot
  marks the busy Bot on the Chat pill and the matching sidebar row. With no Bots, the main pane offers **Create a Bot**
  and the sidebar stays a short centered line. The `+` and that button open
  the picker as the Chat pane. **×** returns to the pane that was open.
  Creating a Bot opens that Chat. See
  [ADR 0014](adr/0014-host-messenger-shell.md),
  [ADR 0015](adr/0015-host-desktop-shell.md),
  [ADR 0016](adr/0016-bot-avatar-tokens.md),
  [ADR 0018](adr/0018-bot-mark-flock.md), and
  [ADR 0019](adr/0019-bot-picker-and-chat-purpose.md).
- Host routes: `/api/bots` CRUD, `/api/bots/:id/messages` list/post,
  `/api/search/messages` (Chat line search),
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
