# ADR 0048: Mailer product (IMAP / SMTP Pack)

- Status: accepted
- Date: 2026-10-02
- Amended: 2026-10-03 — Nick rejected the
  Cluster mail allowlist (host:port list,
  empty = deny all, Owner Dashboard form).
  It is not a Cluster setting. The mailbox
  server is the Closet Bot mail binding.
  SSRF stays. Standing rule: future
  security limits that apply to one Bot
  or one Pack go on the Bot, not on
  Cluster settings. Docs only. No Port.

Pack format and Closet Import stay
[ADR 0039](0039-pack-vs-bot-portable-recipe.md).
Marketplace stays
[ADR 0045](0045-pack-catalog-on-marketing-site.md).
Catalog Store and deep-link Apply
(`applyPack=` cloud mirror zip URL →
`PackApplySheet`) stay
[ADR 0047](0047-marketplace-catalog-store.md).
The closet stays
[ADR 0020](0020-bot-closet.md).
Schedules and Wake stay
[ADR 0027](0027-bot-schedules.md).
Host HTTP get and the Cluster http
allowlist stay
[ADR 0031](0031-host-http-get.md).
Bot HTTP egress / `DOSTIGUS_HTTP_PROXY`
stay
[ADR 0033](0033-cluster-outbound-llm-vs-bot-http-proxy.md).
Chat slim and Wake tool lists stay
[ADR 0032](0032-chat-llm-context-assembly.md)
except the Mailer tools named below.

This record names the **Mailer** product:
Pack `dostigus.mailer`, Cluster **Bot mail
binding**, and Host IMAP/SMTP tools.
There is no Cluster **mail allowlist**.
The 2026-10-02 record was docs only.
Host tools, Closet bind, and the Pack
tree later landed in this Host. Nick
publish of the zip stays later.

Nick locked the fourteen decisions below
on 2026-10-02. On 2026-10-03 Nick
rejected the Cluster mail allowlist;
Egress and Bot vs Cluster security
limits below are that amend. Do not
reopen the kept locks.

## Amended

2026-10-03. Cluster settings are only
about the Cluster itself. A
host:port mail allowlist for one Pack
is not a Cluster setting. The mailbox
server is whatever the Owner or Admin
sets when binding that Bot in Closet.
One mailbox per Bot stays. The Host
still always blocks loopback, private,
and link-local destinations. Do not
add Cluster-level allowlists for a
single Pack. Future security limits
that apply to one Bot or one Pack go
on the Bot, not on Cluster settings.
This amend is docs only. No Port.

