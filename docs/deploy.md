# Deploy a Cluster

Self-host path ([ADR 0005](adr/0005-self-host-first.md)). Day-1 is one Host
image; the Cluster Store lives on a named Docker volume, not in the image.

## Local compose

From the Platform checkout:

```bash
docker compose -f docker/compose.yml up --build
```

- Host: [http://localhost:3000/](http://localhost:3000/) — Bot list; `+` creates a Bot and opens Chat
- Health: [http://localhost:3000/health](http://localhost:3000/health)
- Store path: `/var/lib/dostigus/cluster.sqlite` (`DATABASE_URL=file:...`)
- Volume: `cluster-data` (compose project name `dostigus`)
- LLM gateway is optional (see below). Compose does **not** require a key.

Stop with Ctrl-C, or `docker compose -f docker/compose.yml down`. `down` does
**not** delete `cluster-data`. Use `down -v` only when you intend to wipe the
Store.

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes in compose | Store SQLite URL (`file:/var/lib/dostigus/cluster.sqlite`). Local `pnpm dev` defaults to `file:.data/cluster.sqlite`. |
| `OPENAI_COMPATIBLE_BASE_URL` | no | LLM gateway base, including `/v1` (example: `https://openrouter.ai/api/v1`). |
| `LLM_API_KEY` | no | Bearer token for that base. |
| `OPENROUTER_API_KEY` | no | Used if `LLM_API_KEY` is unset. |
| `LLM_MODEL` | no | Chat-completions `model`. Defaults from the Bot Model tier (`strong` → `gpt-4o`). |

User messages after the greeting call `POST {base}/chat/completions` when both
a base URL and a key are set. If they are unset (or the call fails), the Host
stores a stub reply. The greeting is always written to the Store.

Pass optional LLM vars through compose only when you want real replies:

```bash
OPENAI_COMPATIBLE_BASE_URL=https://openrouter.ai/api/v1 \
OPENROUTER_API_KEY=sk-… \
docker compose -f docker/compose.yml up --build
```

See [`.env.example`](../.env.example).

## Pull a published image

```bash
docker compose -f docker/compose.yml pull
docker compose -f docker/compose.yml up -d
```

Compose tags the service as `ghcr.io/dostigus/dostigus:latest`. To pin a
Platform release, set `image: ghcr.io/dostigus/dostigus:vX.Y.Z` (or pass
`--build` to build from the checkout instead of pulling).

## Upgrade

Image updates do not replace the volume.

```bash
git pull
docker compose -f docker/compose.yml pull
docker compose -f docker/compose.yml up -d
```

Or rebuild from git: `docker compose -f docker/compose.yml up -d --build`.

## GHCR tags

Image name: `ghcr.io/dostigus/dostigus`.

| Tag | Published when |
|-----|----------------|
| `latest` | push to `main` |
| `sha-<shortsha>` | push to `main` or git tag `v*` |
| `vX.Y.Z` | git tag `vX.Y.Z` (Platform semver) |

Pin a Cluster you care about to `vX.Y.Z`, not `latest`. See
[ADR 0007](adr/0007-platform-image-tags.md).

CI (`.github/workflows/ci.yml`) runs `pnpm check` on every PR and push. PRs
build the Host image and do not push. Pushes to `main` and tags `v*` push to
GHCR with `GITHUB_TOKEN` (`packages: write`).

## Package visibility (Nick)

The first successful push creates the org package as **private**. Others cannot
`docker pull` until you change visibility:

1. Open [github.com/orgs/dostigus/packages](https://github.com/orgs/dostigus/packages)
2. Open the `dostigus` package → **Package settings**
3. Set visibility to **Public** if anonymous pulls should work
4. Confirm the package is linked to the `dostigus/dostigus` repository

Org members can pull a private package after
`echo $GITHUB_TOKEN | docker login ghcr.io -u USER --password-stdin`.
