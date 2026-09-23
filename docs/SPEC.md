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
| Pilot shape | Meal-like loop: Chat → button part → Kitchen Sheet. Not a Meal port. See [ADR 0026](adr/0026-kitchen-module-day-1.md). |
| Threads | One Thread; kinds `dm`, `group`, `bot`, `room` are labels. Bot visibility `shared` \| `private`. See [ADR 0024](adr/0024-threads-and-bot-visibility.md). Not current Host code. |

## This Host (create Bot + Chat)

What the running Cluster does today:

- Store (`@dostigus/db`): Drizzle schema + SQLite on `DATABASE_URL`. Tables
  `bots` (name, Manifest: `modelTier` default `strong`, `avatarShape`
  default `goose` (Bot mark), `avatarColor` default `#1F7AE5` /
  `--bot-accent-10`, optional `label` and `description` default empty,
  empty skills/modules),
  `messages` (`botId`, role `user` \| `assistant` \| `system`, content,
  and `parts_json` for assistant Kit parts — a button and a status;
  user and system stay `[]`),
  `kitchen_pantry` (name, optional qty), `kitchen_cooked` (label, XP,
  optional person id), and `kitchen_recipe` (one name and ingredients
  text),
  `llm_gateway` (Cluster LLM gateway: base URL, key server-side only,
  default Model tier, optional model overrides), `owners` (exactly one
  Cluster Owner: unique email and/or username, password hash, createdAt),
  and `members` (Household Members: display name, unique email and/or
  username, password hash, createdAt, disabledAt), and `invites`
  (Household Invite: token hash only, reserved email, expiry, the Owner
  who created it, used and revoked timestamps). User Chat lines store
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
  password. The Owner can also create an Invite for an email
  ([ADR 0023](adr/0023-household-member-invites.md)). The Host shows the
  Invite URL once so the Owner can copy it. The person opens
  `/invite/…` while logged out, sees that email, chooses a display name
  and password, and becomes a Member. The Host signs them in. A Member
  sees the same Bot list and Chat, without create,
  delete, Members, or Settings. Turning off sign-in keeps their name on
  the Chat line. Logged-out visitors cannot open those surfaces, except
  an Invite link. Host font is
  Nunito; charcoal canvas + firm coral-orange tokens
  ([`docs/ui.md`](ui.md)). The Kit Sheet shell (`KitSheet` drawer,
  `KitDialog` modal) and `KitButton` sit on Reka UI and those tokens.
  The Brand goose logo, stickers, and Bot marks live in the Kit. The Host
  mark uses the goose logo. With no Bots, the sidebar centers a short line
  and the main pane shows the wave sticker and **Create a Bot**. Add Member opens a Sheet. See
  [ADR 0013](adr/0013-kit-reka-ui-and-brand.md). On a wide screen the Host
  is a resizable sidebar of Bots beside Chat. The sidebar can collapse to
  an icon rail. Each expanded row shows an avatar, the Bot name, and the
  latest Chat line. On the icon rail each Bot’s hit target is a square.
  A loupe and a `+` sit at the top of the expanded sidebar, both quiet
  icon buttons with no accent fill. On the icon rail they stack at the
  bottom, above the user mark: loupe, then `+`, then the user.
  The loupe opens a centered search Sheet with no title and no close
  control: a field with a loupe and the placeholder Поиск, then rows for
  Bot names, Chat lines, and Host settings that person can open. Escape,
  the overlay, and choosing a row dismiss it.
  The `+` opens
  the Bot picker. A user button opens Settings (`/settings`), Members
  (`/members`), and Sign out. Chat overlays a centered pill on the thread:
  avatar and name, translucent, so lines scroll under it. A top inset about
  the pill’s height keeps the first line clear of the pill when the thread
  is at the top. There is no full-width header bar. At rest the pill is
  only the mark and the name, with the same inset on both sides, a little
  roomier than a tight crop.
  Hover or focus fades an arrow in on the trailing side and the pill grows
  to fit it, with padding still sitting past that arrow. The pill opens a
  right Sheet titled Параметры (name, optional label, description, and a
  large Bot mark). The Owner opens appearance by clicking that mark or
  the small pencil badge on its bottom-right corner. The badge stays
  visible. Appearance (flock and accent) opens in a modal, with Save.
  Flock tiles in that modal are square,
  including the selected frame. Accent swatches are smaller, and the
  palette is the same width as that flock grid.
  Model tier stays on Host
  Settings. Delete is not on this Sheet. Members may read the fields.
  Bubbles stay unlabeled. Assistant bubbles render a safe Markdown subset
  (bold, italic, code, lists, and http(s) links) through `KitMarkdown`.
  An assistant line may also carry Kit parts under that body: a button
  that opens a registered Sheet (`KitSheet`), and a status chip. User
  and system bubbles stay plain pre-wrap text and have no parts. See
  [ADR 0022](adr/0022-chat-assistant-markdown.md) and
  [ADR 0025](adr/0025-chat-bubble-parts.md). Sheet id `kitchen` opens the
  Kitchen Module: pantry, one recipe, and a cooked log with an XP
  counter, in a `KitSheet`. See
  [ADR 0026](adr/0026-kitchen-module-day-1.md). The composer stays on screen. Sidebar Bot
  rows and the Chat pill show the Manifest Bot mark (`KitBotAvatar`
  idle); the pill greets on open, listens at the composer, thinks while a
  reply is in flight, speaks and cheers it when it lands, tilts on a failed
  send, and sleeps while no key is set. The composer has a disabled
  attachments control and
  shows a send arrow when there is text. The thread keeps about 5rem
  (~80px) of clear space under the latest line when it is scrolled to
  the bottom. A circular control, centered above the composer, scrolls
  there when the thread is above the bottom. On a narrow screen the sidebar
  is a drawer. Sending a line shows it at once. While the LLM gateway is
  configured and the reply is in flight, the thread shows one activity row
  under the latest line: a green three-dot wave and «Печатает…». The row
  hides when the assistant line lands. With no key, that wait keeps the
  flock mark in `think` and does not say «Печатает…». The same row can show
  an orange cluster and «Ожидает завершения команды», or a small Bot mark
  and «Подключается…» («Подключается к {name}» when a short target is
  known). The message route does not report tool-loop phases, so those two
  rows are forced only in local `nuxt dev` (`?activity=command`,
  `?activity=connect`, optional `&target=`). Composer focus stays on the
  pill and does not add a thread row. The Chat pill still thinks, speaks,
  and cheers. A green live dot
  marks the busy Bot on the Chat pill and the matching sidebar row. With no Bots, the main pane offers **Create a Bot**
  and the sidebar stays a short centered line. The `+` and that button open
  the picker as the Chat pane. **×** returns to the pane that was open.
  Creating a Bot opens that Chat. See
  [ADR 0014](adr/0014-host-messenger-shell.md),
  [ADR 0015](adr/0015-host-desktop-shell.md),
  [ADR 0016](adr/0016-bot-avatar-tokens.md),
  [ADR 0018](adr/0018-bot-mark-flock.md),
  [ADR 0019](adr/0019-bot-picker-and-chat-purpose.md), and
  [ADR 0021](adr/0021-chat-activity-status.md).
