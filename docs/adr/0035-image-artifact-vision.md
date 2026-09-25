# ADR 0035: Image Artifact vision

- Status: accepted
- Date: 2026-09-25

Session and Household stay [ADR 0010](0010-owner-auth-session.md) and
[ADR 0012](0012-household-members.md). Thread ACL stays
[ADR 0024](0024-threads-and-bot-visibility.md). Artifact storage,
ACL, limits, text extract, history meta note, and
`dostigus_artifacts_put` stay [ADR 0034](0034-artifacts.md). Chat
LLM context assembly stays
[ADR 0032](0032-chat-llm-context-assembly.md). The gateway and retry
stay [ADR 0004](0004-llm-gateway-tiers.md). The tool loop stays
[ADR 0011](0011-chat-mcp-tool-loop.md). Assistant Markdown stays
[ADR 0022](0022-chat-assistant-markdown.md).

This record is the decision. It does not change Host or Store code.
The impl PR lands after this docs PR merges.

Nick locked the shape below on 2026-09-25 (grill Q1–Q22; all
«рекомендуемые»).

## Decision

On a configured Bot turn, when the **triggering line** has image
Artifacts, the Host may send **native multimodal** content on that
user message in the same OpenAI-compatible
`POST …/chat/completions` request
([ADR 0004](0004-llm-gateway-tiers.md),
[ADR 0032](0032-chat-llm-context-assembly.md)).

This is **not** a separate describe-model call. There is still **no**
`dostigus_artifacts_get` tool
([ADR 0034](0034-artifacts.md)).

### Wire shape

The triggering user message uses OpenAI content **parts**:

```
{ type: "text", text }
{ type: "image_url", image_url: { url: "data:image/jpeg;base64,…", detail: "auto" } }
```

`detail` is always `"auto"`. Vision wire is always JPEG
(`data:image/jpeg;base64,…`), including sources that were
`image/png`, `image/webp`, or `image/gif`.

### Which Artifacts get bytes

**Only** Artifacts joined to the **current triggering line**
(bot-thread user send, or a room mention that triggers the turn).

The history window stays [ADR 0032](0032-chat-llm-context-assembly.md)
`role` + string `content`, with the existing short Artifact meta
note (name, mime, size, id) from
[ADR 0034](0034-artifacts.md). It does **not** re-send historical
image bytes or `image_url` parts.

Wake is unchanged. A Wake line typically has no image joins.

### Tool loop

The multimodal user message (text + image parts) is kept on
**every** completion round of that turn's tool loop
([ADR 0011](0011-chat-mcp-tool-loop.md)).

### Mime and LLM wire transform

Multimodal admission mime (sniffed): `image/jpeg`, `image/png`,
`image/webp`, `image/gif` only. Other `image/*` stay meta-only as
today ([ADR 0034](0034-artifacts.md)).

**Original bytes stay** on the Cluster volume
(`/var/lib/dostigus/artifacts/<uuid>`) for session GET / thumbs.

For LLM wire only, the Host uses **sharp** to decode, resize **max
edge 2048**, and re-encode **JPEG quality ~80**. A GIF becomes the
first frame via decode, then that same JPEG wire.

Per-file:

- If after encode the JPEG wire is **> 1.5 MiB**, that Artifact is
  **meta only** for this turn. Other triggering-line Artifacts may
  still send vision parts.
- If read or downscale fails, that Artifact is **meta only**. The
  turn continues.

### Model allowlist (vision)

Case-insensitive **substring** match on the resolved model id:

`gpt-4o`, `gpt-4.1`, `gpt-5`, `claude-3`, `claude-4`,
`claude-sonnet`, `claude-opus`, `gemini`, `gemini-flash`.

If no match: **soft** — do not send image parts. Keep the
[ADR 0034](0034-artifacts.md) meta note, plus one RU line in the
triggering text part:

`Вложение-картинка есть; эта модель без vision — вижу только имя/размер.`

If the provider returns a modality / image error even when the
model is allowlisted: **one retry** of that completion **without**
image parts, plus the same soft note; then the normal error path
([ADR 0004](0004-llm-gateway-tiers.md)).

### Text alongside parts

Always keep the [ADR 0034](0034-artifacts.md) short **meta note**
in the text part when Artifacts are present, even when image parts
are attached.

If user `content` is empty and there are image Artifacts, the text
part placeholder is `"(изображение)"` (plus the meta note / soft
note as needed).

## Context

