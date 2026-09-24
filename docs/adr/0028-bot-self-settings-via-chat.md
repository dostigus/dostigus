# ADR 0028: Bot self-settings via Chat

- Status: accepted
- Date: 2026-09-24
- Amended: 2026-09-24 — a missing capability stays on the constructor tools in this record (Skills upsert, Schedules, Bot self-settings). [ADR 0030](0030-chat-cards-module-catalog.md) is Schedule Chat Cards. A successful Skill upsert or delete, or a Bot self-settings update of name, label, or description, writes a system Chat line. It does not add a stock package. The tools in this record stay. There is no Card kind `skill` or `bot` and no Sheet id `skill` from a Card.
- Amended: 2026-09-24 — on Bot create the Host may insert meta Skills (constructor how-to). Ids, Russian text, and insert-if-absent are [ADR 0030](0030-chat-cards-module-catalog.md). The tools and the platform instruction in this record stay. Deleting a meta Skill does not remove that duty.
- Amended: 2026-09-24 — Skills live in `bots.skills_json` as `{ id, instructions }` (`packages/db/src/skills.ts`). A Skill id is letters, digits, `_`, or `-` (`parseSkillId` in `packages/shared/src/skill.ts`). One `instructions` string; no locale column.

Chat turns stay [ADR 0011](0011-chat-mcp-tool-loop.md). The closet
fields stay [ADR 0020](0020-bot-closet.md). Who may edit a Bot stays
[ADR 0024](0024-threads-and-bot-visibility.md). Schedule tools, the
Schedule row, and the ticker stay
[ADR 0027](0027-bot-schedules.md).

## Decision

**Self-settings** is a person's request in Chat that the Bot change
itself: name, label, description, Skills, or Schedules. The Bot writes
the Store by calling MCP surface tools. A reply that only says the
change happened is not the write.

Claiming success without a successful tool result is wrong. The
platform rule forbids it.

### Platform rule

The Host injects one short always-on instruction into every Bot turn.
The instruction is not a Manifest field and not a Skill. It says:
Self-settings use the MCP surface; do not assert success without a
successful tool result.

The instruction is on every turn. That includes an Owner turn, a
Member turn, a room mention, and a Wake
([ADR 0011](0011-chat-mcp-tool-loop.md),
[ADR 0027](0027-bot-schedules.md)).

A Skill may add domain procedure. Rename, Schedule changes, and other
self-edits are a platform duty. They do not depend on a Skill being
present.

### Manifest

Day-1 Chat writes name, label, and description through the existing
`dostigus_bots_update`. There is no second update tool.

Validation matches the closet ([ADR 0020](0020-bot-closet.md)). An
empty name is rejected. Length limits on name, label, and description
stay as they are. Label and description stay optional.

`avatarShape` and `avatarColor` stay on the closet. They are not Chat
self-settings. `modelTier` is not Chat self-settings. It stays on
Owner Settings and on the existing MCP path. The tool may still accept
those fields for that path. A Chat self-settings write does not send
them.

Delete of a Bot, and delete of Chat, stay off Chat
([ADR 0011](0011-chat-mcp-tool-loop.md)).

### Skills

Day-1 adds MCP surface tools that list, upsert, and delete Skill text
on that Bot. That is create, read, update, and delete of the
instructions. It is not a Module package and not the Builder.

| Tool | Who |
| --- | --- |
| `dostigus_skills_list` | the creator of that Bot, or the Owner |
| `dostigus_skills_upsert` | the creator of that Bot, or the Owner |
| `dostigus_skills_delete` | the creator of that Bot, or the Owner |

A Skill is an id plus one `instructions` string. There is no locale
column. The id is letters, digits, `_`, or `-` only. A dotted id is
not a Skill id. `parseSkillId` in `packages/shared/src/skill.ts`
checks that charset.

Skills live in `bots.skills_json` as `{ id, instructions }`
(`packages/db/src/skills.ts`). `Manifest.skillIds` is those ids. No
new table and no new column.

On Bot create, the Host may insert meta Skills (constructor how-to) on
that Bot. The ids, the Russian instructions, and the rule that an
existing id is not overwritten are
[ADR 0030](0030-chat-cards-module-catalog.md). The creator or the Owner
edits or deletes them with the tools in this section. The seed does
not call `upsertBotSkill` or `dostigus_skills_upsert` (those replace
instructions).
The rows are not a new tool, not a Module package, and not the
platform instruction above. Deleting one does not remove the platform
duty.

