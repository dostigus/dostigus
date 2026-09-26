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
| LLM gateway | User keys; Model tiers `cheap` \| `strong` \| `code` (plus `toy`). Gateway shape + same-model retry: [ADR 0004](adr/0004-llm-gateway-tiers.md). Provider bind, resolve, escalate, OpenRouter Settings catalog: [ADR 0036](adr/0036-llm-providers-tier-resolve-escalate.md). |
| Self-host first | `docker compose up` is the intended path. See [ADR 0005](adr/0005-self-host-first.md). |
| Declarative modules | SQL + templated MCP before arbitrary sandbox. See [ADR 0006](adr/0006-day-1-declarative-modules.md). |
| Cluster store | Drizzle + SQLite day-1 (Postgres later is fine). |
| Pilot shape | Meal-like loop: Chat → button part → Kitchen Sheet. Not a Meal port. See [ADR 0026](adr/0026-kitchen-module-day-1.md). |
| Threads | One Thread; kinds `dm`, `group`, `bot`, `room` are labels. A Bot is personal to its creator. The Owner always sees it. Other people need an explicit grant (`bot_id` + `person_id`). Bot-threads, direct messages, groups, and rooms are in this Host. See [ADR 0024](adr/0024-threads-and-bot-visibility.md). |
| Schedules | Store rows that say when the Host wakes a Bot on that person's bot-thread. One Cluster timezone. The Host fires a Wake. See [ADR 0027](adr/0027-bot-schedules.md). |
| Self-settings | A Chat request that the Bot change its name, label, description, Skills, or Schedules writes the Store through the MCP surface. See [ADR 0028](adr/0028-bot-self-settings-via-chat.md). |
| Turn journal | Ops agents read Host Bot-turn meta (trigger, outcome, phases, tool names) through the MCP surface. See [ADR 0029](adr/0029-turn-journal.md). |
| Host HTTP get | MCP surface tool `dostigus_http_get` on Chat and Wake. Cluster http allowlist in Store settings. See [ADR 0031](adr/0031-host-http-get.md). |
| Cluster outbound | Two Cluster env paths: LLM uses `HTTPS_PROXY` / `HTTP_PROXY` when set; Bot HTTP egress uses `DOSTIGUS_HTTP_PROXY` (empty = direct). See [ADR 0033](adr/0033-cluster-outbound-llm-vs-bot-http-proxy.md). |
| Artifacts | Persisted Cluster file objects: volume bytes + Store meta + message join. Composer **+** uploads; send takes `artifactIds[]`. Chat slim and Wake gain `dostigus_artifacts_put`. No get tool. Image vision on the triggering line is [ADR 0035](adr/0035-image-artifact-vision.md). See [ADR 0034](adr/0034-artifacts.md). |
| Chat LLM context | System prompt is Manifest (including label and description) plus a Skill catalog (`id` + `description`). History is the last 40 lines (string `content` + Artifact meta note). The triggering user message may use OpenAI content parts. Chat tools start slim; keyword expand adds builder tools on that user turn only. Wake is narrower and has no expand. See [ADR 0032](adr/0032-chat-llm-context-assembly.md) and [ADR 0035](adr/0035-image-artifact-vision.md). |
| Chat Cards | The Host injects a Kit Card in the thread after a Schedule change, stored as assistant message parts. A successful Skill upsert or delete, or a Bot self-settings update of name, label, or description, appends one system Chat line (plain string, no parts). This monorepo ships no stock Module packages and no Weather seed. On Bot create the Host inserts missing meta Skills (insert-if-missing, constructor how-to) and does not call `upsertBotSkill`. See [ADR 0030](adr/0030-chat-cards-module-catalog.md). |
| Pack | Portable recipe, not a Bot and not a Module package. Export Pack from a live Bot is a scrubbed zip (`pack.json` + `skills/` + optional `schedules/` + optional `ui/` + optional README). Apply Pack from a local file shows a preview / plan, then writes onto an existing Bot or creates a new Bot. Imported Schedules land paused. Update does not wipe Chat. See [ADR 0039](adr/0039-pack-vs-bot-portable-recipe.md). |

## This Host (create Bot + Chat)

What the running Cluster does today:

- Store (`@dostigus/db`): Drizzle schema + SQLite on `DATABASE_URL`. Tables
  `bots` (name, Manifest: `modelTier` default `strong`, `avatarShape`
  default `goose` (Bot mark), `avatarColor` default `#1F7AE5` /
  `--bot-accent-10`, optional `label` and `description` default empty,
  optional `installed_pack_id` ref to an installed Pack snapshot
  (`installed_packs`, `author.slug@version`, [ADR 0039](adr/0039-pack-vs-bot-portable-recipe.md)),
  modules empty, meta Skills inserted on create when each id is absent
  ([ADR 0030](adr/0030-chat-cards-module-catalog.md)), `created_by` the
  Owner or Member who created it),
  `bot_grants` (`bot_id` + `person_id`; the creator and the Owner do not
  need a row, [ADR 0024](adr/0024-threads-and-bot-visibility.md)),
  `threads` (kind `dm`, `group`, `bot`, or `room`; `title` on a group or room)
  and `thread_participants` (a person or a Bot),
  `messages` (`botId` on a Bot's lines, empty on a person line in a dm,
  group, or room; `thread_id`; role `user` \| `assistant` \| `system`, content,
  and `parts_json` for assistant Kit parts — a button, a status, and a
  Chat Card;
  user and system stay `[]`),
  `kitchen_pantry` (name, optional qty), `kitchen_cooked` (label, XP,
  optional person id), and `kitchen_recipe` (one name and ingredients
  text),
  `llm_gateway` (Cluster LLM gateway: base URL, default Model
  tier, optional model overrides, Provider instances
  (`providers_json`; each holds its API key server-side) and
  Model tier → Provider + Policy binds
  (`tier_binds_json`)), `owners` (exactly one)
  Cluster Owner: unique email and/or username, password hash, createdAt),
  and `members` (Household Members: display name, unique email and/or
  username, password hash, createdAt, disabledAt), and `invites`
  (Household Invite: token hash only, reserved email, expiry, the Owner
  who created it, used and revoked timestamps). User Chat lines store
  `personId` (the Owner id or Member id). Host opens and migrates the
  Store on start. That open may insert meta Skills on a Bot that has
  none of the meta Skill ids. It does not overwrite a Bot that already has
  any of them.
- Owner auth: `nuxt-auth-utils` sealed cookie session. Fresh Cluster →
  `/onboarding` (email or username + password). Later visits → `/login`.
  Register is disabled once an Owner exists. Login accepts the Owner or a
  Member. Logout clears the session. See
  [ADR 0010](adr/0010-owner-auth-session.md) and
  [ADR 0012](adr/0012-household-members.md).