`dostigus/cloud` `docs/catalog.md` may
still say deep-link Apply is later.
This monorepo Host already consumes
`applyPack=` ([#192](https://github.com/dostigus/dostigus/pull/192)).
Do not edit `dostigus/cloud` in this PR.

## Decision

The first live-mailbox Pack is
**`dostigus.mailer`**. It is a Bot Pack
plus Host IMAP/SMTP tools (the same
class as `dostigus_http_get`), not a
Kitchen-style Module with mail tables
in v1.

### Protocols v1

IMAP + SMTP only. There is no Gmail API
and no Outlook / Microsoft Graph OAuth
API in this record.

### Form

One Bot Pack id `dostigus.mailer`: soul,
Skills, paused Schedule templates, and
integration stubs (slug + reason +
required env **names**, never values).
Apply creates a **new** Bot. Marketplace
deep-link Apply is `applyPack=` as
already shipped
([ADR 0047](0047-marketplace-catalog-store.md),
[#192](https://github.com/dostigus/dostigus/pull/192)).
Closet file / URL / git Apply stays
[ADR 0039](0039-pack-vs-bot-portable-recipe.md).

### Secrets

IMAP/SMTP credentials live in a new
Cluster-side **Bot mail binding** Store.
They are never in the Pack zip and never
in the Catalog Store mirror. Export Pack
scrubs secrets
([ADR 0039](0039-pack-vs-bot-portable-recipe.md)).

### vs `dostigus.mail`

Keep the existing catalog Pack
`dostigus.mail` (paste-only triage). Do
not replace it. Do not rename it.
`dostigus.mailer` is a separate Pack.

### Boundary

v1 is Pack + Host IMAP/SMTP tools. It is
not a Kitchen-style Module and does not
add mail tables to the Cluster Store.
A Module comes later only if a later
record needs one.

### Who binds

The Owner or an Admin binds the mailbox
in Closet **after** Apply. Not Chat
self-settings
([ADR 0028](0028-bot-self-settings-via-chat.md)).
Not an arbitrary Member with role
`member`. Admin Apply stays
[ADR 0042](0042-admin-role-and-share-permission.md).

### Send

Draft by default. `dostigus_mail_send`
composes a draft. Real SMTP send runs
only after an explicit confirm in UI or
Chat. Same safety family as
DraftExternalMessage: show the draft,
wait for confirm, then send.

### Mailbox cardinality

One mailbox per Bot. A second mailbox is
a second Apply and a second Bot.

### Check cadence

v1 uses the existing Schedule `daily` /
`weekly` Wake
([ADR 0027](0027-bot-schedules.md)).
No IMAP IDLE. No N-minute poll. No new
interval cadence in this record.

### Egress

The mailbox server is whatever the
Owner or Admin sets when binding that
Bot in Closet (IMAP and SMTP host and
port). There is no Cluster mail
allowlist: no host:port list, no empty
= deny all, no Owner Dashboard form.
A Cluster mail allowlist is not a
Cluster setting.

IMAP/SMTP does not reuse the Cluster
http allowlist or
`DOSTIGUS_HTTP_PROXY` / Bot HTTP egress
([ADR 0031](0031-host-http-get.md),
[ADR 0033](0033-cluster-outbound-llm-vs-bot-http-proxy.md)).
The Host still always blocks loopback,
private, and link-local destinations
(SSRF). A mail-specific proxy env is
not this record.

### Bot vs Cluster security limits

Cluster settings are only about the
Cluster itself (timezone, Cluster http
allowlist, Locale). Feature-specific
outbound limits (which mail hosts a
Bot may use, and similar Pack
concerns) belong on the Bot: the user
allows or denies that Bot. Future
security limits that apply to one Bot
or one Pack go on the Bot, not on
Cluster settings. Do not add
Cluster-level allowlists for a single
Pack.

### Catalog id

`dostigus.mailer` (already the example
id in
[ADR 0047](0047-marketplace-catalog-store.md)).

### Wake tools (narrow)

When Host Mailer tools land, Chat slim
and Wake gain:

- `dostigus_mail_list`
- `dostigus_mail_get`
- `dostigus_mail_send` (gated by
  confirm)

Same class as `dostigus_http_get`: on
user slim (Owner, creator Member,
grantee) and on Wake; no keyword expand
required. Wake still has no expand
([ADR 0032](0032-chat-llm-context-assembly.md)).
This record does not add the tools.

### UX bind

Closet Sheet after Apply: IMAP and SMTP
fields (host, port, user, password),
an app-password hint, a masked
password, and a test-connection
control. Kit primitives, not page CSS
([ADR 0013](0013-kit-reka-ui-and-brand.md),
[ADR 0020](0020-bot-closet.md)).
This record does not add the Sheet.

### Publish

After Host tools land (later impl PR),
Nick publishes the zip to the Catalog
Store
([ADR 0047](0047-marketplace-catalog-store.md)).
Do not seed `dostigus.mailer` beside
`dostigus.mail` in this docs PR. Do not
implement the Pack tree here.

### Scope of this record

The 2026-10-02 record was docs only.
Host tools, Closet bind, and the Pack
tree later landed. This 2026-10-03
amend is docs only. No Port. Ask Nick
before merge.

## Context

[ADR 0047](0047-marketplace-catalog-store.md)
deferred a Mailer IMAP / SMTP Pack as
the first product expected on the
Catalog Store path after Kitchen / Mail
/ Reader migrate. That record is
catalog infrastructure. This record is
the product lock.

`dostigus.mail` is already a catalog
Pack: paste-only triage. A live mailbox
Bot is a different recipe. Replacing
or renaming `dostigus.mail` would break
people who already Applied that Pack.

Credentials in a Pack zip or a catalog
mirror would leave the Cluster on
share. [ADR 0039](0039-pack-vs-bot-portable-recipe.md)
already scrubs secrets on Export.
Mailer needs a Cluster-side binding
the Pack cannot carry.

A Kitchen-style Module with mail tables
would invent a mail Store before the
Host can speak IMAP/SMTP. v1 is Host
tools plus the Closet Bot mail binding.
SSRF blocks stay. There is no Cluster
mail allowlist.

Gmail / Outlook OAuth would marry
vendor APIs in Platform code.
[ADR 0040](0040-collective-host-direction.md)
keeps verticals as Packs with stubs,
not built-in vendor integrations.

IMAP IDLE or an N-minute poll would add
a Schedule cadence this Host does not
have. [ADR 0027](0027-bot-schedules.md)
already wakes `daily` / `weekly`.

Reusing the Cluster http allowlist or
`DOSTIGUS_HTTP_PROXY` would mix GET
egress with IMAP/SMTP ports and
proxying. Those paths stay HTTP.

A Cluster mail allowlist (host:port
list, empty = deny all, Owner
Dashboard form) would put a
Pack-specific outbound gate on Cluster
settings. Cluster settings stay
Cluster-wide. The user allows or
denies that Bot in Closet.

Chat self-settings or Member self-bind
would put mailbox passwords on a
grantee Chat turn. Closet bind stays
Owner / Admin after Apply.

Unbounded SMTP send from a Wake would
mail out without a person in the loop.
Draft-then-confirm is the lock.

One Bot with many mailboxes would blur
Apply, binding, and Wake. One mailbox
per Bot keeps the recipe 1:1.

## Consequences

- This 2026-10-03 amend is docs only.
  No Port. Host IMAP/SMTP tools,
  Closet bind, Bot mail binding, and
  the Pack tree already landed. Do not
  change product code, migrations, or
  UI in this amend.
- Glossary: **Mailer Pack** is
  `dostigus.mailer`. **Bot mail
  binding** is the Cluster Store
  credential row (one mailbox per Bot).
  The mailbox server is that bind.
  There is no **mail allowlist**. They
  are not Cluster http allowlist, not
  Bot HTTP egress, and not
  `dostigus.mail`.
- Standing rule (CONTEXT): Cluster
  settings are only about the Cluster
  itself. Future security limits that
  apply to one Bot or one Pack go on
  the Bot, not on Cluster settings.
- SPEC “In scope” and “This Host”
  drop the Cluster mail allowlist.
  SPEC out of scope keeps OAuth,
  IDLE, interval Schedules, a Module
  mail store, and Member self-bind
  later. A Cluster mail allowlist is
  rejected.
- [ADR 0047](0047-marketplace-catalog-store.md)
  “Mailer later” is this record. Nick
  publish of the zip waits for Host
  tools. Do not seed beside
  `dostigus.mail` here.
- [ADR 0032](0032-chat-llm-context-assembly.md)
  Wake and Chat slim will list
  `dostigus_mail_list`,
  `dostigus_mail_get`, and
  `dostigus_mail_send` when the impl
  PR lands. Send stays confirm-gated.
- [ADR 0031](0031-host-http-get.md)
  Cluster http allowlist stays HTTP
  get. Mailer does not add a Cluster
  mail allowlist. IMAP/SMTP host is
  the Closet bind. SSRF stays.
- [ADR 0033](0033-cluster-outbound-llm-vs-bot-http-proxy.md)
  `DOSTIGUS_HTTP_PROXY` stays Bot HTTP
  egress. IMAP/SMTP does not use it.
- [ADR 0020](0020-bot-closet.md)
  gains the bind Sheet in the impl PR.
- [ADR 0027](0027-bot-schedules.md)
  cadence stays `daily` / `weekly`.
- [ADR 0039](0039-pack-vs-bot-portable-recipe.md)
  format, stubs, and secret scrub
  stay. Mailer secrets never enter
  the zip.
- Auto-update stays out
  ([ADR 0039](0039-pack-vs-bot-portable-recipe.md)).
- A Module mail store, Gmail/Outlook
  OAuth, IMAP IDLE, and interval
  Schedules stay later or rejected
  for v1.

## Alternatives

- Gmail / Outlook OAuth API in v1 —
  rejected. IMAP + SMTP only.
- Replace or rename `dostigus.mail` —
  rejected. Paste-only triage stays.
  `dostigus.mailer` is separate.
- Kitchen-style Module with mail
  tables in v1 — rejected. Pack +
  Host tools. Module later only if
  needed.
- Secrets in the Pack zip or catalog
  mirror — rejected.
  [ADR 0039](0039-pack-vs-bot-portable-recipe.md)
  scrub stands.
- Chat self-settings bind — rejected.
- Member (role `member`) self-bind —
  rejected. Owner / Admin in Closet
  after Apply.
- SMTP send without confirm —
  rejected. Draft by default; confirm
  in UI or Chat.
- Many mailboxes on one Bot —
  rejected. Second mailbox = second
  Apply / Bot.
- IMAP IDLE in v1 — rejected.
- N-minute / interval Schedule in
  this record — rejected. Existing
  `daily` / `weekly` Wake.
- Reuse Cluster http allowlist for
  IMAP/SMTP — rejected.
- Cluster mail allowlist (host:port
  list, empty = deny all, Owner
  Dashboard form) — rejected
  2026-10-03. The mailbox server is
  the Closet bind. SSRF stays.
  Feature-specific outbound limits
  belong on the Bot.
- Reuse `DOSTIGUS_HTTP_PROXY` for
  IMAP/SMTP — rejected.
- Seed `dostigus.mailer` beside
  `dostigus.mail` in this PR —
  rejected. Publish after Host tools.
- Implement Host tools, Pack zip, or
  Closet UI in this PR — rejected.
  Docs only. Ask Nick before merge.
- Auto-update installed Mailer Packs
  — rejected.
  [ADR 0039](0039-pack-vs-bot-portable-recipe.md).
- Host-pulled catalog or
  Apply-from-index — rejected.
  [ADR 0045](0045-pack-catalog-on-marketing-site.md),
  [ADR 0047](0047-marketplace-catalog-store.md).
