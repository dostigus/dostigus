# ADR 0034: Artifacts

- Status: accepted
- Date: 2026-09-24
- Amended: 2026-09-25 — Image Artifact vision is
  [ADR 0035](0035-image-artifact-vision.md). This record keeps no get
  tool, storage / ACL / limits, text extract ≤ 32 KiB, and the
  history meta note.

Session and Household stay [ADR 0010](0010-owner-auth-session.md) and
[ADR 0012](0012-household-members.md). Thread ACL stays
[ADR 0024](0024-threads-and-bot-visibility.md). Assistant Markdown
stays [ADR 0022](0022-chat-assistant-markdown.md). Kit parts stay
[ADR 0025](0025-chat-bubble-parts.md). The Cluster volume stays
[ADR 0005](0005-self-host-first.md). Chat LLM context stays
[ADR 0032](0032-chat-llm-context-assembly.md). Image Artifact vision
stays [ADR 0035](0035-image-artifact-vision.md). Host HTTP get and Bot
HTTP egress stay [ADR 0031](0031-host-http-get.md) and
[ADR 0033](0033-cluster-outbound-llm-vs-bot-http-proxy.md).

This record is the decision. It does not change Host or Store code.
The impl PR lands after this docs PR merges.

Nick locked the shape below on 2026-09-24 (grill Q1–Q25; competitor
STEAL amendments he accepted).

## Decision

An **Artifact** is a persisted Cluster file object: Store meta plus
bytes on the Cluster volume. UI may say «файл» or show a chip. An
**attachment** is that Artifact appearing on a Chat message (the
join). Attachment is not a second Store type.

### Storage

Bytes live on the existing Docker volume `cluster-data`, under
`/var/lib/dostigus/artifacts/<uuid>` (opaque uuid path). That is the
same volume as the Store
([ADR 0005](0005-self-host-first.md)). Local `pnpm` preview uses the
same layout next to the Store file (for example
`.data/artifacts/<uuid>`).

Meta lives in the Store: an `artifacts` table and a
**message↔artifact join**. Do **not** put Artifact refs in
`messages.parts_json`. [ADR 0025](0025-chat-bubble-parts.md) stays
Kit UI parts only (button, status, Chat Card).

Not SQLite BLOBs. Not S3 on day-1.

The Store row keeps a content hash for a later dedupe pass. Day-1
layout is uuid, not content-addressed.

### Limits

Numbers in this record:

| Limit | Day-1 |
| --- | --- |
| UI upload | ≤ **10 MiB** per file |
| Per message | ≤ **3** Artifacts |
| Mime allowlist (after sniff) | `image/*`, `application/pdf`, `text/plain`, `text/markdown` |
| Bot `put` `bytesBase64` | ≤ **1 MiB** |
| Text extract into LLM context | ≤ **32 KiB** per Artifact |
| Cluster hard quota | **512 MiB** total Artifact bytes |
| Pending (uploaded, never joined) | GC after **24h** |
| Incomplete multipart / partial | GC after ~**1h** |

Client `Content-Type` is a hint only. The Host **magic-byte sniffs**
the bytes and allowlists the sniffed type. A claimed type that does
not match the sniff is a reject.

Quota full is **HTTP 507** (or a clear storage-full error). The Host
never silently LRU-evicts a committed Artifact that a message still
joins.

Pending means uploaded and never linked to a message. Incomplete
multipart / partial files are a separate short TTL. After a message
unlink, refcount 0 is lazy / cron GC. Bot delete and Thread delete
unlink joins and take that same orphan path. There is no forever
«library» on day-1.

### API and ACL

`POST /api/artifacts` uses the Host session cookie and multipart.
It returns an Artifact id. The client may send **`uploadId`** plus
the content hash so a lost 200 can retry **idempotently**.

Send message accepts **`artifactIds[]`** with the text (rakazo-shaped
wire). That write creates the joins.