- Host UI: Bot list (empty state + `+` picker), Chat (timeline + composer,
  unlabeled bubbles), Settings, and Members.   Settings presents a
  Providers list (OpenRouter, OpenAI, or OpenAI-compatible). Casual
  OpenRouter is paste key → meta free / auto.   Dashboard is Owner chrome under `/dashboard/...`
  (Overview, Cluster settings, Providers, Members, Settings). Those
  routes use their own chrome (grouped nav + scrolling
  content), not the Host Bot list
  ([ADR 0038](adr/0038-dashboard-chrome.md)). There are no
  `/settings` page routes. The four-tier
  bind stays in the Store; the live catalog shelf, Advanced pin, and
  Settings health are
  [ADR 0036](adr/0036-llm-providers-tier-resolve-escalate.md). Cluster
  settings (`/dashboard/cluster`) holds the Cluster timezone and the
  Cluster http allowlist. Settings stays with the Owner.
  Legacy “tier = raw model string” Settings still resolve.
  The `+` replaces the Chat pane with a picker
  ([ADR 0019](adr/0019-bot-picker-and-chat-purpose.md)). Search there
  filters Bots by name. The Owner and a Member both have a row **Create new Bot**.
  It stores a Bot named **New Bot** with a random flock mark and accent,
  personal to that creator, then opens that Chat. The Owner sees every Bot,
  including a Member-created Bot, in the sidebar. A Member sees Bots they
  created and Bots granted to them. Creating a Bot (or
  first open of that person's bot-thread) stores an assistant greeting. Until the first user message,
  Chat shows a purpose Card: Personal, Work, Learning, Other, or free text.
  That answer is a normal Chat line. Purpose is not a Manifest field.
  The Owner adds a Member with a display name, email or username, and
  password. The Owner can also create an Invite for an email
  ([ADR 0023](adr/0023-household-member-invites.md)). The Host shows the
  Invite URL once so the Owner can copy it. The person opens
  `/invite/…` while logged out, sees that email, chooses a display name
  and password, and becomes a Member. The Host signs them in. A Member
  uses Bot list and Chat. They may create a Bot. They may edit and delete
  a Bot they created. They do not open Members or Settings. They do not
  edit a Bot they were only granted. Turning off sign-in keeps their name on
  the Chat line and leaves their Bots for the Owner to see. Grant rows stay. Logged-out visitors cannot open those surfaces, except
  an Invite link. Host font is
  Nunito; charcoal canvas + firm coral-orange tokens
  ([`docs/ui.md`](ui.md)). The Kit Sheet shell (`KitSheet` drawer,
  `KitDialog` modal) and `KitButton` sit on Reka UI and those tokens.
  The Brand goose logo, stickers, and Bot marks live in the Kit. The Host
  mark uses the goose logo. With no Threads, the sidebar centers a short line
  and the main pane shows the wave sticker, **Create a Bot**, and **Создать групповой чат**. Add Member opens a Sheet, including from the sidebar `+`. See
  [ADR 0013](adr/0013-kit-reka-ui-and-brand.md). On a wide screen the Host
  is a resizable Threads inbox beside Chat. The sidebar can collapse to
  an icon rail. Each expanded row shows an avatar, the Thread title
  (**DM**, **Group**, or **Room** on those kinds), and the latest line. A bot-thread row opens `/bots/:id`. A
  direct message, group, or room opens `/threads/:id`. On the icon rail
  each row’s hit target is a square.
  A loupe and a `+` sit at the top of the
  expanded sidebar, quiet icon buttons with no accent fill. The `+` opens
  one menu: **Найти или создать Bot** (the Bot picker), **Написать лично**
  (a direct message), **Создать групповой чат** (Household people, and
  Bots the current person can open), and, for the Owner, **Добавить
  Member** (Invite, or add a Member with a password). That group item is
  the only group create entry. People alone store a `group`. At least one
  Bot stores a `room`. There is no separate new-thread control on the
  rail. On the
  icon rail the loupe and `+` stack at the bottom, above the user mark:
  loupe, then `+`, then the user.
  The loupe opens a centered search Sheet with no title and no close
  control: a field with a loupe and the placeholder Поиск, then rows for
  Bot names, Chat lines, and Host settings that person can open. Escape,
  the overlay, and choosing a row dismiss it.
  The `+` opens that menu. **Найти или создать Bot** opens
  the Bot picker. A user button opens Settings
  (`/dashboard/settings`), Members
  (`/dashboard/members`), and Sign out. Chat overlays a centered pill on the thread:
  avatar and name, translucent, so lines scroll under it. A top inset about
  the pill’s height keeps the first line clear of the pill when the thread
  is at the top. There is no full-width header bar. At rest the pill is
  only the mark and the name, with the same inset on both sides, a little
  roomier than a tight crop.
  Hover or focus fades an arrow in on the trailing side and the pill grows
  to fit it, with padding still sitting past that arrow. The pill opens a
  right Sheet titled Параметры (name, optional label, description, who
  may open the Bot, a large Bot mark, a «Расписания» block for that
  person's Schedules on this Bot, and Export Pack / Apply Pack).
  Schedules on that Sheet are Store rows, not Manifest fields. Pack
  Apply always shows a preview / plan before write
  ([ADR 0039](adr/0039-pack-vs-bot-portable-recipe.md)).
  ([ADR 0020](adr/0020-bot-closet.md),
  [ADR 0027](adr/0027-bot-schedules.md)). The creator and the Owner open
  appearance by clicking that mark or
  the small pencil badge on its bottom-right corner. The badge stays
  visible. Appearance (flock and accent) opens in a modal, with Save.
  Flock tiles in that modal are square,
  including the selected frame. Accent swatches are smaller, and the
  palette is the same width as that flock grid.
  Model tier stays on Host
  Settings. Delete is not on this Sheet. The creator and the Owner edit
  the Manifest on this Sheet and share the Bot with Household Members
  (**Кто видит**, including **Всем текущим**). A grantee reads the Sheet
  and chats. A later Invite does not receive those grants.
  [ADR 0024](adr/0024-threads-and-bot-visibility.md).
  Bubbles stay unlabeled. Assistant bubbles render a safe Markdown subset
  (bold, italic, code, lists, http(s) links, and GFM tables) through
  `KitMarkdown`. A valid GFM table (header row plus a `|---` separator)
  is a real table. A wide table scrolls horizontally in the bubble; cell
  text may wrap. A lone or malformed `|` stays plain text.
  An assistant line may also carry Kit parts under that body: a button
  that opens a registered Sheet (`KitSheet`), and a status chip. User
  and system bubbles stay plain pre-wrap text and have no parts. See
  [ADR 0022](adr/0022-chat-assistant-markdown.md) and
  [ADR 0025](adr/0025-chat-bubble-parts.md). A line may join Artifacts
  (image thumb via session GET; PDF / text chip). Those refs are the
  Store join, not `parts_json`. Raw `<img>` and Markdown images stay
  forbidden ([ADR 0034](adr/0034-artifacts.md)). A Chat Card (`kind: card`)
  for a Schedule change is stored on that assistant line. A Skill
  upsert or delete, and a Bot self-settings update of name, label, or
  description, append a system Chat line (plain string, no parts). See
  [ADR 0030](adr/0030-chat-cards-module-catalog.md). Sheet id `kitchen` opens the
  Kitchen Module: pantry, one recipe, and a cooked log with an XP
  counter, in a `KitSheet`. See
  [ADR 0026](adr/0026-kitchen-module-day-1.md). The composer stays on screen. Sidebar Bot
  rows and the Chat pill show the Manifest Bot mark (`KitBotAvatar`
  idle); the pill greets on open, listens at the composer, thinks while a
  reply is in flight, speaks and cheers it when it lands, tilts on a failed
  send, and sleeps while no key is set. The composer **+** attaches
  Artifacts ([ADR 0034](adr/0034-artifacts.md)): pick, window
  drag-drop, or paste → upload → pending chips → Send with
  `artifactIds`. A send arrow shows when there is text or a pending
  Artifact. The thread keeps about 5rem
  (~80px) of clear space under the latest line when it is scrolled to
  the bottom. A circular control, centered above the composer, scrolls
  there when the thread is above the bottom. On a narrow screen the sidebar
  is a drawer. Sending a line shows it at once. While the LLM gateway is
  configured and the viewer’s own reply is in flight, the thread shows one
  activity row under the latest line: a glyph and a short Russian Nunito
  line. That line uses a soft gradient sweep so the wait reads as in
  progress. `prefers-reduced-motion` holds the glyph still and replaces
  the sweep with a subtle opacity pulse. Phases on that same row: thinking (flock mark in `think`,
  «Думает…») while waiting on the LLM before or between tool rounds; tool
  (orange cluster pulse, «Выполняет команду…») while a Cluster MCP tool
  call is running; typing (green three-dot wave, «Печатает…») while the
  model produces the final assistant text. The row does not name the tool
  or show a model-authored status. It hides when the assistant line lands,
  and on error or abort (the error stays in the assistant bubble). With no
  key, that wait keeps the flock mark in `think`, shows no status line, and
  never says «Печатает…». Connect is a preview row only
  (`?activity=connect`, optional `&target=`). Production does not drive
  connect from the live path. Local `nuxt dev` may also force
  `?activity=thinking`, `?activity=tool`, `?activity=typing`, or
  `?activity=command` (`command` uses the tool glyph and copy). A
  production Host ignores `activity`. The open Thread polls a cheap
  session-gated activity endpoint about every 400ms while that reply is
  pending, and stops on land, error, or leaving Chat. The client may hold
  a phase about 300ms so the row does not flicker. Phase state is
  in-memory on the Host, keyed by Thread and Bot, for bot-threads and
  rooms. That set also appends the phase onto the open Turn
  ([ADR 0029](adr/0029-turn-journal.md)). The poll does not read the
  Turn journal. The message route still returns one finished assistant line.
  The Chat pill flock stays in `think` for the whole in-flight reply; the
  row is the phase. Composer focus stays on the pill and does not add a
  thread row. The pill still speaks and cheers when the line lands. A
  green live dot
  marks the busy Bot on the Chat pill and the matching sidebar row. With no Bots, the main pane offers **Create a Bot**
  and the sidebar stays a short centered line. That button, and **Найти или создать Bot** in the `+` menu, open
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
  Bot create, Manifest update, and delete accept an Owner or Member session
  and enforce grants: a Member creates a personal Bot and edits or
  deletes a Bot they created. The Owner may edit or delete any Bot.
  `GET` and `POST /api/bots/:id/grants` and
  `DELETE /api/bots/:id/grants/:personId` accept an Owner or the creator.
  A grantee cannot share or edit the Manifest.
  Members (including Invite create, list, revoke,
  and rotate) and Settings require the Owner. Accepting an Invite is
  public while logged out. See
  [ADR 0008](adr/0008-host-store-routes.md).
- MCP surface: `@nuxtjs/mcp-toolkit` at `/mcp` (name `Dostigus`). File-based
  tools under `apps/web/server/mcp/tools/` wrap Bots, Chat messages, and
  the Kitchen Module (pantry list/add, mark cooked, recipe get/save).
  Kitchen tools are not in the Chat LLM loop.
  Turn journal tools `dostigus_turns_list` and `dostigus_turns_get` use
  the same bearer. They are not in the Chat LLM loop. See
  [ADR 0029](adr/0029-turn-journal.md).
  Bearer `NUXT_AGENT_TOKEN` (or `DOSTIGUS_MCP_TOKEN`); empty token → tools
  stay disabled. Soft auth (no 401). The MCP token is **not** the Host
  Owner session. See
  [ADR 0009](adr/0009-mcp-toolkit-endpoint.md).
- LLM gateway: OpenAI-compatible client, Model tiers mapped to
  OpenRouter-friendly default model ids (legacy / compat pin; live
  Clusters keep that read). Provider instances, tier bind / resolve,
  escalate, and the OpenRouter Settings catalog are
  [ADR 0036](adr/0036-llm-providers-tier-resolve-escalate.md).
  The Owner sets Providers and Model tier binds in
  Host Settings (Store) or via compose env (env overrides Store). Chat
  LLM context assembly is [ADR 0032](adr/0032-chat-llm-context-assembly.md):
  last 40 messages (`role` + `content`, stored `system` stays `system`),
  a system prompt with Manifest name/label/description/modelTier/
  skillIds/modulePackageIds and a Skill catalog (`id` + `description`),
  stay-on-Manifest / reply-briefly (not «You are new. Ask and learn…»).
  The impl PR lands that Host change. When a key is set, Chat also
  sends Cluster MCP surface tools and runs an in-process tool loop
  (same handlers as `/mcp`, no HTTP hop). Owner and creator-Member
  slim: messages list/create, all six Schedule tools, timezone get,
  Host HTTP get, `dostigus_artifacts_put`, Skills list and read.
  Keyword expand on that user
  line adds builder tools for the turn only (Owner: Bots
  list/get/create/update, Skills upsert/delete, timezone set,
  allowlist get/set; creator Member: `dostigus_bots_update` and
  Skills upsert/delete). Member grantee: messages, Schedule tools,
  timezone get, Host HTTP get, `dostigus_artifacts_put`, Skills
  list/read; no expand. Delete
  stays off Chat. Turn journal list and get stay on `/mcp` and off
  both Chat lists ([ADR 0029](adr/0029-turn-journal.md)). This loop
  does not gain a Module catalog tool, an Apply tool, or Weather
  tools. This monorepo ships no stock package
  ([ADR 0030](adr/0030-chat-cards-module-catalog.md)). Host HTTP get
  (`dostigus_http_get` on Chat and Wake, plus the Cluster http
  allowlist) is [ADR 0031](adr/0031-host-http-get.md). A Bot that
  needs a public forecast GETs an allowed API; the Platform does not
  seed Weather. No key → quiet reply + banner (no tools). A configured call
  retries once on a transient gateway failure (timeout, abort, network,
  HTTP 429, or HTTP 5xx). HTTP 429 waits briefly first. Activity stays
  on thinking. HTTP 401, HTTP 403, other 4xx, and an empty assistant
  body are not retried. The stored error is Russian: the Owner checks
  the key in Settings, sends the line again after a transient miss, or
  writes again after an empty body. A Member is pointed at the Owner
  for a key problem and can still send again after a transient miss.
  The error is not a stub. The
  full key is never returned to the client or written to logs. A log
  may name the status class (for example HTTP 429) and must not include
  the key, headers, or provider body. Greeting
  is always stored. Keys are **not** required for compose. See
  [ADR 0011](adr/0011-chat-mcp-tool-loop.md). Schedule tools are
  [ADR 0027](adr/0027-bot-schedules.md). Self-settings of name,
  label, description, and Skills is
  [ADR 0028](adr/0028-bot-self-settings-via-chat.md). See Self-settings.
- `/health` stays `{ ok: true }`.
- No seed/demo domain Bot. No Builder or Meal port. Preview
  `?kitchen=1` is local tooling, not a domain Bot. Household on this Host is
  the Owner plus Members ([ADR 0012](adr/0012-household-members.md)),
  including Invites the Owner copies by hand
  ([ADR 0023](adr/0023-household-member-invites.md)).
- Bot access is a personal Bot plus grants
  ([ADR 0024](adr/0024-threads-and-bot-visibility.md)). The creator can
  see it. The Owner always can, including a Member-created Bot with no
  grant. Anyone else needs an explicit grant (`bot_id` + `person_id`).
  There is no flag shared with future Members. Chat reads and writes the
  viewer's own bot-thread. The Owner opening a Bot they did not create
  uses the Owner's bot-thread and does not copy another person's lines.
  The Owner and Members may create a `dm`, a `group`, or a `room` from the sidebar `+`.
  **Создать групповой чат** is the only group entry. The picker lists Household people and Bots the current person can open. No Bot selected stores a `group`. A selected Bot stores a `room`, and that Bot stays selectable only when every chosen person can already open it.
  Adding a Bot requires every person participant to already have access.
  The add does not grant that access. In a `room`, a Bot replies only
  when the line mentions it:
  `@` plus the Bot's name, case-insensitive, with a space or the start
  of the line before `@`, and a space, the end of the line, or
  `. , ! ? ; :` after the name. The earliest `@` wins. When two names
  start at that same `@`, the longer name wins. One Bot replies per
  line. A line with no mention is stored and does not call the LLM
  gateway. `listen=all` is not in this Host. Preview `?rooms=1` seeds
  the preview Member, a grant for that Member on Bot `preview`, a direct
  message, and a room on that Bot (the room line mentions that Bot and
  stores one reply), then opens the room. `?rooms=1&as=member` signs in
  the Member on that room. HEAD ignores `?rooms=1`.
  Bubble parts are in
  this Host ([ADR 0025](adr/0025-chat-bubble-parts.md)).
  An Invite does not receive grants already made. A grantee's first open
  is empty plus the normal Host greeting. Adding a Bot to a room does not
  auto-grant, and a later Invite does not auto-receive Bots. Existing
  `messages` rows were placed on bot-threads when the old visibility
  column landed: a user row with `personId` keys that person's bot-thread;
  every other row follows the nearest preceding keyed user row on that
  Bot, or the Owner's bot-thread when none precedes it. This Host does
  not place those rows again. Migration `0013_bot_grants` turns former
  `shared` Bots into one grant per Member who existed then (not the
  creator) and drops `bots.visibility`. Former `private` Bots stay with
  the creator and the Owner.

`pnpm install` and `pnpm check` must stay green.

## Schedules

Decided in [ADR 0027](adr/0027-bot-schedules.md). This Host stores
Schedules and fires a Wake on that person's bot-thread. A
Schedule is not a Skill and not a Manifest field. A Schedule still
only provides the Wake. The Platform does not seed a Weather Module,
a weather Skill, or a weather API. Chat Cards after a Schedule change
are [ADR 0030](adr/0030-chat-cards-module-catalog.md). This Host injects
them on the assistant line.

- A Schedule is a Store row keyed by `(botId, personId)`: that person's
  bot-thread with that Bot. Many rows per person and Bot are allowed.
  Cadence is `daily` or `weekly`. `timeLocal` is `HH:MM` wall clock in
  the Cluster timezone. `daysOfWeek` is omitted for `daily` and lists
  the weekdays for `weekly`.   `name` is optional. `wakeText` is the
  string the Bot supplies (the current-turn LLM prompt). Empty name:
  the Host list falls back to truncated `wakeText`. The row is paused
  or enabled. The Host owns
  `next_run_at` and last-run metadata, and recomputes `next_run_at`
  after create, update, and fire.
- **Fire.** The Host writes a visible system Wake on that bot-thread
  whose text is the Schedule display name (same as the Schedules
  list). `wakeText` is sent to the LLM on that turn only and is not
  stored as Chat content. Then the Host starts a Bot turn
  ([ADR 0011](adr/0011-chat-mcp-tool-loop.md)). The Skill catalog
  matches a user turn. Wake tools are narrower than user slim (HTTP
  get, `dostigus_artifacts_put`, Skills list/read, Schedule list,
  messages list/create, timezone get). No Schedule writes, no
  `dostigus_bots_*`, no
  keyword expand ([ADR 0032](adr/0032-chat-llm-context-assembly.md)).
  The stored line is `system`. Later history sends that name as
  `role: system`. Activity phases apply
  ([ADR 0021](adr/0021-chat-activity-status.md)). Day-1 fires on a
  bot-thread only.
- **Catch-up.** If the Host was down or late, it fires once when
  lateness is less than 30 minutes from the planned time. Otherwise it
  skips to the next occurrence.
- **Busy.** If a reply for the same `(threadId, botId)` is already in
  flight, the Host defers this fire by one minute, at most five times,
  then skips. It does not run a parallel turn.
- **Ticker.** One Host process polls SQLite `next_run_at` about every
  30 seconds. Day-1 is a single node. There is no external cron worker.
- **MCP.** The Bot creates, lists, updates, pauses, resumes, and deletes
  with `dostigus_schedules_list`, `dostigus_schedules_create`,
  `dostigus_schedules_update`, `dostigus_schedules_pause`,
  `dostigus_schedules_resume`, and `dostigus_schedules_delete`. Text
  such as «каждое утро в 8:00…» is the Bot calling those tools. The
  Host does not parse it. Create and update accept optional `name`.
  That person manages rows for their bot-thread in their turn. The
  Owner can always manage. A revoked grant leaves the row; fires do
  not run until access is restored.
- **Host UI.** Closet Параметры holds a «Расписания» block under the
  Manifest fields ([ADR 0020](adr/0020-bot-closet.md)). Any person who
  can open the Bot sees their own rows on this Bot. Day-1 UI does not
  list another person's rows. Owner MCP scope for others stays above.
  List row: display name or truncated `wakeText`, plus a human cadence
  («каждый день · 08:00»). Paused rows are muted. `next_run_at` is not
  on the list. Pause is not a list toggle. Header **+** opens a create
  Sheet (optional `name`, daily|weekly + `timeLocal`, `daysOfWeek`
  when weekly, `wakeText`). After create, back to the list. Empty
  state: short text + **Добавить**. A row, or Chat Card **Изменить**,
  opens the same detail Sheet: Active / pause, cadence + time (+ days),
  `wakeText` (instruction), run history, danger **Удалить**. Run
  history is Turn journal rows with `trigger` `wake` and this
  `scheduleId` ([ADR 0029](adr/0029-turn-journal.md)). Empty copy:
  «Пока не было запусков». No new runs table. Writes go through the
  same Store handlers as `dostigus_schedules_*`. Cadence UI is daily or
  weekly plus wall clock. No free crontab. Chat Cards stay
  ([ADR 0030](adr/0030-chat-cards-module-catalog.md)).
- **Cluster timezone.** One IANA name in `cluster_settings.timezone`.
  The Schedule stores wall clock; the Host converts it for
  `next_run_at`. The default is `DOSTIGUS_TZ` when set, otherwise
  `UTC`. The Owner sets it in Host settings and with
  `dostigus_cluster_timezone_set`. A Member may call
  `dostigus_cluster_timezone_get` and may not set it. The Owner
  settings page has the field.

## Host HTTP get

Decided in [ADR 0031](adr/0031-host-http-get.md). This Host has the
tool, the Store field, and the Settings control.

- **`dostigus_http_get`.** GET only. Any Bot on its turn (Chat or
  Wake) may call it. The same in-process loop as the other Chat tools
  ([ADR 0011](adr/0011-chat-mcp-tool-loop.md)). The Host returns HTTP
  status and a body capped at 64 KiB. A longer body is truncated and
  marked `truncated`.
- **Cluster http allowlist.** `cluster_settings.http_allowlist`, the
  same settings family as timezone. Empty means allow all public
  hosts. A non-empty list is exact hostname match (host only, no
  path, no wildcards). The Owner gets and sets it through MCP and
  Owner Settings. Members do not set it.
- **SSRF.** Even on allow-all, the Host blocks loopback, private, and
  link-local destinations. The Host aborts a hung GET after 8 seconds
  (`HOST_HTTP_GET_TIMEOUT_MS`) so it cannot stall a turn. SSRF is the
  destination, not the Bot HTTP egress proxy host
  ([ADR 0033](adr/0033-cluster-outbound-llm-vs-bot-http-proxy.md)).
- **Bot HTTP egress.** Contract in
  [ADR 0033](adr/0033-cluster-outbound-llm-vs-bot-http-proxy.md).
  `dostigus_http_get` reads `DOSTIGUS_HTTP_PROXY` (empty = direct).
  It does not use `HTTPS_PROXY` or `EnvHttpProxyAgent`.
- **Not a weather package.** [ADR 0030](adr/0030-chat-cards-module-catalog.md)
  stays. A Bot that needs weather uses Host HTTP get against an
  allowed public API from a Skill or `wakeText`.
- **Pursue a usable result.** Soft text only. On a non-ok or unusable
  body the model calls `dostigus_http_get` again with a different
  public URL it chooses. It does not invent facts. If the turn has
  no usable GET, it says so. The Host does not retry other URLs and
  does not ship a provider list. See [ADR 0031](adr/0031-host-http-get.md).

## Cluster outbound

Decided in [ADR 0033](adr/0033-cluster-outbound-llm-vs-bot-http-proxy.md).
This Host uses two explicit outbound paths.

- **Two paths.** LLM proxy is `HTTPS_PROXY` / `HTTP_PROXY` when set
  (explicit `ProxyAgent` in the LLM client). Bot HTTP egress is
  `DOSTIGUS_HTTP_PROXY` (one URL for `http` and `https` targets).
  Unset Bot env is direct. Bot never inherits the LLM proxy.
- **Env only.** No Cluster Store field and no Settings UI on day-1.
- **Host-owned fetch.** The Platform does not use
  `NODE_USE_ENV_PROXY` / `EnvHttpProxyAgent` for the LLM client or
  Host HTTP get. If that env is set, the Host logs one startup warn
  and ignores it for those fetches.
- **SSRF.** Destination checks stay [ADR 0031](adr/0031-host-http-get.md).
  The proxy endpoint may be loopback or private.
- **Fail closed.** An invalid `DOSTIGUS_HTTP_PROXY` is a tool error,
  not a silent direct GET. No Bot `NO_PROXY` on day-1.

## Artifacts

Decided in [ADR 0034](adr/0034-artifacts.md). This section is the
contract. The impl PR lands the Host and Store change.

- **Artifact.** A persisted Cluster file object: Store meta plus
  bytes on volume `cluster-data` at
  `/var/lib/dostigus/artifacts/<uuid>`. An attachment is that
  Artifact on a Chat message (the join), not a second Store type.
  Refs are not `parts_json` ([ADR 0025](adr/0025-chat-bubble-parts.md)).
- **Limits.** UI upload ≤ 10 MiB; ≤ 3 Artifacts per message. Sniff
  allowlist: `image/*`, `application/pdf`, `text/plain`,
  `text/markdown`. Bot `put` base64 ≤ 1 MiB. Text extract ≤ 32 KiB.
  Cluster quota 512 MiB → HTTP 507. Pending (never joined) GC 24h.
  Incomplete multipart GC ~1h. Orphan bytes after unlink: lazy /
  cron GC. No silent LRU of joined blobs.
- **API.** `POST /api/artifacts` (session, multipart; optional
  `uploadId` + hash for idempotent retry). Send accepts
  `artifactIds[]`. `GET /api/artifacts/:id` needs session plus
  message capability (Thread ACL
  [ADR 0024](adr/0024-threads-and-bot-visibility.md) + join). Path
  jail on serve. No public or signed URLs.
- **Tools.** `dostigus_artifacts_put` on Chat slim and Wake
  (`filename`, `mime`, `bytesBase64` or `sourceUrl`). `sourceUrl`
  uses Host HTTP get SSRF / allowlist / Bot HTTP egress
  ([ADR 0031](adr/0031-host-http-get.md),
  [ADR 0033](adr/0033-cluster-outbound-llm-vs-bot-http-proxy.md)).
  Host auto-attaches to the current assistant message. No
  `dostigus_artifacts_get`. Current-turn text/* (and
  extractable PDF / text) injects ≤ 32 KiB or else meta. Image
  vision on the triggering line is
  [ADR 0035](adr/0035-image-artifact-vision.md).
- **UI.** Composer **+** / drag-drop / paste → pending chips →
  Send. Window drop uses depth tracking. Empty `FileList` must not
  steal a text paste. Long paste → chip. `image/*` thumb via
  session GET; PDF / text chip. Optimistic local object URL while
  upload runs.

## Image Artifact vision

Decided in [ADR 0035](adr/0035-image-artifact-vision.md). This
section is the contract. The impl PR lands the Host change.

- **Mechanism.** On a configured Bot turn, when the triggering
  line has image Artifacts, the Host may send native multimodal
  content on that user message in the same OpenAI-compatible
  `chat/completions` request. Wire: `{ type: "text", text }` plus
  `{ type: "image_url", image_url: { url: "data:image/jpeg;base64,…", detail: "auto" } }`.
  Not a describe-model call. Not `dostigus_artifacts_get`.
- **Which bytes.** Only Artifacts joined to the current
  triggering line (bot-thread user send, or a room mention that
  triggers the turn). History stays string `content` plus the
  Artifact meta note. Wake is unchanged.
- **Tool loop.** Those text + image parts stay on every
  completion round of that turn.
- **Wire transform.** Admission mime (sniffed): `image/jpeg`,
  `image/png`, `image/webp`, `image/gif`. Other `image/*` stay
  meta-only. Original bytes stay on the volume. LLM wire uses
  **sharp**: decode, max edge **2048**, JPEG quality **~80**. GIF
  → first frame. Per-file: JPEG wire **> 1.5 MiB**, or
  read/downscale failure → that Artifact is meta only; the turn
  continues.
- **Allowlist.** Case-insensitive substring on the resolved
  model id: `gpt-4o`, `gpt-4.1`, `gpt-5`, `claude-3`,
  `claude-4`, `claude-sonnet`, `claude-opus`, `gemini`,
  `gemini-flash`. Miss: soft — no image parts; meta note plus
  `Вложение-картинка есть; эта модель без vision — вижу только имя/размер.`
  Allowlisted modality / image error: one retry of that
  completion without image parts + that note; then the normal
  error path.
- **Text.** Meta note always stays in the text part. Empty user
  content with image Artifacts uses `"(изображение)"`.

## Chat LLM context

Decided in [ADR 0032](adr/0032-chat-llm-context-assembly.md). This
section is the contract. The impl PR lands the Host change. Until
then the running Host still injects full Skill bodies, remaps stored
`system` lines to `user`, and offers the wide Owner Chat tool list.

- **Catalog.** The system prompt lists each Skill as `id` +
  `description`. Full `instructions` load through
  `dostigus_skills_read`. `dostigus_skills_list` returns
  `{ id, description }[]` only. Upsert requires `description`
  (1–200). Store shape is `{ id, description, instructions }` in
  `bots.skills_json`. A legacy Skill with no description catalogs as
  `Skill {id}` until upsert.
- **History.** Last 40 messages (`role` + string `content`). Always
  include the triggering user or Wake line. On a firing turn the
  Wake line sent to the LLM is `wakeText`; stored Chat content is
  the Schedule display name
  ([ADR 0027](adr/0027-bot-schedules.md)). Stored `system` stays
  `role: system`. Chat Cards / `parts` and prior-turn tool
  transcripts stay out of that window. History may append the
  Artifact meta note. The triggering user message may use OpenAI
  content parts (`text` + `image_url`)
  ([ADR 0035](adr/0035-image-artifact-vision.md)).
- **System prompt.** Manifest line includes name, label, description,
  modelTier, skillIds, modulePackageIds. Stay-on-Manifest /
  reply-briefly. Not «You are new. Ask and learn…». Short Host
  rules stay (`CHAT_SELF_SETTINGS_RULE`, `CHAT_NO_PACKAGE_RULE`, a
  one-line HTTP hint if needed). Meta Skills stay catalog + read.
- **Slim.** Owner and creator-Member: messages list/create, six
  Schedule tools, timezone get, Host HTTP get,
  `dostigus_artifacts_put`, Skills list/read.
  Grantee: messages list/create, six Schedule tools, timezone get,
  Host HTTP get, `dostigus_artifacts_put`, Skills list/read. No
  Manifest write. No Skill write.
- **Expand.** Case-insensitive substring match on the current user
  line only (name / название / имя / rename, label / метка,
  description / описание, Skill / навык / skills, allowlist,
  Marketplace, timezone / таймзон*, настрой бота / параметры /
  self-settings). Owner expand adds Bots list/get/create/update,
  Skills upsert/delete, timezone set, allowlist get/set.
  Creator-Member expand adds `dostigus_bots_update` and Skills
  upsert/delete. Grantee does not expand. Wake does not expand.
  A miss means the person rephrases or uses the Closet / Sheet.
- **Wake.** Same catalog and `dostigus_skills_read`. Tools:
  `dostigus_http_get`, `dostigus_artifacts_put`, Skills list/read,
  `dostigus_schedules_list`, messages list/create, timezone get. No
  Schedule writes. No `dostigus_bots_*`.
- **Still never in Chat.** `dostigus_bots_delete`, Kitchen tools,
  Turn journal tools. There is no `dostigus_artifacts_get`
  ([ADR 0034](adr/0034-artifacts.md)).

## Self-settings

Decided in [ADR 0028](adr/0028-bot-self-settings-via-chat.md). This Host
injects the short platform Host rules on every Bot turn. Skills are
catalog + `dostigus_skills_read`
([ADR 0032](adr/0032-chat-llm-context-assembly.md)). A Member creator
receives `dostigus_bots_update` and Skills upsert/delete on that Bot
when keyword expand hits. A grantee does not receive Manifest or
Skill write tools and does not expand. The grantee prompt still
says not to rename. Member Chat slim is messages list/create,
Schedule tools, `dostigus_cluster_timezone_get`
([ADR 0027](adr/0027-bot-schedules.md)), Host HTTP get
([ADR 0031](adr/0031-host-http-get.md)), and Skills list/read. The
Host fires a Wake (narrower tools, same catalog). A missing
capability uses Skills upsert, Schedule tools, and Bot self-settings
already in Chat. The Platform does not seed a Weather Module or a
stock Module package. On Bot create it may insert meta Skills as
plain Skill text (catalog + read). Both are
[ADR 0030](adr/0030-chat-cards-module-catalog.md).

- **Write.** When a person asks the Bot to change itself (name, label,
  description, Skills, or Schedules), the Bot writes the Store through
  MCP surface tools. A reply that claims success without a successful
  tool result is wrong.
- **Platform rule.** The Host injects one short instruction into every
  Bot turn (Owner, Member, room mention, and Wake). It is not a
  Manifest field and not a Skill. It says Self-settings use the MCP
  surface, and the Bot must not assert success without a tool result.
  A Skill may add domain procedure. Rename, Schedule changes, and
  other self-edits are platform duty.
- **Manifest.** Day-1 uses the existing `dostigus_bots_update` for
  `name`, `label`, and `description` only. There is no second update
  tool. An empty name is rejected. Length limits stay the closet
  limits ([ADR 0020](adr/0020-bot-closet.md)). Label and description
  stay optional. `avatarShape` and `avatarColor` stay closet-only.
  `modelTier` stays Owner Settings and the existing MCP path. Delete
  of a Bot or of Chat stays off Chat
  ([ADR 0011](adr/0011-chat-mcp-tool-loop.md)).
- **Skills.** MCP tools `dostigus_skills_list`,
  `dostigus_skills_read`, `dostigus_skills_upsert`, and
  `dostigus_skills_delete` list, read, upsert, and delete Skill text
  on that Bot. That is not a Module package and not the Builder.
  Storage is `bots.skills_json`: a JSON array of
  `{ id, description, instructions }`. `Manifest.skillIds` is those
  ids. A legacy array of id strings still reads as ids with empty
  instructions and a catalog fallback `Skill {id}`. Upsert rewrites
  the column as objects and requires `description` (1–200). List
  returns `{ id, description }[]` only. Read returns the full object
  by id. No new table. A Skill id is letters, digits, `_`, or `-`.
  A dotted id is not a Skill id. `parseSkillId` in
  `packages/shared/src/skill.ts` checks that charset. There is no
  locale column. The system prompt is the catalog, not full bodies
  ([ADR 0032](adr/0032-chat-llm-context-assembly.md)). Meta Skill ids
  and insert-if-missing are
  [ADR 0030](adr/0030-chat-cards-module-catalog.md). That seed is in
  this Host. It writes a missing id only and does not call
  `upsertBotSkill` or `dostigus_skills_upsert`.
- **Schedules.** A request to create or change a Schedule is
  Self-settings, and the Bot calls the
  [ADR 0027](adr/0027-bot-schedules.md) tools. This section does not
  repeat that schema or the ticker. The Host does not parse the
  sentence.
- **Who.** Name, label, description, and Skills: the creator of that
  Bot, or the Owner. A grantee cannot. A Member who created the Bot
  must receive `dostigus_bots_update` and the Skills tools on that
  Bot, matching closet creator rights
  ([ADR 0024](adr/0024-threads-and-bot-visibility.md)), when keyword
  expand hits that user turn
  ([ADR 0032](adr/0032-chat-llm-context-assembly.md)). The "do not
  rename" Member prompt does not apply to that creator on their own
  Bot, or to the Owner. Schedules stay the
  [ADR 0027](adr/0027-bot-schedules.md) actors: the person on their
  bot-thread, and the Owner. A grantee may still manage those
  Schedules. The allowlist follows the viewer and that Bot on every
  turn kind. A Wake does not expand.
- **Confirm.** After a successful tool result, the Bot confirms the
  fact briefly. On failure, it reports the error and does not pretend.
- **Refresh.** After a successful `dostigus_bots_update` or Skills
  tool in a Host Chat turn, the Manifest shows in the Chat pill, the
  sidebar, and an open closet Sheet. `apps/web/app/pages/bots/[id].vue`
  already refreshes the Bot, the Bot list, and Threads when the
  message POST completes. Keep that. Do not require a full page
  reload. The name may stay the previous name while Activity is in
  flight. A raw `/mcp` write may leave an already-open Chat stale
  until the next refresh. That edge is acceptable for day-1.

## Turn journal

Decided in [ADR 0029](adr/0029-turn-journal.md). This Host records one
Turn per Host Bot Chat turn and exposes it on the MCP surface. Owner
Chat tools and Member Chat tools stay the lists in the LLM gateway
section above. Turn tools are not on those lists.

- A Turn is one Bot LLM tool loop, the same span as one Activity
  session. Trigger is `user` (a bot-thread line), `wake` (a Schedule
  fire, with `scheduleId`), or `mention` (a room line that names one
  Bot). A raw `/mcp` call does not create a Turn. A room line with no
  mention does not create a Turn.
- The row stores `threadId`, `botId`, `personId` (the viewer, and on a
  Wake the Schedule's person), `outcome` (`running`, then `ok`,
  `error`, or `abort`), `startedAt`, `endedAt`, optional `scheduleId`,
  optional `errorCode`, `phases_json`, `tools_json`, and optional
  `modelId`, `modelTier`, `visionParts`, `servedModelId`,
  `promptTokens`, `completionTokens`, `totalTokens`, and
  `llmCallCount`. `errorCode` is
  a short class such as `llm_error`, `tool_error`, or `aborted`. It is
  never model text and never a stack. Phases are `thinking`, `tool`,
  and `typing` with a time. Tools are `{ name, ok, ms }` in call order.
  `modelId` is the id sent after `resolveModelId`, not `response.model`.
  `servedModelId` is the last non-empty provider `response.model`.
  Token fields are Turn aggregates. Missing provider usage stays null,
  never zero. `visionParts` is whether image parts were actually
  included after the vision needles gate. The journal does not store
  message bodies, tool arguments, tool results, or prompts.
- The row is inserted at start (`running`), patched as phases and tools
  happen, and finalized with `endedAt` and the outcome. `modelId`,
  `modelTier`, and `visionParts` are patched early while still
  `running`, after `resolveModelId` and the vision needles gate. A
  Turn that dies before that resolve leaves them null.
  `servedModelId` and the token fields accumulate after each LLM
  completion while still `running`. The quiet / stub path is not an
  LLM completion and leaves those fields null. Finalize
  deletes Turns whose start is older than 7 days.
- Activity stays the in-memory poll
  ([ADR 0021](adr/0021-chat-activity-status.md)). Setting a phase also
  appends it on the open Turn. The poll does not read `turns`.
- MCP tools `dostigus_turns_list` and `dostigus_turns_get` use the same
  bearer as the other Host tools. Day-1 the token sees every Cluster
  Turn. List filters are `botId`, `threadId`, `since`, and `limit`
  (default 50, cap 100), newest first. Get is by id. Both always
  return `modelId`, `modelTier`, `visionParts`, `servedModelId`,
  `promptTokens`, `completionTokens`, `totalTokens`, and
  `llmCallCount` (null allowed).
  Day-1 does not add list filters on those fields and does not add
  a usage summary tool.
- Schedule detail lists journal rows with `trigger` `wake` and that
  `scheduleId` ([ADR 0027](adr/0027-bot-schedules.md)). Empty copy:
  «Пока не было запусков». That is not an Owner journal Sheet. Day-1
  does not add a runs table.
- The harness smoke is in this Host. `pnpm smoke:turns` needs
  `pnpm preview:host` with `NUXT_AGENT_TOKEN` (or `DOSTIGUS_MCP_TOKEN`)
  set to the same value the smoke sends. When that env is unset, the
  smoke sends Bearer `preview-agent`. It posts one quiet Chat line on
  Bot `preview` (no LLM gateway key) and reads that Turn through the
  two tools, including `modelId`, `visionParts`, `servedModelId`, and
  the token fields (null on the quiet fixture). See
  [`AGENTS.md`](../AGENTS.md).

## Chat Cards

Decided in [ADR 0030](adr/0030-chat-cards-module-catalog.md). This Host
injects Schedule Chat Cards. A successful Skill upsert or delete, and
a Bot self-settings update of name, label, or description, append one
system Chat line. This monorepo does not ship a stock Module package,
a `packages/modules/` seed, Host-bundled Apply, or an Open-Meteo
Module.

- **Chat Card.** A Kit Card in the thread, one assistant part of kind
  `card` on `messages.parts_json`. The card kind is `schedule`. The
  Host injects it after a successful `dostigus_schedules_create`,
  `dostigus_schedules_update`, `dostigus_schedules_pause`,
  `dostigus_schedules_resume`, or `dostigus_schedules_delete`. List
  injects a Card only with `intent: set` when an enabled row for that
  person and Bot already has the same cadence, local time, and
  weekdays. Create against that row does not insert another. The Card
  body is «уже стоит». One turn keeps one Schedule Card per Schedule
  id. Pause and Изменить open Sheet id `schedule` for that row — the
  same detail Sheet as the closet «Расписания» list
  ([ADR 0027](adr/0027-bot-schedules.md)). Delete confirms inside the
  Sheet. The model does not emit the part. There is no Card after
  Apply. There is no Card kind `skill` or `bot`.
- **Skill and self-settings lines.** After a successful
  `dostigus_skills_upsert`, `dostigus_skills_delete`, or
  `dostigus_bots_update` that sets name and/or label and/or
  description, the Host appends one system Chat line on that
  bot-thread. The line is plain text with no parts, the same family
  as a Wake. Upsert is `Skill · <id> · <first instruction line>` or
  `Skill · <id> · записан` when that line does not fit the part label
  cap. Delete is `Skill · <id> · Удалено`. A Bot update is
  `Бот · <name> · <label>` or `Бот · <name> · обновлено` when the
  label is empty or too long. `dostigus_skills_list`,
  `dostigus_bots_list`, and `dostigus_bots_get` write nothing. Avatar
  or Model tier alone writes nothing. There is no Sheet id `skill`
  from a Card, and no Изменить button on these lines. One success
  appends one line. A later success appends another.
- **Capability gaps.** Skills upsert, Schedule tools, and Bot
  self-settings already in Chat
  ([ADR 0028](adr/0028-bot-self-settings-via-chat.md)) close a missing
  capability. Day-1 does not add `dostigus_modules_catalog`,
  `dostigus_modules_apply`, or a platform rule that must Apply a
  matching stock package. A Marketplace of packages is later.
- **Meta Skills.** On Bot create the Host inserts Skill rows
  when each id is absent: `platform-meta-schedules`,
  `platform-meta-skills`, `platform-meta-self-settings`,
  `platform-meta-marketplace`, and `platform-meta-http-get`.
  Instructions are Russian markdown in
  the one `instructions` string. There is no English column. The text
  teaches Schedule tools (create, list, pause, edit; a fetch Wake
  `wakeText` should call `dostigus_http_get` and not invent numbers),
  Skills upsert, Bot self-settings, that domain Module packages come
  later through Marketplace (public HTTP still uses
  `dostigus_http_get`; still no Weather
  Module or weather Skill seed), and Host HTTP get
  (`dostigus_http_get`: build the URL yourself; a non-ok or
  unusable body means another public URL, not invented facts). It does
  not invent weather tools. Image upgrade
  may insert the set only on a Bot that has none of these ids. Stored
  instructions stay. The creator or the Owner may edit or delete them
  with the Skills tools. This seed is in this Host. It is
  insert-if-missing and does not call `dostigus_skills_upsert` or
  `upsertBotSkill`. It is not a Module package, not an MCP
  tool, and not `packages/modules/`. Chat Cards above stay
  Schedule-only. Skill and self-settings success is the system line
  in this section.

## Self-host (compose)

`docker compose -f docker/compose.yml up --build` serves the Host on port 3000
and mounts volume `cluster-data` for the Store and Artifact bytes
(`/var/lib/dostigus/artifacts/<uuid>`,
[ADR 0034](adr/0034-artifacts.md)). Image publishing is
`ghcr.io/dostigus/dostigus` (see [ADR 0007](adr/0007-platform-image-tags.md)
and [`docs/deploy.md`](deploy.md)).

## Out of scope (do not implement yet)

- Full agent runtime (parity with Grok Bot or otherwise)
- Meal product port
- Builder that writes Module packages (chat Bot ≠ Builder)
- Marketplace
- Share link, guests, QR
- `listen=all` on a room (a Bot replies to every line). Mention-gated
  replies are in this Host
  ([ADR 0024](adr/0024-threads-and-bot-visibility.md)). Bubble parts shipped
  in [ADR 0025](adr/0025-chat-bubble-parts.md). The Kitchen Module
  day-1 seed is in this Host
  ([ADR 0026](adr/0026-kitchen-module-day-1.md)).
- Sending an Invite by SMTP (the Owner copies the link)
- Durable memory across bot-threads, Skill proposals from grantees,
  and a Bot fork or clone (copy Skills without memory)
  ([ADR 0024](adr/0024-threads-and-bot-visibility.md), amended
  2026-09-24)
- Peeking another person's bot-thread, auto-grant when a Bot is added
  to a room, and auto-grant to a future Invite
- Roles beyond Owner and Member, hard-delete of a Member
- OAuth, passkeys, email verify, password reset
- Mobile native
- Per-bot domains (the `meal.kosarev.space` pattern is temporary and to be replaced)
- Arbitrary in-cluster sandbox code
- Full Card catalog inside a bubble (tables, forms). A button and a
  status chip on an assistant bubble are
  [ADR 0025](adr/0025-chat-bubble-parts.md). Schedule Chat Cards are
  [ADR 0030](adr/0030-chat-cards-module-catalog.md) and are in this Host.
  Skill and self-settings success is a system Chat line in that record.
  Assistant Markdown stays
  [ADR 0022](adr/0022-chat-assistant-markdown.md). Artifact thumbs
  are session GET, not Markdown images
  ([ADR 0034](adr/0034-artifacts.md))
- Streaming the assistant bubble token-by-token, MCP tool names or
  arguments on the activity row, and model-supplied status lines.
  The Activity poll stays in-memory
  ([ADR 0021](adr/0021-chat-activity-status.md), amended 2026-09-24).
  Turn journal phase meta is
  [ADR 0029](adr/0029-turn-journal.md). Skills packages stay out.
- A Turn journal Sheet, evals, storing message
  bodies or tool arguments or results or prompts on a Turn, reading
  Activity from the Turn journal, Schedule ticker debug tools, Owner
  Settings Usage UI, a Cluster usage ledger, MCP `usage.summary`,
  per-call usage rows, `cachedTokens`, and `costUsd`
  ([ADR 0029](adr/0029-turn-journal.md)). The Turn journal above, and
  the harness smoke `pnpm smoke:turns`, are in this Host.
- Full crontab; an interval of every N minutes; one-shot fires; wakes
  on a room, a direct message, or a group; an SSE ticker; a multi-node
  lease; listing other people's Schedules in the closet; a list pause
  toggle; a new runs table
  ([ADR 0027](adr/0027-bot-schedules.md)). The Schedule behavior above,
  including the closet «Расписания» block, is day-1 Host UI. The code
  PR adds that UI.
- History summary or compaction beyond the window of 40, persisting
  tool transcripts into Store history, and an LLM classifier for
  Chat tool expand
  ([ADR 0032](adr/0032-chat-llm-context-assembly.md)). Chat LLM
  context assembly above is the contract. The impl PR lands the
  Host change.
- Stock Module packages in this monorepo, a `packages/modules/` catalog
  seed, Host-bundled Apply of platform packages, baking packages into
  the Host image, and a Weather seed (including Open-Meteo). A
  Marketplace of packages is later (cloud product). Builder Jobs stay
  out. Chat Cards for Schedule changes are
  [ADR 0030](adr/0030-chat-cards-module-catalog.md) and are in this Host.
  Meta Skills on Bot create are in this Host. They are plain Skill
  text, not a stock Module package. A Schedule still only writes a Wake
  ([ADR 0027](adr/0027-bot-schedules.md)). Host HTTP get is
  [ADR 0031](adr/0031-host-http-get.md): a Bot may GET an allowed
  public API. That is not a Weather seed. POST, caller-supplied
  headers, auth passthrough, and streaming stay out.
- Appearance via Chat, Model tier via Chat self-settings, and delete of
  a Bot or of Chat via Chat. The Host parsing a sentence into a
  Manifest, Skill, or Schedule write. Pushing a raw `/mcp` write into
  an already-open Chat page. The Self-settings write above is in this
  Host ([ADR 0028](adr/0028-bot-self-settings-via-chat.md)).
- Managed/cloud hosting (optional later; not the default)
- Artifact S3 / remote blob store, signed or public download URLs,
  gallery / lightbox, virus scan, `dostigus_artifacts_get`,
  sandbox materialize / path-attach, content-addressed blob layout,
  a Member file-share UI separate from the Thread, Office / audio
  mime, and forever retention without quota
  ([ADR 0034](adr/0034-artifacts.md)). Artifacts above are the
  contract.
- Image Artifact vision for history-window messages, a separate
  describe-then-text model, Owner Settings «vision» toggle, signed
  or public image URLs, raw unscaled bytes to the provider, and a
  hard-fail when the model lacks vision
  ([ADR 0035](adr/0035-image-artifact-vision.md)). Triggering-line
  vision is in scope. The impl PR lands the Host change.

## Success for later MVPs (not this PR)

A self-hosted Cluster that can install a declarative Bot, chat with it, and open
a Sheet that reads/writes through the same MCP surface.