These tools are MCP surface tools. Chat calls the same handlers
in-process ([ADR 0011](0011-chat-mcp-tool-loop.md)). `/mcp` Bearer auth
is unchanged ([ADR 0009](0009-mcp-toolkit-endpoint.md)).

### Schedules

Schedule tools and behavior stay
[ADR 0027](0027-bot-schedules.md). This record does not repeat the
row, the timezone, or the ticker. A Chat request to create or change a
Schedule is Self-settings: the Bot calls those tools. The Host does
not parse the sentence.

Who may write a Schedule stays that record: the person on their
bot-thread, and the Owner.

### Who

| Change | Who may write from Chat |
| --- | --- |
| name, label, description | the creator of that Bot, or the Owner |
| Skills | the creator of that Bot, or the Owner |
| Schedules | that person on their bot-thread, or the Owner ([ADR 0027](0027-bot-schedules.md)) |

A grantee cannot change the Manifest or Skills. The closet already
limits Manifest edit to the creator and the Owner
([ADR 0024](0024-threads-and-bot-visibility.md)). Chat uses the same
actors.

The allowlist follows the viewer and that Bot, on every turn kind
(bot-thread, room, Wake). Thread kind does not give a grantee Manifest
or Skills tools.

Today Owner Chat already lists `dostigus_bots_update`. Member Chat
tools are `dostigus_messages_list` and `dostigus_messages_create`
only. The Member system prompt says not to create, rename, or delete
Bots. A Member who created the Bot can edit it in the closet and
cannot change it from Chat.

This record closes that gap. A creator who is a Member receives
`dostigus_bots_update` and the Skills tools on their own Bot. A Member
who is only a grantee does not receive those tools. The Owner receives
Manifest and Skills tools for any Bot. The "do not rename" line does
not apply to the Owner, and it does not apply to a creator on their
own Bot.

Schedule tools stay on the [ADR 0027](0027-bot-schedules.md) scope.
That scope is wider than Manifest and Skills: a grantee may still
manage Schedules on their own bot-thread.

Learning still does not write the Manifest by itself
([ADR 0024](0024-threads-and-bot-visibility.md)). An explicit
self-settings request does, through the tools above.

### Confirm

After a successful tool result, the Bot confirms the fact in a short
reply. On failure, it reports the error. It never claims the Store
changed when the tool did not succeed.

### UI refresh

After a successful `dostigus_bots_update` or Skills tool in a Host
Chat turn, the Manifest shows in the Chat pill, the sidebar, and an
open closet Sheet. The Chat page already refreshes the Bot, the Bot
list, and Threads when the message POST completes
(`apps/web/app/pages/bots/[id].vue`). Keep that refresh. Do not
require a full page reload.

The name may stay the previous name while Activity is in flight. That
is fine. The refresh runs when the turn completes.

A raw `/mcp` write while a Chat page is already open may leave that
page stale until the next refresh. That edge is acceptable for day-1.

## Context

[ADR 0003](0003-mcp-as-bot-store-contract.md) is the Bot ↔ Store
contract. [ADR 0011](0011-chat-mcp-tool-loop.md) runs those tools in
the Chat loop. [ADR 0020](0020-bot-closet.md) is the closet for name,
label, description, and appearance. [ADR 0024](0024-threads-and-bot-visibility.md)
lets the creator and the Owner edit the Manifest, and a grantee chat
without that edit. [ADR 0027](0027-bot-schedules.md) is when the Host
wakes a Bot.

People ask the Bot to rename itself, change its label or description,
edit a Skill, or set a Schedule. A reply of "ok" does not write the
Store. The grill on 2026-09-24 requires the tool call, a platform
instruction on every turn, and a Host refresh of the Manifest after
that turn.

Code today, not reopened by this record:

- `dostigus_bots_update` accepts `name`, `label`, `description`,
  `avatarShape`, `avatarColor`, and `modelTier`. It has no Skills
  field. This record does not add a second update tool.
- Skills live in `bots.skills_json` as `{ id, instructions }`
  (`packages/db/src/skills.ts`). `Manifest.skillIds` is those ids.
  List, upsert, and delete use that column. This record does not add
  a new table.
