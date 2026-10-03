# Architecture decision records

Read this index before changing the Platform. Glossary:
[`CONTEXT.md`](../../CONTEXT.md). Scope: [`docs/SPEC.md`](../SPEC.md).

**Next number = max + 1.** The highest file is ADR 0048, so the next ADR
is **0049**. Name it `0049-short-kebab-title.md` (four digits). When you
add a record, add a row here and set the next number to that file’s
number plus one.

## Usual headings

```
# ADR NNNN: Title

- Status: accepted
- Date: YYYY-MM-DD

## Decision

## Context

## Consequences

## Alternatives
```

`Status` and `Date` sit above those four headings. Write the record in
English.

## Index

| ADR | Title |
| --- | --- |
| [0001](0001-platform-git-vs-in-cluster-bot-packages.md) | Platform git vs in-cluster bot packages (amended 2026-09-26: Pack share vs Bot backup [0039](0039-pack-vs-bot-portable-recipe.md)) |
| [0002](0002-host-ui-kit-and-sheets.md) | Host UI kit and Sheets (amended 2026-09-26: Pack HTML `ui/` is a sandboxed iframe in the Sheet shell [0039](0039-pack-vs-bot-portable-recipe.md); amended 2026-09-28: Kit form and surface primitives [0013](0013-kit-reka-ui-and-brand.md)) |
| [0003](0003-mcp-as-bot-store-contract.md) | MCP as the Bot ↔ store contract |
| [0004](0004-llm-gateway-tiers.md) | LLM gateway and model tiers (amended 2026-09-24: one transient retry, Russian error copy; Chat assembly [0032](0032-chat-llm-context-assembly.md); amended 2026-09-25: triggering-line image parts [0035](0035-image-artifact-vision.md); amended 2026-09-25: bind / resolve / escalate [0036](0036-llm-providers-tier-resolve-escalate.md); OpenRouter Policy `free` on cheap/toy for casual supersedes “roulette is toy only”; amended 2026-09-25: OpenRouter Settings catalog stays [0036](0036-llm-providers-tier-resolve-escalate.md); amended 2026-09-26: Store key is Provider `apiKey` only [0036](0036-llm-providers-tier-resolve-escalate.md)) |
| [0005](0005-self-host-first.md) | Self-host first |
| [0006](0006-day-1-declarative-modules.md) | Day-1 declarative modules (before arbitrary sandbox; Pack HTML ui is [0039](0039-pack-vs-bot-portable-recipe.md), not this sandbox) |
| [0007](0007-platform-image-tags.md) | Platform image tags |
| [0008](0008-host-store-routes.md) | Host Store routes for Bots and Chat |
| [0009](0009-mcp-toolkit-endpoint.md) | MCP toolkit endpoint |
| [0010](0010-owner-auth-session.md) | Owner auth and Host session |
| [0011](0011-chat-mcp-tool-loop.md) | Chat ↔ MCP tool loop (amended 2026-09-24: retry one completion, not the tool loop; slim + expand [0032](0032-chat-llm-context-assembly.md)) |
| [0012](0012-household-members.md) | Household Members on the Host (Bot visibility: [0024](0024-threads-and-bot-visibility.md)) |
| [0013](0013-kit-reka-ui-and-brand.md) | Kit on Reka UI, Sheet shell, and Brand (amended 2026-09-28: form and surface primitives `KitPanel`, `KitField`, `KitInput`, `KitTextarea`, `KitSelect`, `KitToggle`, `KitChip`, `KitListRow`; proof on Cluster settings) |
| [0014](0014-host-messenger-shell.md) | Host messenger shell |
| [0015](0015-host-desktop-shell.md) | Host desktop shell |
| [0016](0016-bot-avatar-tokens.md) | Bot avatar tokens |
| [0017](0017-goose-mark-avatar.md) | Goose mark avatar + hue-ordered palette (superseded by [0018](0018-bot-mark-flock.md)) |
| [0018](0018-bot-mark-flock.md) | Bot marks — an eight-bird flock with named parts |
| [0019](0019-bot-picker-and-chat-purpose.md) | Bot picker and Chat purpose |
| [0020](0020-bot-closet.md) | Bot closet (amended 2026-09-24: «Расписания» block; amended 2026-10-02: Owner/Admin mail bind Sheet after Mailer Apply [0048](0048-mailer-product.md); impl later) |
| [0021](0021-chat-activity-status.md) | Chat activity status row (amended 2026-09-24: thinking, tool, typing; status-line sweep) |
| [0022](0022-chat-assistant-markdown.md) | Chat assistant Markdown body (amended 2026-09-24: Artifact image preview via Kit/GET is [0034](0034-artifacts.md); raw `<img>` / MD images stay forbidden; amended 2026-09-25: GFM tables on the assistant allowlist; lone or malformed `|` stays plain text) |
| [0023](0023-household-member-invites.md) | Household Member Invites (an Invite does not grant Bots; [0024](0024-threads-and-bot-visibility.md)) |
| [0024](0024-threads-and-bot-visibility.md) | Threads and Bot visibility (amended 2026-09-24: personal Bot + grants; amended 2026-10-01: roster Sheet, add a person or Bot after create, first Bot makes a `group` a `room`) |
| [0025](0025-chat-bubble-parts.md) | Chat bubble parts (Bot visibility stays [0024](0024-threads-and-bot-visibility.md); Artifact refs are the join, not `parts_json` [0034](0034-artifacts.md)) |
| [0026](0026-kitchen-module-day-1.md) | Kitchen Module day-1 |
| [0027](0027-bot-schedules.md) | Host Bot Schedules (amended 2026-09-24: closet list, create/detail Sheets; Wake tools [0032](0032-chat-llm-context-assembly.md); amended 2026-09-26: visible Wake is the Schedule name, `wakeText` is LLM-only; amended 2026-10-01: Case follow-up Wake on the Case Thread is a sibling path [0044](0044-case-inbox-and-follow-up-wakes.md); personal Schedule stays bot-thread-only; amended 2026-10-02: Mailer v1 check cadence is existing `daily`/`weekly` Wake [0048](0048-mailer-product.md); no IMAP IDLE, no N-minute poll) |
| [0028](0028-bot-self-settings-via-chat.md) | Bot self-settings via Chat (amended 2026-09-24: closet Schedule list stays [0027](0027-bot-schedules.md); Skill `description` + catalog [0032](0032-chat-llm-context-assembly.md)) |
| [0029](0029-turn-journal.md) | Turn journal (amended 2026-09-24: harness smoke; Schedule run history reads journal rows; amended 2026-09-25: modelId / modelTier / visionParts observability; amended 2026-09-25: servedModelId + token usage on the Turn; amended 2026-09-25: escalate may resolve more than once [0036](0036-llm-providers-tier-resolve-escalate.md); journal stays last successful / last attempted resolve + llmCallCount) |
| [0030](0030-chat-cards-module-catalog.md) | Chat Cards for Schedule changes (amended 2026-09-24: no stock Module packages; Skill and self-settings success is a system Chat line, not a Card; meta Skills insert-if-missing on Bot create; Card «Изменить» opens closet detail; meta Skills catalog + read [0032](0032-chat-llm-context-assembly.md); amended 2026-09-26: day-1 marketplace track for Packs is [0039](0039-pack-vs-bot-portable-recipe.md); Module package Apply stays later; amended 2026-10-02: public Marketplace is [0045](0045-pack-catalog-on-marketing-site.md); amended 2026-10-02: Catalog Store on cloud [0047](0047-marketplace-catalog-store.md)) |
| [0031](0031-host-http-get.md) | Host HTTP get and Cluster http allowlist (amended 2026-09-24: allowlist Chat tools behind expand [0032](0032-chat-llm-context-assembly.md); Bot HTTP egress [0033](0033-cluster-outbound-llm-vs-bot-http-proxy.md); soft retry / pursue-result in tool text + `platform-meta-http-get`; amended 2026-10-02: Mailer IMAP/SMTP is not this allowlist [0048](0048-mailer-product.md); amended 2026-10-03: Cluster mail allowlist rejected; mailbox host is Closet bind [0048](0048-mailer-product.md)) |
| [0032](0032-chat-llm-context-assembly.md) | Chat LLM context assembly (amended 2026-09-24: slim + Wake gain `dostigus_artifacts_put`; no get tool [0034](0034-artifacts.md); amended 2026-09-25: triggering user message may use content parts [0035](0035-image-artifact-vision.md); amended 2026-09-26: Wake `wakeText` is current-turn LLM content, stored line is the Schedule name [0027](0027-bot-schedules.md); amended 2026-10-02: Chat slim and Wake gain `dostigus_mail_list` / `mail_get` / `mail_send` when Mailer Host tools land [0048](0048-mailer-product.md); send confirm-gated) |
| [0033](0033-cluster-outbound-llm-vs-bot-http-proxy.md) | Cluster outbound: LLM proxy vs Bot HTTP proxy (amended 2026-09-24: domain failover lists stay out of scope; soft policy is [0031](0031-host-http-get.md); amended 2026-10-02: IMAP/SMTP is not Bot HTTP egress and does not use `DOSTIGUS_HTTP_PROXY` [0048](0048-mailer-product.md)) |
| [0034](0034-artifacts.md) | Artifacts (amended 2026-09-25: image vision is [0035](0035-image-artifact-vision.md); no get tool stays) |
| [0035](0035-image-artifact-vision.md) | Image Artifact vision |
| [0036](0036-llm-providers-tier-resolve-escalate.md) | LLM Providers, tier resolve, and escalate (amended 2026-09-25: OpenRouter Settings catalog + quality shelf; Advanced pin is day-1 of this amend for `kind=openrouter`; amended 2026-09-25: Settings IA — Провайдеры / Прочее, health from key + soft catalog probe; amended 2026-09-25: chrome slugs `/dashboard/providers` and `/dashboard/cluster`, no `/settings` redirects [0038](0038-dashboard-chrome.md); amended 2026-09-26: Provider `apiKey` is the only Store SoT; one-shot migrate then drop `llm_gateway.api_key`) |
| [0037](0037-host-ui-i18n.md) | Host UI i18n (EN/RU) (amended 2026-09-26: Thread chrome is chat / чат; amended 2026-10-02: Host `no_prefix` stays; Site URL prefix is [0046](0046-site-i18n-url-prefix.md)) |
| [0038](0038-dashboard-chrome.md) | Dashboard chrome (own layout; Settings is one page; Members under Account; no `/settings` or `/members` redirects) |
| [0039](0039-pack-vs-bot-portable-recipe.md) | Pack vs Bot portable recipe (Pack ≠ Bot ≠ Module package; Export Pack vs Export Bot backup; HTML `ui/` in a sandboxed iframe; amended 2026-09-28: RU translit, Export Sheet, seed Skill filter, Export stamps snapshot, Schedule provenance; amended 2026-09-28: URL / git Apply; amended 2026-10-02: public Marketplace is [0045](0045-pack-catalog-on-marketing-site.md); amended 2026-10-02: cloud Catalog Store + deep-link Apply [0047](0047-marketplace-catalog-store.md); amended 2026-10-02: Mailer Pack `dostigus.mailer` is [0048](0048-mailer-product.md); secrets still never in the zip) |
| [0040](0040-collective-host-direction.md) | Collective Host product direction (Collective of 1…N people; messenger + personal / shared Bots + MCP to external systems; Rooms gaps, then Case-lite [0041](0041-case-lite-on-thread.md); roles Owner / Admin / Member [0042](0042-admin-role-and-share-permission.md); audiences Owner-operator and Team 2–15 [0043](0043-target-personas.md); Case inbox + follow-up Wakes [0044](0044-case-inbox-and-follow-up-wakes.md); Packs for verticals; public Marketplace [0045](0045-pack-catalog-on-marketing-site.md); Catalog Store on cloud [0047](0047-marketplace-catalog-store.md); Mailer IMAP/SMTP Pack [0048](0048-mailer-product.md); Pro out of public field; no Pages, sales pipeline, light theme, or SaaS cloud in v1) |
| [0041](0041-case-lite-on-thread.md) | Case-lite on a Thread (Case on `group` / `room` only; status `open` \| `done`, label ≤40, nextAction ≤120; person Participant PATCH; nullable `threads` columns; on-thread UI; Case inbox + follow-up Wakes [0044](0044-case-inbox-and-follow-up-wakes.md)) |
| [0042](0042-admin-role-and-share-permission.md) | Admin role and share permission (`members.role` `admin` \| `member`; Owner stays [0010](0010-owner-auth-session.md); Admin opens Providers, Members invite/list, Dashboard read; Member grants only own personal Bots; Case / roster stay person Participant; Admin day-to-day / Owner keys [0043](0043-target-personas.md); docs only) |
| [0043](0043-target-personas.md) | Target personas (Owner-operator = Collective N=1; Team 2–15 leads; Member secondary; Case inbox + follow-up Wakes [0044](0044-case-inbox-and-follow-up-wakes.md); Admin Cluster Bot list + Member onboarding should next; one MCP after first external Collective; docs only) |
| [0044](0044-case-inbox-and-follow-up-wakes.md) | Case inbox and follow-up Wakes (filter chips on the messenger Threads list, `?caseStatus=open`; one-shot follow-up Wake on the Case Thread; `followUpAt` + `followUpBotId` on `threads`; amends [0027](0027-bot-schedules.md); docs only) |
| [0045](0045-pack-catalog-on-marketing-site.md) | Marketplace on the marketing site (dostigus.ru `/marketplace`; Packs first catalog kind; `/packs` 301; Host Closet out-link; Pro out of public field; not in-product Apply; amended 2026-10-02: Closet Параметры Pack row; amended 2026-10-02: Site locale URLs [0046](0046-site-i18n-url-prefix.md); amended 2026-10-02: Catalog Store on cloud + deep-link Apply [0047](0047-marketplace-catalog-store.md) supersede static-only catalog and copy-URL-only CTA; amended 2026-10-02: Mailer listing after Host tools [0048](0048-mailer-product.md)) |
| [0046](0046-site-i18n-url-prefix.md) | Site i18n URL prefix (dostigus.ru `prefix_except_default`; unprefixed = RU, EN `/en/...`; first visit RU; URL wins over cookie; hreflang + `x-default` RU; one sitemap; Host out-link stays RU; docs only) |
| [0047](0047-marketplace-catalog-store.md) | Marketplace Catalog Store (on marketing site / dostigus.ru, not Platform Host; hybrid `{id}-{version}.zip` mirror; public read API; deep-link `applyPack=` cloud zip → `PackApplySheet`; Host #189 misplaced / removed; Host-pulled catalog still rejected; Nick publish v1; migrate Kitchen / Mail / Reader; docs only; amended 2026-10-02: Mailer product is [0048](0048-mailer-product.md)) |
| [0048](0048-mailer-product.md) | Mailer product (IMAP / SMTP Pack `dostigus.mailer`; Cluster Bot mail binding; mailbox host is Closet bind; no Cluster mail allowlist; Host `dostigus_mail_list` / `mail_get` / `mail_send`; draft send until confirm; one mailbox per Bot; `daily`/`weekly` Wake; not `dostigus.mail`; Pack/Bot security limits stay on the Bot; amended 2026-10-03 docs only) |
