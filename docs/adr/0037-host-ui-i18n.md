# ADR 0037: Host UI i18n (EN/RU)

- Status: accepted
- Date: 2026-09-25

Session and Household stay [ADR 0010](0010-owner-auth-session.md) and
[ADR 0012](0012-household-members.md). Settings information
architecture stays
[ADR 0036](0036-llm-providers-tier-resolve-escalate.md)
(**Провайдеры** / **Прочее**). The closet Sheet stays
[ADR 0020](0020-bot-closet.md). Skills stay one `instructions`
string with no locale column
([ADR 0028](0028-bot-self-settings-via-chat.md),
[ADR 0030](0030-chat-cards-module-catalog.md)). Cluster timezone
stays [ADR 0027](0027-bot-schedules.md). Chat assembly and MCP
tool descriptions stay
[ADR 0032](0032-chat-llm-context-assembly.md) and
[ADR 0003](0003-mcp-as-bot-store-contract.md). The LLM gateway
and error-bubble *existence* stay
[ADR 0004](0004-llm-gateway-tiers.md); this record owns Locale
for Host chrome that shows that copy.

This record is the decision. It does **not** change Host, Kit,
or Store code, and it does not install `@nuxtjs/i18n`. One impl
PR lands after this docs PR merges. Ask Nick before that impl
merges or goes to Port.

Nick locked the shape below on 2026-09-25. Do not reopen these
locks in the impl PR.

## Decision

The Host presents chrome in a **Locale**. Day-1 Locales are
`en` and `ru`. Default Locale is `en`.

### Stack

Use **`@nuxtjs/i18n`** (vue-i18n) in `apps/web`, with **typed
messages**. English is the source of truth for keys and types
(`DefineLocaleMessage` / codegen from the EN dictionary). A
TypeScript unknown-key use fails typecheck.

### Day-1 scope

**In scope** (translate these):

- Host chrome: buttons, Settings, Closet, placeholders, form
  errors
- Kit strings the Host uses (button labels, Sheet chrome, and
  other Kit copy the Host renders)

**Out of scope** (stay as stored / authored; do not run through
the Host dictionary):

- Chat message bodies (user, assistant, and system `content`)
- Bot Skills and prompts (one `instructions` string; no Skill
  locale column)
- MCP tool descriptions (stay English for agents)
- README and other repo docs (English only)
- LLM / Bot reply language (not this record; a later ADR if
  needed)

### Persistence and URLs

- `@nuxtjs/i18n` `strategy: no_prefix`. There is no `/en` or
  `/ru` URL prefix.
- Signed-out Host: cookie `dostigus_locale`.
- Signed-in Member: Store column **`Member.locale`**. On first
  login, a present cookie may seed that column when it is still
  null.
- Migration: existing Member rows with a null Locale become
  `en`.
- The Owner changes Locale on Dashboard → Cluster settings
  (`/dashboard/cluster`, [ADR 0038](0038-dashboard-chrome.md)). That write updates the cookie. The impl
  PR persists the Owner's choice for later visits (the cookie,
  and an Owner Store field in that same PR if a cookie is not
  enough). Do not add a second switcher.

A Member does not open Settings
([ADR 0012](0012-household-members.md)). Day-1 has no
Member-visible Locale control and no permanent flag chrome in
the Host sidebar.

### Dictionaries

Central nested JSON:

`packages/ui-kit/locales/{en,ru}.json`

Host chrome and Kit strings the Host uses share that pair. A
new language is copy `en.json` → `xx.json` and translate. Do
not split a second Host-only tree on day-1.

### Product glossary terms

Terms from [`CONTEXT.md`](../../CONTEXT.md) stay **Latin
script** in every Locale, including RU chrome. Translate only
the surrounding chrome words.

Examples that stay Latin: Bot, Host, Cluster, Skill, Schedule,
Provider, Policy, Artifact, Member, Household.

### Safety

- Typecheck fails on unknown message keys.
- CI runs a key-parity test: EN and RU dictionaries have the
  **same key set**.
- Runtime falls back to EN. The Host **never** shows a raw
  `a.b.c` key path in the UI.

### Language switcher

Settings → **Прочее**: an EN / RU list. No permanent flag
chrome.

### Preview

`preview:host` and `shoot:preview` always use `en`, so README
screenshots stay stable. Those paths ignore the cookie and
`Member.locale`.

### LLM / Bot reply language

Not this ADR. Do not send Locale into the LLM gateway or rewrite
Skill / prompt language on day-1.

## Context

Host chrome today is mostly hardcoded Russian (closet
[ADR 0020](0020-bot-closet.md), Settings nav, form errors).
Docs and MCP tool descriptions stay English. The Cluster is a
Household ([ADR 0012](0012-household-members.md)): more than
one person signs in, and a signed-out visitor hits login /
Invite accept before a Member row exists.

