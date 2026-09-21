# Dostigus

Self-host agent OS: portable bot packages + host UI sheets.

## Intent

Run a **Cluster** on your machine. Bots are portable packages inside the Cluster
(not git repos). The **Host shell** is one app: chat + cards + Sheets from a
shared kit. Default path is self-host (`docker compose up`); managed hosting is
optional and later.

## Docs

| File | What |
|------|------|
| [`CONTEXT.md`](CONTEXT.md) | Glossary — keep terms stable |
| [`docs/SPEC.md`](docs/SPEC.md) | MVP in / out of scope |
| [`docs/adr/`](docs/adr/) | Architecture decisions |
| [`AGENTS.md`](AGENTS.md) | Agent rules + `pnpm check` |

## Develop

```bash
pnpm install
pnpm --filter @dostigus/web dev   # http://localhost:3000/
pnpm check                        # lint → typecheck → test → build
```

Compose stub (self-host intent, not a production image yet): [`docker/compose.yml`](docker/compose.yml).

## License

[MIT](LICENSE)
