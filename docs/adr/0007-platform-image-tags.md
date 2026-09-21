# ADR 0007: Platform image tags

- Status: accepted
- Date: 2026-09-21

## Decision

Day-1 ships one Host image: `ghcr.io/dostigus/dostigus`. Platform git tags
`vX.Y.Z` map to image tags `:vX.Y.Z`. Commits on `main` also publish `:latest`
and `:sha-<shortsha>`. The Cluster Store stays on a named volume, not in the
image.

## Context

Self-host ([ADR 0005](0005-self-host-first.md)) needs a pullable image. Image
versioning should follow Platform releases. A Cluster is not a git repo and
must not be encoded in the tag.

## Consequences

- Do not put Cluster or Owner names in image tags.
- Upgrade is pull/recreate; volume `cluster-data` is unchanged.
- Split images (Store process, MCP runtime, LLM gateway) wait until those
  runtimes exist.
- CI pushes only from `main` and `v*` tags; pull requests build without push.

## Alternatives

- Latest-only tags — rejected; a Cluster cannot pin a Platform version.
- Semver without the `v` prefix — rejected; keep git tag and image tag aligned.