- Host routes: `/api/bots` CRUD, `/api/bots/:id/messages` list/post,
  `/api/search/messages` (Chat line search),
  `/api/members` list/create and `/api/members/:id/disable`,
  `/api/members/invites` list/create and
  `/api/members/invites/:id/revoke` and `…/rotate` (Owner),
  public `/api/invites/:token` read/accept,
  `/api/settings/llm-gateway` get/put/ping, `/api/chat/ready` (configured
  flag only), `/api/kitchen` read and `/api/kitchen/pantry`,
  `/api/kitchen/cooked`, `/api/kitchen/recipe` (Owner or Member). Persist
  in SQLite via the same Store helpers as the MCP
  surface. Bot list, Bot read, Chat, and Kitchen accept an Owner or Member session.
  Bot create/update/delete, Members (including Invite create, list, revoke,
  and rotate), and Settings require the Owner. Accepting an Invite is
  public while logged out. See
  [ADR 0008](adr/0008-host-store-routes.md).
- MCP surface: `@nuxtjs/mcp-toolkit` at `/mcp` (name `Dostigus`). File-based
  tools under `apps/web/server/mcp/tools/` wrap Bots, Chat messages, and
  the Kitchen Module (pantry list/add, mark cooked, recipe get/save).
  Kitchen tools are not in the Chat LLM loop.
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
- No seed/demo domain Bot. No Builder or Meal port. Preview
  `?kitchen=1` is local tooling, not a domain Bot. Household on this Host is
  the Owner plus Members ([ADR 0012](adr/0012-household-members.md)),
  including Invites the Owner copies by hand
  ([ADR 0023](adr/0023-household-member-invites.md)).
- Person Threads (`dm`, `group`, `room`) and Bot visibility (`shared` |
  `private`) are decided in
  [ADR 0024](adr/0024-threads-and-bot-visibility.md). They stay out of
  this Host until that ADR's later milestones. Bubble parts are in
  this Host ([ADR 0025](adr/0025-chat-bubble-parts.md)). Today the Host
  still has one Chat timeline per Bot and no visibility field. The Owner
  still creates and deletes every Bot. An Invite still does not change
  visibility.

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
- Share link, guests, QR
- Person Threads (`dm`, `group`, `room`) and Bot visibility. Decided in
  [ADR 0024](adr/0024-threads-and-bot-visibility.md). Bubble parts shipped
  in [ADR 0025](adr/0025-chat-bubble-parts.md). The Kitchen Module
  day-1 seed is in this Host
  ([ADR 0026](adr/0026-kitchen-module-day-1.md)). Still later: visibility
  and per-person bot-threads, then `dm` / `group` / `room`
- Sending an Invite by SMTP (the Owner copies the link)
- Roles beyond Owner and Member, hard-delete of a Member
- OAuth, passkeys, email verify, password reset
- Mobile native
- Per-bot domains (the `meal.kosarev.space` pattern is temporary and to be replaced)
- Arbitrary in-cluster sandbox code
- Full Card catalog inside a bubble (tables, forms). A button and a
  status chip on an assistant bubble are
  [ADR 0025](adr/0025-chat-bubble-parts.md). Assistant Markdown stays
  [ADR 0022](adr/0022-chat-assistant-markdown.md)
- Managed/cloud hosting (optional later; not the default)

## Success for later MVPs (not this PR)

A self-hosted Cluster that can install a declarative Bot, chat with it, and open
a Sheet that reads/writes through the same MCP surface.