A URL prefix (`/en`, `/ru`) would fork every Host route,
including Settings child slugs from
[ADR 0036](0036-llm-providers-tier-resolve-escalate.md). A
browser `Accept-Language` guess without a Store column would
change chrome under a Member who already chose. Translating
product glossary terms into Cyrillic would break the
[`CONTEXT.md`](../../CONTEXT.md) rule that those names stay
stable in UI copy.

Skills already rejected a locale column
([ADR 0028](0028-bot-self-settings-via-chat.md)). Chat bodies
are what people and Bots wrote. MCP descriptions are for
agents. Those are not Host chrome.

`preview:host` / `shoot:preview` feed the public README
screenshots. A Locale flip there would churn those images
without a product change.

Nick locked stack, scope, persistence, dictionaries, Latin
glossary terms, safety, the Settings → Other switcher, preview
always EN, and “LLM reply language is later” on 2026-09-25.

## Consequences

- This docs PR adds the record and glossary terms only.
- **One impl PR** after this record merges (do not implement
  here):
  1. Scaffold `@nuxtjs/i18n` in `apps/web` (typed messages; EN
     is the key/type source; `strategy: no_prefix`; default
     `en`).
  2. Wire Kit locales from
     `packages/ui-kit/locales/{en,ru}.json`.
  3. Add `Member.locale` (Store column + migration; null →
     `en`) and cookie `dostigus_locale` (signed-out; may seed
     on first login).
  4. Add the EN / RU list on Settings → **Прочее**.
  5. Move day-1 Host chrome and Kit-used strings into the
     dictionaries.
  6. Add the CI key-parity test (EN ↔ RU same key set) and
     EN runtime fallback (no raw key paths).
- Ask Nick before that impl PR merges or goes to Port.
- [ADR 0020](0020-bot-closet.md) “Host copy on that Sheet is
  Russian” is superseded for chrome: Closet labels become
  dictionary strings. Docs stay English. Product terms stay
  Latin.
- [ADR 0004](0004-llm-gateway-tiers.md) still owns the
  error-bubble path. The visible chrome string follows Locale.
- [ADR 0036](0036-llm-providers-tier-resolve-escalate.md)
  Settings IA stays two pages. The switcher is another **Прочее**
  control, not a third Settings tab.
- Cluster timezone is not Locale. `cluster_settings.timezone`
  stays [ADR 0027](0027-bot-schedules.md).
- Skills still have no locale column.
- `preview:host` and `shoot:preview` stay EN.
- Glossary terms **Locale**, **Member.locale**, and **Locale
  dictionary** live in [`CONTEXT.md`](../../CONTEXT.md).

### Out of scope

- Host, Kit, or Store implementation in this docs PR
- Installing `@nuxtjs/i18n` in this docs PR
- Chat message bodies
- Bot Skills / prompts, or a Skill locale column
- MCP tool descriptions
- README / repo docs translation
- LLM / Bot reply language
- `/en` or `/ru` URL prefixes
- Permanent flag chrome
- A Member-visible switcher on day-1
- Translating CONTEXT glossary terms into Cyrillic
- Showing raw message-key paths in the UI
- Localizing `preview:host` / `shoot:preview`
- Marketplace, Share link, guests, agent runtime, Meal port,
  Builder Module-package writer

## Alternatives

- Custom composable or `vue-i18n` without `@nuxtjs/i18n` —
  rejected. Nuxt module plus typed messages.
- `strategy: prefix` (`/en`, `/ru`) — rejected. `no_prefix`.
- Browser `Accept-Language` as the Store of truth — rejected.
  Cookie before login; `Member.locale` after.
- One Cluster-wide Locale and no per-Member column — rejected.
- Translate Bot, Host, Cluster, Skill, and the other glossary
  terms in RU UI — rejected. Latin script. Chrome words only.
- Show the raw `a.b.c` key on a miss — rejected. Fall back to
  EN.
- Permanent flag chrome in the sidebar — rejected. Settings →
  **Прочее** list only.
- Put Chat bodies, Skills, MCP descriptions, or README in the
  dictionaries — rejected. Day-1 is Host chrome + Kit strings
  the Host uses.
- Fold LLM / Bot reply language into this record — rejected.
  Later, if needed.
- Let `preview:host` / `shoot:preview` follow the cookie —
  rejected. Always EN.
- Split Host-only JSON from `packages/ui-kit/locales` on
  day-1 — rejected. One central pair.
- Implement the stack in this docs PR — rejected. Decision
  first; one impl PR after merge.
- Mint a second ADR for the switcher or the cookie — rejected.
  One record.
