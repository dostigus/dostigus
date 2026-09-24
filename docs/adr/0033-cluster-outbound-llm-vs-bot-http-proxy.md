# ADR 0033: Cluster outbound: LLM proxy vs Bot HTTP proxy

- Status: accepted
- Date: 2026-09-24

The LLM gateway stays [ADR 0004](0004-llm-gateway-tiers.md). Host HTTP
get and the Cluster http allowlist stay
[ADR 0031](0031-host-http-get.md). Self-host compose stays
[ADR 0005](0005-self-host-first.md). This record is how a Cluster
reaches the public internet on two Host-owned paths: the LLM client,
and Bot HTTP egress.

This record is the decision. It does not change Host or Store code.
The impl PR lands after this docs PR merges.

Nick locked the shape below on 2026-09-24 (grill; all recommended
answers accepted).

## Decision

Outbound proxy is a **Cluster capability**. The operator sets it at
deploy as process env. It is not a per-destination weather list, not
a `NO_PROXY` host list, and not “`dostigus_http_get` always ignores
proxy”.

There are **two paths**. They do not share a proxy env.

### LLM

The LLM client reads the standard `HTTPS_PROXY` / `HTTP_PROXY` env
when that env is set. It does so through an **explicit** `ProxyAgent`
in the LLM client. It does not rely on `NODE_USE_ENV_PROXY` or
undici `EnvHttpProxyAgent`.

The target is the Cluster LLM gateway URL (for example
`OPENAI_COMPATIBLE_BASE_URL`, or the same base from Store settings).

Day-1 pairing:

- `https` gateway URL: use `HTTPS_PROXY` if set, else `HTTP_PROXY`
  if set, else direct.
- `http` gateway URL: use `HTTP_PROXY` if set, else direct.

Unset or empty after trim means that var is not set. A non-empty
value that is not a usable URL fails closed on use (the LLM call
errors). The Host does not silently go direct.

### Bot HTTP egress

**Bot HTTP egress** is Host→internet tool traffic that is not the
LLM gateway. The handle is that name so a later non-LLM tool can
reuse it. Day-1 the only consumer is `dostigus_http_get`
([ADR 0031](0031-host-http-get.md)).

Bot HTTP egress reads **`DOSTIGUS_HTTP_PROXY`**: one URL for both
`http` and `https` destinations. Unset or empty after trim means
**direct**. It never falls back to `HTTPS_PROXY`, `HTTP_PROXY`, or
the LLM `ProxyAgent`.

A non-empty `DOSTIGUS_HTTP_PROXY` that is not a usable URL fails
closed on use: `dostigus_http_get` returns a tool error. The Host
does not silently go direct.

Day-1 has no `DOSTIGUS_HTTP_NO_PROXY` and no Bot `NO_PROXY`. When
the proxy is set, every Bot HTTP egress call uses it (subject to
SSRF on the **destination**). When it is unset, every call is
direct.

### Not `NODE_USE_ENV_PROXY`

The Platform does not rely on `NODE_USE_ENV_PROXY` or undici
`EnvHttpProxyAgent` for Host-owned fetch (LLM client and Bot HTTP
egress). If `NODE_USE_ENV_PROXY` is set, the Host logs **one**
startup warn and ignores that flag for Host-owned fetch. The Host
does not map an old `HTTPS_PROXY` onto Bot HTTP egress.

### Config surface

Day-1 is **env only**. There is no Cluster Store field and no
Settings UI. Proxy URLs may include userinfo. Secrets stay in env,
not SQLite.

### SSRF vs proxy endpoint

[ADR 0031](0031-host-http-get.md) still applies to the
**destination**: resolve that hostname and block loopback, private,
and link-local. The **proxy endpoint** may be loopback or private
(a sidecar on the Cluster). Do not treat the proxy host as the
destination and do not apply the destination SSRF block to the
proxy URL.

### Logging

Never log proxy userinfo. Logs may say the path is set or unset and
may name the proxy hostname. They must not print the raw URL when
it contains userinfo.

## Context

A Cluster that sits behind an outbound proxy needs the Host to
reach an OpenAI-compatible LLM gateway and, separately, the public
URLs a Bot GETs. Those destinations are different trust domains.
One env (`HTTPS_PROXY`) that also captures Bot GET would send
allowlisted public fetches through the same proxy the LLM key
already uses, or would force every Bot GET direct when the operator
only meant to proxy the gateway.

