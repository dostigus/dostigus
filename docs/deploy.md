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
- MCP surface: [http://localhost:3000/mcp](http://localhost:3000/mcp) — tools stay disabled until `NUXT_AGENT_TOKEN` is set
- Store path: `/var/lib/dostigus/cluster.sqlite` (`DATABASE_URL=file:...`)
- Volume: `cluster-data` (compose project name `dostigus`)
- LLM gateway is optional (see below). Compose does **not** require a key.
  The Owner can also paste a key in Host **Settings**.

Stop with Ctrl-C, or `docker compose -f docker/compose.yml down`. `down` does
**not** delete `cluster-data`. Use `down -v` only when you intend to wipe the
Store.

## Environment

Env vars **override** (and can bootstrap) Cluster LLM gateway settings stored
by Host Settings. Unset env and use Settings if the Owner should manage the
key in the Host.

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes in compose | Store SQLite URL (`file:/var/lib/dostigus/cluster.sqlite`). Local `pnpm dev` defaults to `file:.data/cluster.sqlite`. |
| `OPENAI_COMPATIBLE_BASE_URL` | no | LLM gateway base, including `/v1` (example: `https://openrouter.ai/api/v1`). |
| `LLM_API_KEY` | no | Bearer token for that base. |
| `OPENROUTER_API_KEY` | no | Used if `LLM_API_KEY` is unset. |
| `LLM_MODEL` | no | Overrides every Model tier’s model id. |
| `LLM_MODEL_CHEAP` / `LLM_MODEL_STRONG` / `LLM_MODEL_CODE` / `LLM_MODEL_TOY` | no | Per–Model tier override. |
| `LLM_DEFAULT_TIER` | no | Default Model tier (`cheap` \| `strong` \| `code` \| `toy`). |
| `NUXT_AGENT_TOKEN` | no | Bearer for the MCP surface at `/mcp`. Empty → tools stay disabled. |
| `DOSTIGUS_MCP_TOKEN` | no | Alias for `NUXT_AGENT_TOKEN` when that var is unset. |

### Model tier defaults (OpenRouter-friendly)

| Model tier | Default `model` id |
|------------|--------------------|
| `cheap` | `openai/gpt-4o-mini` |
| `strong` | `openai/gpt-4o` |
| `code` | `openai/gpt-4o` |
| `toy` | `openai/gpt-4o-mini` |

A key with no base URL uses `https://openrouter.ai/api/v1`. Settings can
override these ids. The Host never returns the full key to the client
(masked last four) and does not log it.

User messages after the greeting call `POST {base}/chat/completions` with
Chat history and a system prompt when a base URL and key are available (env
or Store). If they are unset, the Host stores a stub reply and Chat shows
“replies are stubs until you add a key”. If they are set and the call
fails, the Host stores a clear error — not a stub. The greeting is always
written to the Store.

Pass optional LLM vars through compose when you want env to supply the
gateway:

```bash
OPENAI_COMPATIBLE_BASE_URL=https://openrouter.ai/api/v1 \
OPENROUTER_API_KEY=sk-… \
docker compose -f docker/compose.yml up --build
```

Or open **Settings** on the Host and paste the same base + key. See
[`.env.example`](../.env.example) and [ADR 0004](adr/0004-llm-gateway-tiers.md).

## MCP surface

The Host serves the Cluster MCP surface at `/mcp` (`@nuxtjs/mcp-toolkit`,
name `Dostigus`). Tools wrap the same Store helpers as `/api/bots*`: Bots
list/get/create/update/delete and Chat messages list/append. See
[ADR 0009](adr/0009-mcp-toolkit-endpoint.md).

Set a token and send it as `Authorization: Bearer …`. An empty token (the
compose default) leaves tools disabled. The handler does **not** return
401 — MCP clients treat that as OAuth discovery.

```bash
NUXT_AGENT_TOKEN=replace-me \
docker compose -f docker/compose.yml up --build
```

Cursor (or any Streamable HTTP MCP client):

```json
{
  "mcpServers": {
    "dostigus": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer replace-me"
      }
    }
  }
}
```

The Host UI does not need this token.

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