`GET /api/artifacts/:id` (and download) requires a session. It also
requires **message capability**: the caller may read only if some
message on a Thread they can open (a bot-thread they may open, or a
room they participate in) **references** that Artifact (Thread ACL
[ADR 0024](0024-threads-and-bot-visibility.md) plus the join). No
public URL and no signed URL on day-1.

When serving files under the artifacts directory, the Host
**path-jails** with `realpath` (or equivalent). The resolved path
must stay under that directory.

Who may upload or download is who may write or read that Thread:
the Owner, the Bot creator, and a grantee Member, under
[ADR 0024](0024-threads-and-bot-visibility.md).

### Actor Person

- A person upload stores that Owner or Member as the Artifact
  actor.
- Bot `put` stores the Person of the turn (the Chat user).
- A Schedule Wake stores the Household Owner as the actor.

### LLM and tools

On a configured Bot turn the Host injects into that turn's context:

- For `text/*`, and for extractable PDF / text when feasible: the
  body, capped at **32 KiB**.
- Otherwise: meta only (name, mime, size, id).

That inject is **mandatory** for text/* and for extractable PDF /
text on the **current triggering line**. Without a get tool, the
Bot must not see only filenames. The history window stays `role` +
`content`
([ADR 0032](0032-chat-llm-context-assembly.md)). The Host may add a
short per-line Artifact note (name, mime, size, id) when assembling
that window so a prior attach is visible. It does not re-send 32 KiB
bodies for every historical file.

**No `dostigus_artifacts_get`** tool. Native multimodal image parts
on the triggering user message are
[ADR 0035](0035-image-artifact-vision.md).

New MCP surface tool **`dostigus_artifacts_put`**: `filename`,
`mime`, and either `bytesBase64` (≤ 1 MiB) **or** `sourceUrl`.
`sourceUrl` uses the existing outbound HTTP helper and the same
SSRF / allowlist / Bot HTTP egress rules as `dostigus_http_get`
([ADR 0031](0031-host-http-get.md),
[ADR 0033](0033-cluster-outbound-llm-vs-bot-http-proxy.md)). On
success the Host **auto-attaches** the Artifact to the current
assistant message (the join). The LLM need not echo ids.

`dostigus_artifacts_put` is on Chat slim (Owner, creator-Member,
grantee) and on Wake. `/mcp` lists it. It is not Owner-only.

### UI

Unlock the composer **+** (today disabled «Attachments soon»).

Flow: **+** / drag-drop / paste → upload → pending chips → Send
with `artifactIds`.

Day-1 UX requirements:

- Window drag-drop with enter/leave **depth tracking**.
- An empty `FileList` must not steal a text paste.
- A long paste becomes a chip (it must not flood the composer).
- Optimistic local object URL preview while upload runs
  (non-durable; revoke on settle).

Bubble:

- `image/*` → thumb via session `GET`.
- PDF / text → chip (name, size, download).

That image preview is Kit + session GET. It is not raw `<img>` in
`content` and not Markdown `![]()`
([ADR 0022](0022-chat-assistant-markdown.md)).

## Context

The Host composer still ships a disabled **+** («Attachments soon»).
People and Bots need a Cluster file object they can attach to a
Chat line, download under Thread ACL, and (for text) show to the
LLM. The volume already holds the Store
([ADR 0005](0005-self-host-first.md)). Kit parts already hold
buttons and Cards
([ADR 0025](0025-chat-bubble-parts.md)). Those parts are the wrong
place for file refs: a join is what GC, quota, and download ACL
query.

The grill on 2026-09-24 settled Artifact as the Store type,
attachment as the join appearance, volume uuid paths, sniff
allowlist, 10 MiB / 3 / 512 MiB / 507, pending 24h plus partial ~1h,
session + message-capability GET, `artifactIds[]` on send,
`dostigus_artifacts_put` with auto-attach, text extract ≤ 32 KiB,
and no get tool. Image vision on the triggering line is
[ADR 0035](0035-image-artifact-vision.md).

Competitor notes (botato, OpenMausBot, rakazo; 2026-09-24) confirmed
the wire (upload then `artifactIds`), idempotent `uploadId` + hash,
hard 507 instead of silent LRU, window drop + paste guards, sniff,
and path-jail. This record does **not** copy OpenMausBot path-tags
in message text, or rakazo refs that live only inside message
blocks.

## Consequences

- The impl PR adds the Store tables, the volume directory, the
  session routes, the Chat send field, composer **+**, bubble thumb
  / chip, `dostigus_artifacts_put`, current-turn text extract, and
  the GC / quota checks. This record does not.
- [ADR 0022](0022-chat-assistant-markdown.md) still forbids raw
  `<img>` and Markdown images. Artifact thumbs are session GET.
- [ADR 0025](0025-chat-bubble-parts.md) does not grow an Artifact
  part kind. The join is the ref.
- [ADR 0032](0032-chat-llm-context-assembly.md) slim and Wake gain
  `dostigus_artifacts_put`. There is no get tool. History stays
  `role` + `content` plus the short Artifact note above. Triggering
  user-message image parts are
  [ADR 0035](0035-image-artifact-vision.md).
- Compose keeps one volume. Artifact bytes are another directory on
  it, not a second volume and not a new image path
  ([ADR 0005](0005-self-host-first.md)).
- Quota 507 is a hard stop. A full Cluster needs delete / GC, not
  silent eviction of joined bytes.
- Pending 24h GC must not touch an Artifact that a message already
  joins. Partial ~1h GC must not touch a finished upload.

### Out of scope

- Host or Store implementation. That is the impl PR.
- S3 and any other remote blob store.
- Signed URLs and public `/api/artifacts/:id` without a session.
- Gallery / lightbox.
- Virus scan.
- `dostigus_artifacts_get`.
- Sandbox materialize and path-attach (later, when computers exist).
- Content-addressed blob layout (hash stays in meta only).
- A Member file-share UI separate from the Thread.
- Office / audio / a broad mime set.
- Forever retention without quota.
- Path-tags in Chat `content` as the source of truth.
- Artifact refs only inside `parts_json` / message blocks.

## Alternatives

- SQLite BLOBs — rejected. Bytes on the volume. Meta in the Store.
- S3 on day-1 — rejected. Same volume as the Store
  ([ADR 0005](0005-self-host-first.md)).
- Put refs in `parts_json` or message blocks (rakazo) — rejected.
  [ADR 0025](0025-chat-bubble-parts.md) stays Kit UI parts. The join
  is what ACL and GC query.
- Embed `<attached-*>` path tags in message text (OpenMausBot) —
  rejected. Paths in transcripts break remaps and weaken the join.
- Public or signed download URLs — rejected. Session + message
  capability.
- Silent LRU of committed joined blobs when the volume fills —
  rejected. HTTP 507.
- Forever keep every committed upload (OpenMausBot) — rejected.
  Pending 24h, partial ~1h, orphan GC after unlink. No library.
- A `dostigus_artifacts_get` tool — rejected. Text extract ≤ 32 KiB
  or meta. Bot `put` auto-attaches. Image vision on the triggering
  line is [ADR 0035](0035-image-artifact-vision.md), not a get tool.
- Trust client mime without sniff — rejected. Magic-byte sniff, then
  allowlist.
- Content-addressed paths on day-1 — rejected. Hash in meta. Uuid
  path.
- Base64-only for person upload (rakazo create) — rejected.
  Session multipart for the Host. Base64 stays on Bot `put` ≤ 1 MiB.
- Broad Office / audio mime and 25 MiB docs — rejected. Narrow
  allowlist. UI 10 MiB. Three per message.
- Skip chat attachments (botato) — rejected. People and Bots attach
  on day-1. botato's honesty (no dead **+**) is why this record
  unlocks the control instead of leaving «soon».
- Sandbox materialize / path-attach on day-1 — rejected until
  computers exist. Follow-on, not this record.
- Virus scan on day-1 — rejected. Sniff + allowlist + size + quota
  are the bar.