`NODE_USE_ENV_PROXY` would apply one undici env agent to every
`fetch` in the process. That is the wrong Cluster surface: Host-owned
paths must choose a proxy explicitly, and Bot HTTP egress must not
inherit the LLM proxy by accident.

The grill on 2026-09-24 settled two env paths, Bot HTTP egress as
the handle, env-only config, fail-closed invalid Bot proxy URLs,
destination-only SSRF, no Bot `NO_PROXY` on day-1, and one startup
warn when `NODE_USE_ENV_PROXY` is set.

Weather URL failover and platform-meta copy stay later. They are
not this record.

## Consequences

- The impl PR adds a shared Host helper, for example
  `apps/web/server/utils/outbound-fetch.ts`: `ProxyAgent(proxyUrl)`
  when that path has a proxy URL, otherwise `Agent()`. The LLM
  client passes the LLM proxy env. `hostHttpGet` /
  `dostigus_http_get` passes `DOSTIGUS_HTTP_PROXY`. This record
  does not add that file.
- Host-owned fetch in the LLM client and in Host HTTP get uses that
  helper (or an equivalent explicit dispatcher). It does not use
  `EnvHttpProxyAgent`.
- A usable proxy URL is an `http` or `https` URL with a hostname
  (`new URL` succeeds and `hostname` is non-empty). Day-1 does not
  add a SOCKS proxy.
- Invalid `DOSTIGUS_HTTP_PROXY` is a tool error on
  `dostigus_http_get`. Invalid LLM proxy env is an LLM call error.
  Neither path falls back to direct.
- Startup: if `NODE_USE_ENV_PROXY` is set, one warn. Copy may say
  the flag is ignored for Host-owned fetch. Do not warn on every
  request.
- Compose / `.env.example` / `docs/deploy.md` gain
  `DOSTIGUS_HTTP_PROXY` and a note that `HTTPS_PROXY` /
  `HTTP_PROXY` are the LLM path. The impl PR writes those. This
  record does not.
- Settings and the Cluster Store stay unchanged. The Owner does not
  paste a proxy URL in the Host.
- [ADR 0031](0031-host-http-get.md) destination SSRF, allowlist,
  GET-only, and the 64 KiB cap stay. A proxied GET still checks the
  destination, not the proxy host.
- A later Host→internet tool that is not the LLM client uses Bot
  HTTP egress (`DOSTIGUS_HTTP_PROXY`), not `HTTPS_PROXY`.
- Weather URL failover and platform-meta text stay later. They are
  not this record.

### Out of scope

- Host or Store implementation. That is the impl PR.
- Cluster Store / Settings UI for a proxy URL.
- `DOSTIGUS_HTTP_NO_PROXY`, Bot `NO_PROXY`, and a per-host bypass
  list.
- Mapping `HTTPS_PROXY` onto Bot HTTP egress.
- `NODE_USE_ENV_PROXY` / `EnvHttpProxyAgent` as the Host fetch
  mechanism.
- SOCKS proxies.
- Weather URL failover and platform-meta copy.
- Marketplace, Module Apply, and a stock Weather Module
  ([ADR 0030](0030-chat-cards-module-catalog.md)).

## Alternatives

- One proxy env for LLM and Bot GET — rejected. Two paths. Bot
  HTTP egress never inherits `HTTPS_PROXY`.
- `dostigus_http_get` always ignores proxy — rejected. When
  `DOSTIGUS_HTTP_PROXY` is set, Bot GET uses it.
- A weather / `NO_PROXY` host list as the Cluster capability —
  rejected. Env at deploy. Set = all Bot egress through the proxy;
  unset = all direct.
- Rely on `NODE_USE_ENV_PROXY` / `EnvHttpProxyAgent` for Host-owned
  fetch — rejected. Explicit `ProxyAgent` or `Agent` per path. One
  startup warn if that env is set.
- Map a legacy `HTTPS_PROXY` onto Bot HTTP egress — rejected.
- Cluster Store or Settings UI on day-1 — rejected. Env only.
  Secrets stay out of SQLite.
- Apply destination SSRF to the proxy endpoint — rejected. The
  proxy may be a loopback or private sidecar. SSRF stays on the
  destination.
- `DOSTIGUS_HTTP_NO_PROXY` on day-1 — rejected.
- Invalid `DOSTIGUS_HTTP_PROXY` falls through to direct — rejected.
  Fail closed on use (tool error).
- Log the full proxy URL — rejected. Set/unset and hostname only.
  Never userinfo.
