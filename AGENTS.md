# Project memory — Dostigus

## Before you write code

1. Read [`docs/SPEC.md`](docs/SPEC.md) and the ADR index in [`docs/adr/README.md`](docs/adr/README.md).
2. Use glossary terms from [`CONTEXT.md`](CONTEXT.md) only.
   **Dostigus, Platform, Cluster, Owner, Member, Host, Chat, Card, Sheet, Kit,
   Brand, Sticker, Sheet shell, Bot, Orchestrator, Builder, Skill, Manifest,
   Module package, Store, Artifact, MCP surface, Job, Apply, LLM gateway,
   Provider, Policy, Model tier, Household, Share link, Dashboard.**
   Prefer **Host** (Host shell is a synonym). Prefer **MCP surface** (MCP
   contract is its interface definition). A Bot is not a Module package. Avoid
   bare “cloud agent” — use Builder. Do not invent synonyms. All repo docs are
   **English only**.
3. Stay inside SPEC scope. Do not implement agent runtime, Meal port, Builder
   Module-package writer, marketplace, Share link, or guests. Household
   Members on one Host are in scope
   ([ADR 0012](docs/adr/0012-household-members.md)): the Owner adds Members;
   Members use Bot list and Chat. Settings, Bot create/delete, and Members
   stay with the Owner. The Cluster has one Owner
   ([ADR 0010](docs/adr/0010-owner-auth-session.md)).

## Before every commit

Install dependencies first. A cloud agent VM often has no `node_modules`
and no async install log. `CI=1 pnpm check` does not install them. From
the repo root:

```
pnpm install --frozen-lockfile
```

Then run and wait for a green:

```
CI=1 pnpm check
```

`pnpm check` starts with `scripts/ensure-installed.mjs`. When
`node_modules/.bin/eslint` is missing it exits immediately and prints
`pnpm install --frozen-lockfile`. It does not run lint until that binary
exists.

Pure-markdown commits (`docs/adr/`, CONTEXT, SPEC-only) do not need
`CI=1 pnpm check` when the working tree has no app/code changes. GitHub
Actions still runs `pnpm check` on those PRs. A docs-only diff
(`docs/**` and any `*.md`) skips the Host image job in
[`.github/workflows/ci.yml`](.github/workflows/ci.yml). Host-affecting
paths still build the image.

That is `lint` → typecheck → vitest → build. `CI=1` is the run that matches
GitHub Actions (Actions sets `CI` around `pnpm check` in
[`.github/workflows/ci.yml`](.github/workflows/ci.yml)). A bare
`pnpm exec eslint` in an editor or agent session can detect the editor and
skip rules. Do not treat that run as the check. Land a clean tree before
`git commit`. Prefer `CI=1 pnpm check:full` (`lint:fix` first) if style nits fire.

- Never `--no-verify` unless the user explicitly asks.
- Docs-only commits still need a clean working tree if app code changed.

Unit tests run from the **repo root**. Root `vitest.config.ts` includes
`packages/**/tests/unit/**` and `apps/**/tests/unit/**` relative to that
root, not a package directory. One file:

```
pnpm exec vitest run packages/shared/tests/unit/llm-gateway.test.ts
```

`apps/web/tests/unit/…` is the same pattern. Do not use
`pnpm --filter @dostigus/<pkg> exec vitest` for one-file runs. That cwd
is the package, the root globs miss, and vitest reports no tests.

## Workspace dependencies

Put a new dependency in the `catalog` map in
[`pnpm-workspace.yaml`](pnpm-workspace.yaml) first. Reference it from the
package manifest as `"catalog:"`. A direct version range (for example
`"^15.0.2"`) fails `CI=1 pnpm check`: the ESLint rule
`pnpm/json-enforce-catalog` rejects it.