- Owner Chat lists `dostigus_bots_update`. Member Chat is messages
  only, and the Member prompt says not to rename. The closet already
  lets a Member creator edit. Chat does not. The code PR aligns the
  Chat allowlist with those closet rights.
- `apps/web/app/pages/bots/[id].vue` refreshes the Bot, the Bot list,
  and Threads after the turn completes.

## Consequences

- The code PR adds the platform instruction, the Skills tools, and the
  creator-Member Chat allowlist. This record does not.
- `dostigus_bots_update` stays the Manifest write. Chat self-settings
  sends `name`, `label`, and `description` only. An empty name is
  rejected, matching the closet. Length limits stay as they are.
- Appearance stays closet-only. Model tier stays Owner Settings and
  the existing MCP path. Neither is a Chat self-settings write.
- Delete stays off Chat.
- Skills list, upsert, and delete are MCP tools on that Bot, for the
  creator or the Owner. A grantee does not receive them. A Member
  creator does, on their own Bot.
- A Skill id is letters, digits, `_`, or `-`. `parseSkillId` in
  `packages/shared/src/skill.ts` checks that. A dotted id is rejected.
  A Skill is one `instructions` string. There is no locale column.
  Skills live in `bots.skills_json` as `{ id, instructions }`
  (`packages/db/src/skills.ts`). No new table.
- The Member prompt that forbids rename does not apply on a turn where
  that Member is the creator of that Bot, or where the viewer is the
  Owner.
- Schedule behavior is unchanged from
  [ADR 0027](0027-bot-schedules.md). The platform rule covers a
  Schedule request. The Host still does not parse it.
- The Host does not parse natural language into a Manifest or a Skill
  either. The Bot calls tools.
- The Chat pill, the sidebar, and an open closet Sheet update after
  the Host Chat turn, using the existing refresh. No full page reload.
  The previous name may remain while Activity is in flight.
- A raw `/mcp` update may leave an already-open Chat stale until the
  next refresh.
- The Platform does not gain a Weather Module, a weather Skill, or a
  weather seed.

### Out of scope

- A Weather Module, a weather Skill, a weather API, and any
  Kitchen-style seed of weather.
- Schedule schema, timezone, and ticker
  ([ADR 0027](0027-bot-schedules.md)).
- Appearance via Chat (`avatarShape`, `avatarColor`).
- Model tier via Chat self-settings.
- Delete of a Bot or of Chat via Chat.
- The Host parsing natural language into a Manifest, a Skill, or a
  Schedule.
- Pushing a raw `/mcp` write into an already-open Chat page.
- A new Skill table, or a locale column on a Skill.
- A dotted Skill id.

## Alternatives

- Trust the Chat reply without a tool result — rejected. The Store
  would not change, and the reply would be a false success.
- Put the duty in a Skill or on the Manifest — rejected. The Host
  injects one platform instruction on every turn. A Skill may add
  domain procedure only.
- A second Bot update tool for Chat — rejected. Reuse
  `dostigus_bots_update`.
- Let a grantee edit the Manifest or Skills from Chat — rejected. The
  same actors as the closet: the creator and the Owner
  ([ADR 0024](0024-threads-and-bot-visibility.md)).
- Leave every Member Chat messages-only, including a Member creator —
  rejected. The closet already allows that edit. Chat must too, or the
  creator stays stuck.
- Change appearance or Model tier from Chat — rejected for day-1.
  Appearance stays the closet. Model tier stays Owner Settings and the
  existing MCP path.
- Expose delete on this loop — rejected
  ([ADR 0011](0011-chat-mcp-tool-loop.md)).
- The Host parses the person's sentence into a write — rejected. The
  Bot calls tools.
- Require a full page reload after the write — rejected. The Chat page
  already refreshes when the turn completes.
- Live-update every open Chat on a raw `/mcp` write — rejected for
  day-1. Stale until the next refresh is acceptable.
- Store Skills in a new table, or add a locale column — rejected.
  Skills stay `{ id, instructions }` in `bots.skills_json`
  (`packages/db/src/skills.ts`).
- A dotted Skill id — rejected. The charset is letters, digits, `_`,
  or `-` (`parseSkillId` in `packages/shared/src/skill.ts`).
