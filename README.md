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
