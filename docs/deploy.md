# Deploy a Cluster

Self-host path ([ADR 0005](adr/0005-self-host-first.md)). Day-1 is one Host
image; the Cluster Store lives on a named Docker volume, not in the image.

## Local compose

From the Platform checkout:

```bash
docker compose -f docker/compose.yml up --build
```

- Host: [http://localhost:3000/](http://localhost:3000/)
- Health: [http://localhost:3000/health](http://localhost:3000/health)
- Store path: `/var/lib/dostigus/cluster.sqlite` (`DATABASE_URL=file:...`)
- Volume: `cluster-data` (compose project name `dostigus`)

Stop with Ctrl-C, or `docker compose -f docker/compose.yml down`. `down` does
**not** delete `cluster-data`. Use `down -v` only when you intend to wipe the
Store.

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
