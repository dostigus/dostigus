# ADR 0031: Host HTTP get and Cluster http allowlist

- Status: accepted
- Date: 2026-09-24
- Amended: 2026-09-24 — `dostigus_http_get` stays on user slim and on Wake. Owner Chat allowlist get/set, and timezone set, wait for keyword expand ([ADR 0032](0032-chat-llm-context-assembly.md)). GET, allowlist, and SSRF stay this record.

The Chat tool loop stays [ADR 0011](0011-chat-mcp-tool-loop.md). The
MCP surface stays [ADR 0009](0009-mcp-toolkit-endpoint.md). Cluster
Store settings stay the same family as
`cluster_settings.timezone` ([ADR 0027](0027-bot-schedules.md)).
Claiming success without a successful tool result stays
[ADR 0028](0028-bot-self-settings-via-chat.md). This monorepo still
ships no stock Module packages and no Weather seed
([ADR 0030](0030-chat-cards-module-catalog.md)).

This record is the decision. It does not add the tool, the Settings
field, or a Store column.

## Decision

The Host adds one MCP surface tool, **`dostigus_http_get`**. A Bot
calls it on a Chat turn or a Schedule Wake. The call uses the same
in-process tool loop as the other Chat tools
([ADR 0011](0011-chat-mcp-tool-loop.md)). It is not a Module package
tool and not a Marketplace Apply.

**Host HTTP get** is that tool. The method is GET only. There is no
POST on day-1. There are no caller-supplied headers, no auth
passthrough, and no streaming.

The Host returns the HTTP status and the body to the Bot. The body is
capped at **65,536 bytes (64 KiB)**. When the upstream body is larger,
the Host **truncates** to that cap and sets `truncated` to true. Size
alone is not a tool error. The Bot must treat `truncated: true` as an
incomplete body and must not claim a complete parse of a structured
payload.

### Who may call

Any Bot on its turn may call `dostigus_http_get`. That includes an
Owner Chat turn, a Member Chat turn, a room mention, and a Wake
([ADR 0027](0027-bot-schedules.md)). The tool is not Owner-only.
The **Cluster http allowlist** gates destinations. A grantee Bot on
its own turn may GET an allowed public URL the same way a creator
Bot may.

`/mcp` Bearer auth is unchanged
([ADR 0009](0009-mcp-toolkit-endpoint.md)). Chat and Wake invoke the
same handler in-process. The Turn journal stores the tool name, not
the URL, the status, or the body ([ADR 0029](0029-turn-journal.md)).

### Cluster http allowlist

The allowlist lives in Cluster Store settings, the same singleton
family as `cluster_settings.timezone`
([ADR 0027](0027-bot-schedules.md)). The Store field is
`cluster_settings.http_allowlist`: a JSON array of hostnames. Missing
or empty is the same: an empty list.

**Empty allowlist = allow all hosts**, except the SSRF blocks below
(Nick, 2026-09-24). A non-empty list allows only listed hosts.

The Owner configures the allowlist in the Cluster. The Owner gets and
sets it through MCP (`dostigus_cluster_http_allowlist_get`,
`dostigus_cluster_http_allowlist_set`) and through an Owner Settings
field. Members do not set it. Members do not open Settings
([ADR 0012](0012-household-members.md)). Member Chat does not receive
the allowlist get or set tools. Owner Chat receives them on keyword
expand, the same family as timezone set
([ADR 0032](0032-chat-llm-context-assembly.md)). `dostigus_http_get`
stays on slim (user) and on Wake.

The Settings field is part of this decision. This record does not add
the control. The code PR does.

### Host match

An allowlist entry is a hostname only. No path, no scheme, no query.
The Host compares the URL hostname.

Day-1 match is **exact full hostname**, case-insensitive. No
wildcards. No suffix match. No registrable-domain rollup.

- `api.example.com` does not match `example.com`.
- `example.com` does not match `www.example.com`.
- Port is not part of the entry. `https://example.com:8443` matches
  `example.com`.
- An IP literal must match the listed form exactly and still fail
  the SSRF check when the address is blocked. Listing a blocked
  address does not allow it.

### SSRF

Even when the allowlist is empty (allow-all), the Host **always
blocks** loopback, private, and link-local destinations. A listed
host that resolves to one of those ranges is also blocked.

Blocked at high level:

- Loopback (IPv4 `127.0.0.0/8`, IPv6 `::1`)
- Private (IPv4 RFC1918, IPv6 unique local `fc00::/7`)
- Link-local (IPv4 `169.254.0.0/16` including cloud metadata,
  IPv6 `fe80::/10`)
- Unspecified (`0.0.0.0`, `::`)
- Hostnames that resolve to any address in those ranges, including
  `localhost`

The Host checks the resolved address, not only the hostname. Schemes
are `http` and `https` only. The Host may follow redirects. Each hop
must pass the same scheme, allowlist, and SSRF checks. A hop that
fails is a tool error.

