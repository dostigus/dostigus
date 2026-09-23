# Dostigus 🪿

Self-host agent OS: portable bot packages + host UI sheets.

## Intent

Run a **Cluster** on your machine. A **Bot** is a persona with a Manifest and
bound Module packages (the Cluster is not a git repo). The **Host** is one app:
Chat + Cards + Sheets from the Kit. Default path is self-host
(`docker compose up`); managed hosting is optional and later.

## Docs

| File | What |
|------|------|
| [`CONTEXT.md`](CONTEXT.md) | Glossary — keep terms stable |
| [`docs/SPEC.md`](docs/SPEC.md) | MVP in / out of scope |
| [`docs/deploy.md`](docs/deploy.md) | Self-host compose, GHCR, Store volume, MCP token |
| [`docs/ui.md`](docs/ui.md) | Host tokens (Nunito, charcoal `#121212` + `#F25630`) |
| [`docs/adr/`](docs/adr/) | Architecture decisions |
| [`AGENTS.md`](AGENTS.md) | Agent rules + `pnpm check` |

## Develop

```bash
pnpm install
pnpm --filter @dostigus/web dev   # http://localhost:3000/
pnpm check                        # lint → typecheck → test → build
```

On a Cursor cloud agent VM, `nuxt dev` often listens on IPv6 only. Use
`http://localhost:3000/`. `http://127.0.0.1:3000` refuses the connection.

Host preview seed (Owner signed in, fixture Bot id `preview`, Chat open):
`pnpm preview:host`, then GET `http://localhost:3000/preview-seed`
(redirects to `/bots/preview`; `?tall=1` for a tall thread). Renaming
that Bot does not change the id. HEAD is answered on that route and on
`/health`. `pnpm smoke:preview` checks that HEAD, the fixture Bot, and the
tall thread. See [`AGENTS.md`](AGENTS.md).

A fresh Cluster opens **Create your Owner** (email or username + password).
Later visits sign in. Then press **+**: the Chat pane becomes find or
create (new Bots are named **New Bot**). The Bot greets, and a purpose Card
offers Personal, Work, Learning, Other, or your own words. Messages persist in the Store
(SQLite). An LLM key is optional (compose env or Host **Settings**) — see
[`docs/deploy.md`](docs/deploy.md). With a key, Chat may call Cluster MCP
surface tools in-process (same Store as the Host UI and `/mcp`).
Host UI is dark by default: **Nunito**, deep charcoal canvas (`#121212`), black
Chat pane, Sheet chrome `#212121`, firm coral-orange CTAs (`#F25630`), goose
Brand from the Kit.
See [`docs/ui.md`](docs/ui.md).

The Cluster MCP surface is `/mcp` (`@nuxtjs/mcp-toolkit`). Set
`NUXT_AGENT_TOKEN` (or `DOSTIGUS_MCP_TOKEN`) so a Cursor/MCP client can
call Platform tools against the Store. Empty token → tools stay disabled.
That Bearer is **not** the Host Owner session (`NUXT_SESSION_PASSWORD`).
See [`docs/deploy.md`](docs/deploy.md).

## Self-host

```bash
docker compose -f docker/compose.yml up --build
```

Host: [http://localhost:3000/](http://localhost:3000/). Cluster Store SQLite
lives on named volume `cluster-data` (`DATABASE_URL=file:/var/lib/dostigus/cluster.sqlite`).

Published image: `ghcr.io/dostigus/dostigus` (`:latest` on `main`, `:vX.Y.Z` on
Platform tags). See [`docs/deploy.md`](docs/deploy.md).

## License

[MIT](LICENSE)