To discard a probe dependency, revert `package.json` (and `pnpm-lock.yaml`
if it is dirty), then run `pnpm install`. Do not run
`pnpm remove --lockfile-only` (including
`pnpm remove -w <pkg> --lockfile-only`). That command rewrites the
`catalogs:` block in `pnpm-lock.yaml` and drops catalog entries that
[`pnpm-workspace.yaml`](pnpm-workspace.yaml) still declares and that
`apps/web` still uses. The lockfile diff is large and wrong.

## Host API patterns

Owner-only JSON routes live under `apps/web/server/api/`. Copy
[`apps/web/server/api/members/index.post.ts`](apps/web/server/api/members/index.post.ts)
for a write and `members/index.get.ts` for a read. Do not re-trace the
Owner session from middleware.

**Session gate.** `requireOwnerSession(event)` in
[`apps/web/server/utils/owner-session.ts`](apps/web/server/utils/owner-session.ts)
runs `requireHostSession` → `requireUserSession`. No session is **401**.
A Member session is **403** (`Only the Owner can change this`). A read
that only returns Store data uses `withOwnerStore(event, (store) => …)`,
which applies the same gate (`members/index.get.ts`,
`members/invites/index.get.ts`). Bot list and Chat use
`requireHostSession` / `withHostStore` so a Member can use them. Settings,
Bot create/delete, and Members stay on the Owner gate. The page gate is
[`apps/web/app/middleware/owner.global.ts`](apps/web/app/middleware/owner.global.ts):
`/members`, `/dashboard`, every `/dashboard/...` page, leftover
`/settings` redirects, and every `/settings/...` page send a Member to
`/` (`isOwnerPath` in
[`apps/web/app/utils/owner-paths.ts`](apps/web/app/utils/owner-paths.ts)).
Invite accept
(`/invite/…`, `/api/invites/:token`) stays public while logged out — those
handlers do not call `requireOwnerSession`.
[`apps/web/tests/unit/owner-routes.test.ts`](apps/web/tests/unit/owner-routes.test.ts)
fails `CI=1 pnpm check` when a new Owner route omits the gate or a public
Invite route grows one.

**Errors.** Household helpers throw `OwnerAuthError` (validation and
conflict) or `StoreError`. In the route `catch`, call
`throwOwnerAuthError(error)` from
[`apps/web/server/utils/owner-auth.ts`](apps/web/server/utils/owner-auth.ts).
It maps both classes to `createError({ statusCode, statusMessage })` and
rethrows anything else. `throwStoreError` maps only `StoreError`. Use it
when the helper does not throw `OwnerAuthError` (Settings, Member
disable). Keep this mapping. Do not add a second auth error type.

**Vitest memory Store.** Do not boot Nuxt to test Store behavior.
`openStore('file::memory:')` from `@dostigus/db`, push the handle onto an
array, and `close()` it in `afterEach`. Seed an Owner with `createOwner`
when the helper needs one. Password doubles in these tests are
`` async (password) => `hash:${password}` ``, not scrypt. Copy
[`apps/web/tests/unit/household.test.ts`](apps/web/tests/unit/household.test.ts)
(Members) or
[`apps/web/tests/unit/household-invites.test.ts`](apps/web/tests/unit/household-invites.test.ts)
(Invites).

## Adding a Store column

A new Store column is six edits. `openStore` applies `STORE_MIGRATIONS` in
[`packages/db/src/migrations.ts`](packages/db/src/migrations.ts). The SQL
file under [`packages/db/migrations/`](packages/db/migrations/) and
[`packages/db/migrations/meta/_journal.json`](packages/db/migrations/meta/_journal.json)
are the other two copies. Keep all three the same so a fresh Store and an
existing Store boot with the same columns.