A blocked destination, a scheme other than `http` or `https`, or a
host missing from a non-empty allowlist is a tool error. The Bot
reports that error and does not claim a fetch
([ADR 0028](0028-bot-self-settings-via-chat.md)).

### Not a weather package

[ADR 0030](0030-chat-cards-module-catalog.md) stays. This monorepo
does not ship a stock Weather Module, a weather Skill, or a weather
seed. This tool is not Marketplace, not a Module package, and not an
Open-Meteo seed.

A Bot that needs a public forecast uses `dostigus_http_get` against
an allowed public API (for example Open-Meteo) from a Skill or from
`wakeText`. The Platform does not invent weather tools and does not
Apply a weather package.

## Context

Bots need a way to read a public HTTP resource during a Chat turn or
a Wake: a forecast, a page, a JSON API. The constructor tools already
in Chat write the Store
([ADR 0028](0028-bot-self-settings-via-chat.md)). They do not GET the
public internet.

An earlier path was a stock Weather Module (Open-Meteo) and a
Host-bundled Apply. Nick reversed that on 2026-09-24
([ADR 0030](0030-chat-cards-module-catalog.md)). The Host still needs
one GET. The Cluster needs one Owner-owned destination gate.

The grill on 2026-09-24 settled GET-only, status plus a capped body,
any Bot on its turn, Store settings next to timezone, empty allowlist
as allow-all, and SSRF blocks that always apply. Settings UI is the
code PR. A later domain Skill that calls this tool is a follow-up,
not a platform seed.

## Consequences

- The code PR adds `dostigus_http_get`, the two Owner allowlist
  tools, `cluster_settings.http_allowlist`, and the Owner Settings
  field. This record does not.
- Owner Chat and Member Chat, and a Wake, gain `dostigus_http_get`
  on the slim / Wake lists in
  [ADR 0032](0032-chat-llm-context-assembly.md). The Chat allowlist
  still does not gain a Module catalog tool, an Apply tool, or
  weather tools ([ADR 0011](0011-chat-mcp-tool-loop.md),
  [ADR 0030](0030-chat-cards-module-catalog.md)).
- Owner Chat may gain allowlist get and set on keyword expand.
  Member Chat does not. Timezone get stays on slim. Timezone set
  waits for Owner expand
  ([ADR 0027](0027-bot-schedules.md),
  [ADR 0032](0032-chat-llm-context-assembly.md)).
- `/mcp` lists the same tools. Bearer auth is unchanged
  ([ADR 0009](0009-mcp-toolkit-endpoint.md)).
- Truncation is `truncated: true` plus a 64 KiB prefix. The Host
  does not error only because the body was long. The Bot must not
  treat a truncated JSON or HTML body as complete.
- An empty `http_allowlist` allows every public host. A locked-down
  Cluster sets an explicit list (for example `api.open-meteo.com`).
- SSRF checks always run. Allow-all is not allow-loopback.
- The Host owns a short timeout so a hung GET cannot stall a turn
  indefinitely. The code PR picks the value.
- The Turn journal records the tool name only
  ([ADR 0029](0029-turn-journal.md)).
- Meta Skills stay [ADR 0030](0030-chat-cards-module-catalog.md).
  This record does not add a weather how-to Skill and does not
  rewrite `platform-meta-marketplace`.

### Out of scope

- Implementation of the tool, the Settings field, and the Store
  column. Those are the code PR.
- A later domain Skill that calls Host HTTP get (including a
  raincoat check). That Skill is not a platform seed.
- POST, PUT, PATCH, DELETE.
- Caller-supplied headers, cookies, and auth passthrough.
- Streaming the upstream body.
- Wildcards, suffix match, and registrable-domain rollup.
- A per-Bot allowlist.
- Marketplace, Module Apply, and a stock Weather Module or seed
  ([ADR 0030](0030-chat-cards-module-catalog.md)).

## Alternatives

- POST on day-1 — rejected. GET only.
- Owner-only `dostigus_http_get` — rejected. Any Bot on its turn
  may call. The allowlist gates destinations.
- Empty allowlist means deny all — rejected. Nick: empty = allow
  all public hosts. SSRF blocks still apply.
- Suffix or wildcard host match — rejected on day-1. Exact full
  hostname. No path.
- Error when the body exceeds 64 KiB — rejected. Truncate and set
  `truncated` so a successful GET still returns status and a prefix.
- Skip SSRF when the allowlist is empty — rejected. Loopback,
  private, and link-local stay blocked.
- A stock Weather Module, weather Skill, or Open-Meteo seed —
  rejected. [ADR 0030](0030-chat-cards-module-catalog.md) stays. The
  Bot GETs an allowed public API from a Skill or `wakeText`.
- A Module package tool instead of a Platform MCP surface tool —
  rejected. This is a Host tool on the existing loop
  ([ADR 0011](0011-chat-mcp-tool-loop.md)).
- Store the allowlist outside `cluster_settings` — rejected. Same
  family as timezone ([ADR 0027](0027-bot-schedules.md)).
- Members set the allowlist — rejected. The Owner configures it in
  the Cluster.