[ADR 0034](0034-artifacts.md) stores image Artifacts and shows
thumbs via session GET. On a configured turn it injects text
extract ≤ 32 KiB or else a short meta note. Day-1 of that record
sent no image bytes to the LLM. Defaults include `openai/gpt-4o`
([ADR 0004](0004-llm-gateway-tiers.md)), which is vision-capable
via OpenRouter. The Host Chat path already uses one
OpenAI-compatible `chat/completions` request
([ADR 0032](0032-chat-llm-context-assembly.md)). `content` on that
request is a string today.

People attach photos on a Chat line and expect the Bot to see
them on that turn. A second describe-model call would add latency
and another key path. A `dostigus_artifacts_get` tool would put
bytes behind a model hop the Host already has.

The grill on 2026-09-25 settled native multimodal parts on the
triggering user message only, JPEG wire via sharp (max edge 2048,
quality ~80, 1.5 MiB per-file cap), the substring allowlist, soft
degrade when the model lacks vision, one modality-error retry
without parts, the RU soft note, the `"(изображение)"`
placeholder, and tool-loop reuse of those parts.

Competitor notes (OpenMausBot, rakazo; 2026-09-25) confirmed
native vision on **current-turn** images and a soft gate when the
model lacks vision. Dostigus matches that scope and adds the
allowlist, JPEG downscale, and soft degrade for self-host model
overrides. This record does **not** copy OpenMausBot path-tags,
rakazo sandbox materialize, or vision for the full history
window.

## Consequences

- The impl PR adds sharp (catalog first), LLM content parts on the
  triggering user message, the wire transform, the allowlist, the
  soft note, and the modality-error retry. This record does not.
- [ADR 0034](0034-artifacts.md) stays the Artifact type, volume
  path, ACL, upload limits (10 MiB / ≤ 3), Cluster quota, text
  extract ≤ 32 KiB, history meta note, and `dostigus_artifacts_put`.
  There is still no get tool.
- [ADR 0032](0032-chat-llm-context-assembly.md) history lines stay
  string `content` plus that meta note. Slim tools stay unchanged.
  The triggering user message may use OpenAI content parts.
- [ADR 0004](0004-llm-gateway-tiers.md) still owns the gateway,
  tiers, and transient retry. This record adds one extra retry
  when an allowlisted model returns a modality / image error:
  resend that completion without image parts, then the normal
  error path.
- [ADR 0011](0011-chat-mcp-tool-loop.md) still owns the in-process
  loop and cap. The multimodal user message stays on every round
  of that turn.
- [ADR 0022](0022-chat-assistant-markdown.md) still forbids raw
  `<img>` and Markdown images in Chat `content`. Vision parts are
  the LLM wire, not bubble HTML.
- Original Artifact bytes on the volume do not change. Session GET
  / thumbs keep the stored file. Only the LLM wire is JPEG
  downscale.
- A self-host model override that misses the allowlist still
  completes the turn. The Bot sees name / mime / size / id and
  the RU note, not a hard-fail.
- `sharp` is a Host / workspace catalog dependency in the impl
  PR. Pure-JS resize is not the path.

### Out of scope

- Host or Store implementation. That is the impl PR.
- Vision for history-window messages.
- `dostigus_artifacts_get`.
- Sandbox materialize / path-attach.
- Signed or public URLs.
- Owner Settings «vision» toggle UI.
- A separate describe-then-text model.
- Changing upload limits (10 MiB / ≤ 3) or Cluster quota
  ([ADR 0034](0034-artifacts.md)).
- Virus scan, gallery / lightbox.

## Alternatives

- Describe-then-text as the primary path — rejected. One
  `chat/completions` request with native parts.
- Vision for the full history window — rejected. Triggering line
  only. History stays the [ADR 0034](0034-artifacts.md) meta note.
- Always send parts with no allowlist — rejected. Case-insensitive
  substring match. Soft degrade on a miss.
- Raw ≤ 10 MiB bytes to the provider without downscale —
  rejected. sharp, max edge 2048, JPEG quality ~80, 1.5 MiB
  per-file wire cap.
- Hard-fail the turn when the model lacks vision — rejected.
  Soft note in the text part. Meta stays.
- GIF animated data-URL as wire — rejected. Decode, first frame,
  JPEG wire.
- Pure-JS resize only / no sharp — rejected. Host uses sharp.
- Denylist-only model gate — rejected. Allowlist substrings
  above.
- `dostigus_artifacts_get` so the model fetches bytes —
  rejected. Same as [ADR 0034](0034-artifacts.md). The Host
  already has the join.
- Signed or public image URLs for the provider — rejected.
  Data-URL JPEG on the request. Session GET stays for the Host
  UI.
