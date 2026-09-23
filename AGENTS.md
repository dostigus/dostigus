# Project memory — Dostigus

## Before you write code

1. Read [`docs/SPEC.md`](docs/SPEC.md) and the ADRs in [`docs/adr/`](docs/adr/).
2. Use glossary terms from [`CONTEXT.md`](CONTEXT.md) only.
   **Dostigus, Platform, Cluster, Owner, Member, Host, Chat, Card, Sheet, Kit,
   Brand, Sticker, Sheet shell, Bot, Orchestrator, Builder, Skill, Manifest,
   Module package, Store, MCP surface, Job, Apply, LLM gateway, Model tier,
   Household, Share link.**
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

From the repo root, **always** run and wait for a green:

```
CI=1 pnpm check
```

That is `lint` → typecheck → vitest → build. `CI=1` is the run that matches
GitHub Actions (Actions sets `CI` around `pnpm check` in
[`.github/workflows/ci.yml`](.github/workflows/ci.yml)). A bare
`pnpm exec eslint` in an editor or agent session can detect the editor and
skip rules. Do not treat that run as the check. Land a clean tree before
`git commit`. Prefer `CI=1 pnpm check:full` (`lint:fix` first) if style nits fire.

- Never `--no-verify` unless the user explicitly asks.
- Docs-only commits still need a clean working tree if app code changed.

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
`/members` and `/settings` send a Member to `/`. Invite accept
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

## Local preview (Host)

```
pnpm --filter @dostigus/web dev
```

Nuxt 4 on **http://localhost:3000/**. On a Cursor cloud agent VM, `nuxt dev`
often listens on IPv6 only: open **http://localhost:3000/**.
**http://127.0.0.1:3000** refuses the connection.

The Host is a Bot list + Chat. Press
**+** to create a Bot (default **New Bot**). **Settings** holds the Cluster
LLM gateway (base URL + key). Not a landing page. Store is SQLite
(`DATABASE_URL`, default `file:.data/cluster.sqlite` for local dev).
First visit creates the Cluster Owner; later visits sign in. The Owner opens
**Members** to add a Member (display name, email or username, password). A
Member signs in and uses Bot list and Chat. Settings stays with the Owner.

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

For Members and Invite screenshots, open
**http://localhost:3000/preview-seed?members=1**. That GET signs in the
same preview Owner and redirects to `/members` (a Member session cannot
open that page). `?hold=1` is ignored when `members=1` is set. **HEAD**
ignores `?members=1` and still answers **204** or **302** to
`/bots/preview` with no session cookie.

On `nuxt dev`, the Chat thread can force the activity row without a live
reply: `/bots/preview?activity=typing`, `?activity=command`, or
`?activity=connect&target=Expi`. A production Host ignores `activity`.
See [ADR 0021](docs/adr/0021-chat-activity-status.md).

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
Bot, that `?tall=1` adds the tall thread once, and that GET
`?members=1` lands on `/members` while HEAD ignores that query. Optional
`PREVIEW_SMOKE_URL` (default `http://localhost:3000`).

Preview Owner: username `preview`, password `preview-owner`. A
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
HTTP tools; empty token leaves them disabled. That token is not the Owner
session (`NUXT_SESSION_PASSWORD`). Configured Chat invokes the same tool
handlers in-process (no HTTP `/mcp`; delete is not a Chat tool).

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