Every Store migration commit updates those three together. That includes a
new column, a new table, and any other SQL. The commit adds the SQL file,
appends the matching `STORE_MIGRATIONS` entry, and appends one
`_journal.json` row whose `tag` is that entry's `id`. Do not land the SQL
file and the embedded statement while the journal is still on the previous
tag.
[`packages/db/tests/unit/migrations-journal.test.ts`](packages/db/tests/unit/migrations-journal.test.ts)
fails `CI=1 pnpm check` when the journal `tag`s, the `migrations/*.sql`
filenames, and the embedded `id`s are not the same list, in the same order.
The SQL file is the drizzle-kit copy and can contain `statement-breakpoint`
markers, so that check does not compare file bytes to the embedded statement.

Example: [`0009_message_parts.sql`](packages/db/migrations/0009_message_parts.sql)
([#59](https://github.com/dostigus/dostigus/pull/59)) added `messages.parts_json`.
Write the next column the same way, by hand. The same list applies to any
other table; names below are the `messages` case.

1. **Schema.** Add the column on the table in
   [`packages/db/src/schema.ts`](packages/db/src/schema.ts).
2. **MessageRecord.** Add the snake_case field on `MessageRecord` in
   [`packages/db/src/map.ts`](packages/db/src/map.ts). Map it in `toMessage`
   when Chat reads the field. On another table, use that table's record
   type in the same file.
3. **Every SELECT.** Add the column to every statement that lists that
   table's columns. On `messages`, that is the `SELECT` in `listMessages`
   and the `INSERT` in `insertMessageRow` in
   [`packages/db/src/queries.ts`](packages/db/src/queries.ts).
4. **SQL file.** Add `packages/db/migrations/NNNN_name.sql` in the
   migration commit. `NNNN` is the next index after the last journal
   `tag`.
5. **Embedded SQL.** Append that same statement to `STORE_MIGRATIONS` in
   the same commit. The `id` is the filename without `.sql`
   (`0009_message_parts`).
6. **Journal.** In that same commit, append one object to `_journal.json`:
   next `idx`, `version` `"6"`, `when` equal to the previous `when` plus
   `86400000`, `tag` equal to that `id`, `breakpoints` `true`. That
   journal file is the only file under `migrations/meta/`.

## Local preview (Host)

```
pnpm --filter @dostigus/web dev
```

Nuxt 4 on **http://localhost:3000/**. On a Cursor cloud agent VM, `nuxt dev`
often listens on IPv6 only: open **http://localhost:3000/**.
**http://127.0.0.1:3000** refuses the connection.

The Host is a Bot list + Chat. Press
**+** to create a Bot (default **New Bot**). **Dashboard** is Owner
chrome under `/dashboard/**` ([ADR 0038](docs/adr/0038-dashboard-chrome.md)):
Overview, Cluster settings, Providers, and Settings. Providers
(`/dashboard/providers`) holds the OpenRouter quality shelf, «Подробнее»
(full live catalog, per-tier pins, raw Policy), and health. Cluster
settings (`/dashboard/cluster`) holds the Cluster timezone, the Cluster
http allowlist, and the Locale switcher. Leftover `/settings` and
`/settings/...` redirect into Dashboard. The OpenRouter catalog is
`GET /api/settings/llm-gateway/providers/:id/catalog` (Owner session,
`?refresh=1` bypasses the ~24h Host cache). Store is SQLite
(`DATABASE_URL`, default `file:.data/cluster.sqlite` for local dev).
First visit creates the Cluster Owner; later visits sign in. The Owner opens
**Members** to add a Member (display name, email or username, password). A
Member signs in and uses Bot list and Chat. Dashboard stays with the Owner.

### Host UI / pane width

Chat, Threads, and Members sit in the Host sidebar + pane
([`layouts/host.vue`](apps/web/app/layouts/host.vue)). Dashboard uses its
own chrome ([ADR 0038](docs/adr/0038-dashboard-chrome.md),
[`layouts/dashboard.vue`](apps/web/app/layouts/dashboard.vue)): a grouped
left nav and a scrolling content column. There is no Host Bot list on
`/dashboard/**`.

Size container-query / two-column breakpoints against the **content
pane**, not the full viewport.

Measure from current CSS (16px root):

- Host sidebar default is **280px / 17.5rem**
 (`SIDEBAR_DEFAULT` in [`apps/web/app/utils/sidebar-width.ts`](apps/web/app/utils/sidebar-width.ts);
 CSS fallback `--sidebar-width` on [`HostSidebar.vue`](apps/web/app/components/HostSidebar.vue)).
- Dashboard left nav is **16rem**
 ([`apps/web/app/layouts/dashboard.vue`](apps/web/app/layouts/dashboard.vue)).
- Dashboard content (`.pane`) is the rest of the viewport and is the
 scroll container (title + sections). Horizontal padding is **1.75rem**
 each side on that column.

At **1440px** Dashboard content is about **70rem** (viewport minus the
Dashboard nav and padding). At **1280px** the same column is closer to
**60rem**. Below **46rem** the Dashboard nav stacks above the content
(`max-width: 46rem` on the Dashboard layout). The Host drawer breakpoint
(**52rem**) does not apply on Dashboard — that layout does not mount
the Bot sidebar.

Put `container-type` on a parent and `@container` rules on a **child**.
CSS ignores `container-type` on the element that uses `@container` — the
queried element is not its own container.

`/settings/providers` in [PR #132](https://github.com/dostigus/dostigus/pull/132)
is the example that burned screenshot rounds: a **60rem** two-column
breakpoint never fired at 1440px while Providers still sat inside the
Host pane. The live query is `@container (min-width: 54rem)` on a child
of `.providers`. On Dashboard that query fires at common desktop widths.

### Preview seed

Skip Owner sign-in and Create Bot when you only need Chat for a screenshot
or a smoke check:

```
pnpm preview:host
```

That starts `nuxt dev` with `DOSTIGUS_PREVIEW_SEED=1`. Then open
**http://localhost:3000/preview-seed** (use `localhost`, not `127.0.0.1`).
The route is **GET** and **HEAD**.

**GET** creates the preview Owner when the Store is empty, signs that
Owner in, ensures the fixture preview Bot (id `preview`, display name
**New Bot** until it is renamed, with its greeting), and redirects to
`/bots/preview`. A later visit reuses the same Owner and that Bot id.
Renaming the Bot does not create another Bot. A newer Bot in the Store
does not change the redirect. Navigate by id `preview`, not by the
display name.

For scroll and overlay screenshots, open
**http://localhost:3000/preview-seed?tall=1**. That GET adds a tall thread
of preview Chat lines on Bot `preview` once. Another visit with `?tall=1`
does not append again.

For a Kit button in an assistant bubble, open
**http://localhost:3000/preview-seed?parts=1**. That GET adds one
assistant line once: Markdown body, a status chip, and **Open demo**.
The button opens the **Demo sheet** (`KitSheet`). Another visit with
`?parts=1` does not append again. **HEAD** ignores `?parts=1`. See
[ADR 0025](docs/adr/0025-chat-bubble-parts.md).

For the Kitchen Sheet, open
**http://localhost:3000/preview-seed?kitchen=1**. That GET fills empty
Kitchen tables (pantry, one recipe, one cooked row) and adds one
assistant line once: a status **Kitchen** and **Open Kitchen**. The
button opens the Kitchen Sheet. Another visit does not append that line
again. **HEAD** ignores `?kitchen=1`. See
[ADR 0026](docs/adr/0026-kitchen-module-day-1.md).

For centered Skill / self-settings system lines, open
**http://localhost:3000/preview-seed?system=1**. That GET adds three
system Chat lines once on the Owner's bot-thread for Bot `preview`:
`Skill · notes · Keep short notes.`, `Skill · notes · Удалено`, and
`Бот · Field notes · учёба`. Plain content, no parts, same family as a
Wake. Compose with `?hold=1`, `?activity=`, and `?parts=1`. Another visit
does not append those lines again. **HEAD** ignores `?system=1`.

For a direct message and a room, open
**http://localhost:3000/preview-seed?rooms=1**. That GET signs in the
preview Owner, seeds the preview Member (same rows as `?threads=1`),
a direct message between them, and a room titled **Preview room** with
the shared preview Bot. The room line mentions that Bot (`@` plus its
name) and stores one assistant reply. It redirects to
`/threads/preview-room`. `?rooms=1&as=member` signs in the Member on
that same room. `?members=1` still wins and opens `/members`. **HEAD**
ignores `?rooms=1`. In a room, a Bot replies only when a line mentions
it: `@` plus the Bot's name. A line with no mention is stored and does
not call the LLM gateway. See
[ADR 0024](docs/adr/0024-threads-and-bot-visibility.md).

For Members and Invite screenshots, open
**http://localhost:3000/preview-seed?members=1**. That GET signs in the
same preview Owner and redirects to `/members` (a Member session cannot
open that page). `?hold=1` and `?activity=` are ignored when `members=1`
is set. **HEAD**
ignores `?members=1` and still answers **204** or **302** to
`/bots/preview` with no session cookie.

For Dashboard, open
**http://localhost:3000/preview-seed?settings=1**. That GET signs in the
same preview Owner and redirects to `/dashboard` (Overview). Timezone and
http allowlist are on Cluster settings (`/dashboard/cluster`). Account
Settings is `/dashboard/settings`. `?members=1` still
wins when both are set. **HEAD** ignores `?settings=1`.

For the Providers page with a saved OpenRouter key, open
**http://localhost:3000/preview-seed?providers=1**. When the Store has
no Provider and no legacy key, that GET saves the fixture OpenRouter
Provider (id `preview-openrouter`, key `sk-or-v1-preview-fixture`),
then redirects to `/dashboard/providers`. On `nuxt dev` with
`DOSTIGUS_PREVIEW_SEED=1`, the catalog route skips `GET /key` for that
fixture id only, so health is green and the shelf ranks the real
public OpenRouter list (the VM needs outbound HTTPS). The fixture key
is not a working key: a configured Chat reply on it fails like any
rejected key. Remove the Provider on the page to see the empty state.
`?members=1` still wins. **HEAD** ignores `?providers=1`.

When the Cloud Agent Secret `OPENROUTER_TEST_KEY` is present, prefer it
over that `?providers=1` `trustKey` fixture skip for real key-accepted /
key-rejected probes. The secret is test-only and rotatable. Never commit
the value. Do not create the secret from an agent — Nick adds it in
Cursor Cloud Secrets. A missing secret is expected until that lands
([#133](https://github.com/dostigus/dostigus/issues/133)).

For Bot grants and bot-threads, open
**http://localhost:3000/preview-seed?threads=1**. That GET signs in the
preview Owner, ensures a preview Member (username `preview-member`,
password `preview-member`), a grant for that Member on Bot `preview`,
a Bot id `preview-private` named **Private notes** created by the
Member, and one user line on the Owner's bot-thread and one
on the Member's bot-thread with Bot `preview`. It redirects to
`/` so the sidebar lists Bot `preview` and the Member's Bot.
**http://localhost:3000/preview-seed?threads=1&as=member** signs in that
Member and opens `/bots/preview` (the Member's bot-thread, not the
Owner's). The Owner opens `/bots/preview-private` on the Owner's own
bot-thread (a greeting). The Member's lines stay on the Member's
bot-thread. A second visit does not append those lines. **HEAD** ignores
`?threads=1`. `?members=1` still wins when both are set.

On `nuxt dev`, the Chat thread can force the activity row without a live
reply: `/bots/preview?activity=thinking`, `?activity=tool`,
`?activity=typing`, `?activity=command`, or
`?activity=connect&target=Expi`. `command` uses the tool glyph and copy
(«Выполняет команду…»). A production Host ignores `activity`.
See [ADR 0021](docs/adr/0021-chat-activity-status.md).

`GET /preview-seed?activity=typing` signs in and redirects to
`/bots/preview?activity=typing`. The same allowlist is forwarded:
`thinking`, `tool`, `typing`, `command`, and `connect`. Connect keeps
`target` (`GET /preview-seed?activity=connect&target=Expi`). `hold` can
ride along: `GET /preview-seed?activity=typing&hold=1` lands on
`/bots/preview?hold=1&activity=typing`. `?members=1` still wins and
ignores `activity` and `hold`. Threads and rooms redirects do not keep
`activity`. **HEAD** ignores `activity`.

A configured reply keeps an in-memory Activity phase on
`(threadId, botId)`: **thinking** while waiting on the LLM,
**tool** while a Cluster MCP tool handler runs, then **typing** for
the final assistant text. The phase clears when the assistant line
lands or the reply errors. The open Thread polls
`GET /api/chat/activity` about every 400ms while that reply is pending
and stops on land, error, or leaving Chat. With no key, the thread
keeps the flock mark in `think` and shows no status line. It never
says «Печатает…». Production does not drive **connect** from the live
path.

To screenshot the real in-flight mark, open the Chat with `?hold=1` and
send a line. `GET /preview-seed?hold=1` signs in and redirects to
`/bots/preview?hold=1` (HEAD does not). On `pnpm preview:host` with no
key, that POST waits 12 seconds (`PREVIEW_QUIET_HOLD_MS`) before the quiet
reply is stored. The thread keeps the flock mark in `think`
(`aria-label="Replying"`) and the pill stays in `think` for that wait.
A production Host ignores `hold`. A configured gateway is not delayed.
`?activity=` still paints glyphs without this wait. Together,
`?hold=1&activity=typing` keeps the typing row up during the same quiet
POST. Do not edit `messages.post.ts` to add a delay.

**HEAD** (`curl -I`) is answered on `/preview-seed` and on `/health`. It
does not sign in, create the Owner, create a Bot, or insert Chat lines.

- `/health` GET and HEAD: **200**, `content-type: application/json`. The GET body is `{ ok: true }`. HEAD sends that body's `content-length` and an empty body.
- `/preview-seed` when this is not `nuxt dev`, or `DOSTIGUS_PREVIEW_SEED` is not `1`: **404**.
- `/preview-seed` when the Store Owner is not `preview`: **409**.
- `/preview-seed` when the gate is open and fixture Bot `preview` does not exist yet: **204** (GET would create it).
- `/preview-seed` when the gate is open and that Bot exists: **302** to `/bots/preview`, with no session cookie. The display name is not part of the lookup.

h3 turns `return null` after `setResponseStatus(event, 200)` into **204**
(`sendNoContent`). That 204 is easy to read as a closed route. HEAD
`/health` stays **200** because `apps/web/server/routes/health.head.ts`
sets `content-length` to the GET JSON byte length (pretty in `nuxt dev`,
compact in production) and ends the response with `event.node.res.end()`
instead of `return null`.

With `pnpm preview:host` already up, `pnpm smoke:preview` checks those
HEAD responses, that GET lands on `/bots/preview` (not a Bot chosen by
the name **New Bot**), that renaming the Bot does not create another
Bot, that `?tall=1` adds the tall thread once, that GET
`?members=1` lands on `/members` while HEAD ignores that query, and that
`?parts=1` adds one assistant line with a button once while HEAD ignores
that query, that `?kitchen=1` adds one Kitchen button once while
HEAD ignores that query, that `?system=1` adds three system Skill /
self-settings lines once while HEAD ignores that query, and that `?threads=1` lists Bot `preview` and the Member's Bot for the
Owner while `?threads=1&as=member` opens a different bot-thread on Bot
`preview`. HEAD ignores `?threads=1`. `?settings=1` lands on `/dashboard`; `?providers=1`
lands on `/dashboard/providers`; the catalog answers without the key; a
Member gets 403 on the catalog and 302 `/` on every `/dashboard/...`
and leftover `/settings/...` page. HEAD ignores `?providers=1`.
`?rooms=1` opens `/threads/preview-room` after seeding a direct message
and that room. HEAD ignores `?rooms=1`.
GET `?activity=typing` lands on `/bots/preview?activity=typing` while
HEAD ignores that query and does not set a session cookie.
Optional
`PREVIEW_SMOKE_URL` (default `http://localhost:3000`).

`pnpm check` runs those redirect decisions without `nuxt dev`:
`previewSeedRedirect` in
[`apps/web/tests/unit/preview-seed.test.ts`](apps/web/tests/unit/preview-seed.test.ts).
A preview redirect regression fails CI there. `pnpm smoke:preview`
stays the live HTTP check against a running preview Host.

With `pnpm preview:host` already up, capture one named preview state
(CDP against Chrome/Chromium already on the VM; no Playwright):

```
pnpm shoot:preview system
```

That opens `GET /preview-seed` with the state's query, waits for an
explicit ready marker (not network idle), and writes a PNG under
`.preview-shots/` (gitignored). One state per invocation. Named states:

| State | Seed | Ready marker | Viewport |
| --- | --- | --- | --- |
| `chat` | `/preview-seed` | `.bubble` | 1440×900 |
| `system` | `?system=1` | three `.bubble.system` | 1440×900 |
| `providers-empty` | `?settings=1` then `/dashboard/providers` | `.providers .add` | 1440×900 |
| `providers-fixture` | `?providers=1` | `.provider` and the shelf (cards or miss banner) | 1440×900 |
| `settings-other` | `?settings=1` then `/dashboard/cluster` | `.cluster input[name="timezone"]` | 1440×900 |
| `narrow` | `?settings=1` then `/dashboard/providers` | `.providers h1` | 390×844 |

`providers-empty` needs a Store with no Provider (a prior
`providers-fixture` on the same `DATABASE_URL` leaves the fixture;
use a fresh file or remove the Provider on the page). Optional
`PREVIEW_SMOKE_URL` (default `http://localhost:3000`),
`PREVIEW_SHOOT_DIR` (default `.preview-shots`), `CHROME_PATH`.
Missing Host prints a stderr hint to start `pnpm preview:host`.
Do not invent another `/tmp` CDP capture
([#106](https://github.com/dostigus/dostigus/issues/106)).

Turn journal harness (no screenshots). The preview Host and the smoke
share one MCP bearer. The fixed preview token is `preview-agent`:

```
NUXT_AGENT_TOKEN=preview-agent pnpm preview:host
NUXT_AGENT_TOKEN=preview-agent pnpm smoke:turns
```

`DOSTIGUS_MCP_TOKEN` is the alias when `NUXT_AGENT_TOKEN` is unset, on
both processes. When the smoke env is unset it sends Bearer
`preview-agent`. The Host process must have that same token. An empty
token leaves `/mcp` tools disabled. A call with no bearer fails the
same way while the token is set. The smoke signs in through
`/preview-seed`, posts one Chat line on Bot `preview` (quiet reply, no
LLM gateway key, no `?hold=1`), then calls `dostigus_turns_list` and
`dostigus_turns_get`. The quiet path writes `trigger` `user` and
`outcome` `ok`, one `thinking` phase, and no tools. Optional
`PREVIEW_SMOKE_URL` (default `http://localhost:3000`). See
[ADR 0029](docs/adr/0029-turn-journal.md).

Preview Owner: username `preview`, password `preview-owner`. Preview
Member (only after `?threads=1`): username `preview-member`, password
`preview-member`. A
production Host stays closed. If the Store already has a different Owner,
GET and HEAD return 409 — point `DATABASE_URL` at a fresh file (for example
`file:.data/preview.sqlite`) or sign in at `/login`. This is local preview
tooling. It does not add a domain Bot to the Cluster
([SPEC](docs/SPEC.md): no seed/demo domain Bot).

`pnpm preview:host` sets `devtools.enabled` to false, so
`nuxt-devtools-frame` is not mounted. That frame otherwise sits on the
Invite URL field and the Chat composer. A plain
`pnpm --filter @dostigus/web dev` still mounts it — hide the frame
before hit-testing those controls.

MCP surface
is `/mcp` — set `NUXT_AGENT_TOKEN` (or `DOSTIGUS_MCP_TOKEN`) to enable
HTTP tools; empty token leaves them disabled. The Turn journal smoke
uses the preview token `preview-agent` on that same bearer. That token
is not the Owner session (`NUXT_SESSION_PASSWORD`). Configured Chat
invokes the same tool handlers in-process (no HTTP `/mcp`; delete is
not a Chat tool). Turn journal list and get stay on `/mcp`.

Schedules are Store rows. Chat tools are `dostigus_schedules_list`,
`dostigus_schedules_create`, `dostigus_schedules_update`,
`dostigus_schedules_pause`, `dostigus_schedules_resume`, and
`dostigus_schedules_delete`, plus `dostigus_cluster_timezone_get`,
`dostigus_http_get`, and `dostigus_artifacts_put`
([ADR 0034](docs/adr/0034-artifacts.md)). There is no
`dostigus_artifacts_get`. On a configured turn, image Artifacts
on the triggering line may go as OpenAI content parts
([ADR 0035](docs/adr/0035-image-artifact-vision.md)). History
stays string `content` plus the Artifact meta note.
A Member may call those. `dostigus_cluster_timezone_set`,
`dostigus_cluster_http_allowlist_get`, and
`dostigus_cluster_http_allowlist_set` are Owner only.
The Owner sets the Cluster timezone and the Cluster http allowlist on
Settings. Host HTTP get is GET only, 64 KiB body cap with `truncated`,
and always blocks loopback, private, and link-local destinations
([ADR 0031](docs/adr/0031-host-http-get.md)). The Host process polls
due Schedules. See [ADR 0027](docs/adr/0027-bot-schedules.md).

Self-host compose (Store volume + published image): see [`docs/deploy.md`](docs/deploy.md).

```
docker compose -f docker/compose.yml up --build
```

## Friction report

Before finishing a pull request or a final report, include a short **Friction**
section. The same requirement is in
[`.cursor/rules/friction-report.mdc`](.cursor/rules/friction-report.mdc). It
applies to every Cursor agent on this repo (a Platform git agent, distinct
from Builder).

Required bullets (write “none” when a bullet is empty):

1. What took abnormally long, and why.
2. Hacks or workarounds.
3. Broken or misleading tooling, docs, CI, scripts, or paths to fix next.
4. What would make the same task about 2× faster next time.

Prefer honest process pain over a clean story. Do not skip the section because
`CI=1 pnpm check` is green.

## Commits

Conventional commits (`feat:`, `docs:`, `fix:`, `chore:`). Do not force-push
`main`.

Before editing `AGENTS.md` or `.cursor/rules` from `main`, or before basing
a docs or rules change on the tip of `main`, run `git fetch origin main`
(or otherwise refresh remote-tracking refs or the snapshot). A Cursor
cloud agent VM can start with a stale remote-tracking `main` while
`git status` says the branch is up to date. Fetch so that tip matches
GitHub, then branch.

Create a feature branch from current `main` with no upstream.
`git checkout -b feat/… origin/main` sets the upstream to `origin/main`, so a
later bare `git push` updates **main**. Create the branch locally, then push
an explicit feature ref:

```
git checkout -b feat/short-name
git push -u origin HEAD
```

To start from the remote tip without an upstream, use
`git checkout -b feat/short-name --no-track origin/main`, then the same push.
`git push -u origin <feature-branch>` is the same as `HEAD`. Leave the branch
untracked until that push.
