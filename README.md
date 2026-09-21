# Dostigus

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
| [`docs/deploy.md`](docs/deploy.md) | Self-host compose, GHCR, Store volume |
| [`docs/adr/`](docs/adr/) | Architecture decisions |
| [`AGENTS.md`](AGENTS.md) | Agent rules + `pnpm check` |

## Develop

```bash
pnpm install
pnpm --filter @dostigus/web dev   # http://localhost:3000/
pnpm check                        # lint → typecheck → test → build
```

Open the Host, press **+**, create a Bot (default name **New Bot**), and Chat.
The Bot greets and asks what it is for. Messages persist in the Store
(SQLite). An LLM key is optional — see [`docs/deploy.md`](docs/deploy.md).

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
