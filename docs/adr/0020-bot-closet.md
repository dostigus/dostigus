# ADR 0020: Bot closet

- Status: accepted
- Date: 2026-09-23
- Amended: 2026-09-24 — Параметры gains a «Расписания» block (list + entry to create/detail). Schedules are Store rows, not Manifest fields. See [ADR 0027](0027-bot-schedules.md).

## Decision

The right Bot Sheet opened from the Chat pill is the closet. Host copy
on that Sheet is Russian and casual. Docs stay English.

- Title is **Параметры**, centered. The close control is a **×** in the
  top-right, the same mark the Host picker uses for Back. It is not a
  chevron pair.
- A large Bot mark sits under the title. For the Owner, clicking that
  mark opens appearance. A small pencil badge sits on the bottom-right
  corner of the mark, stays visible, and opens the same modal
  (`KitDialog`) with the eight flock birds on
  square tiles (the selected frame is the same rounded square) and
  smaller hue-ordered accent swatches. The palette is the same width as
  the flock grid (last row centered). **Save**
  («Сохранить») writes `avatarShape` and `avatarColor`. **Reset**
  («Сбросить») restores `goose` and `#1F7AE5` in the draft; it does not
  write until Save. Closing the modal drops the draft. Members see the
  mark and cannot open the modal.
- Manifest fields on the Sheet: name («Имя»), optional label («Метка»),
  and description («Описание»). They persist on the Manifest (`label`,
  `description`; empty string when unset). The Sheet does not show a
  Save button for those fields; leaving a field or closing the Sheet
  writes them. An empty name is refused while the Sheet is open.
- Under those Manifest fields, a **Расписания** block lists this
  person's Schedules on this Bot. Host copy is «Расписания». The rows
  are Store Schedules, not Manifest fields. They write through the same
  handlers as `dostigus_schedules_*`
  ([ADR 0027](0027-bot-schedules.md)). Any person who can open the Bot
  sees the block (their own rows). Owner MCP scope for other people's
  rows stays that record. Day-1 UI does not list those other rows.
  Header **+** and empty-state **Добавить** open the create Sheet. A
  row opens the detail Sheet. Chat Card **Изменить** opens that same
  detail Sheet ([ADR 0030](0030-chat-cards-module-catalog.md)). Run
  history on detail is Turn journal rows
  ([ADR 0029](0029-turn-journal.md)). Closet PATCH for Manifest fields
  does not write Schedules.
- Model tier is not on this Sheet. It stays on Host Settings and on the
  Store / MCP surface. This Sheet’s PATCH does not send `modelTier`.
- Bot delete and Chat delete are not on this Sheet. The Owner delete
  route stays; a later layer will place the control.

The Chat pill still opens this Sheet, including from Host search. At
rest the pill is the mark and the name only, with the same inset on both
sides, a little wider than a tight crop. Hover or focus fades an arrow
in after the name and the pill grows wider so the trailing inset sits
past the arrow.

## Context

ADR 0015 put appearance, rename, Model tier, and delete on the right
Sheet. ADR 0016 kept appearance inline on a Bot tab. Nick’s closet puts
appearance in its own modal and keeps Model tier and delete off this
surface. The 2026-09-24 grill adds a «Расписания» block under the
Manifest fields. Those rows stay Store Schedules
([ADR 0027](0027-bot-schedules.md)), not closet PATCH fields.

## Consequences

- Store migration `0007_bot_label_description` adds `label` and
  `description` on `bots`. Create and update accept them. Invalid length
  is rejected. Omitting them on update keeps the stored values.
- MCP `dostigus_bots_create` / `dostigus_bots_update` accept the same
  optional fields.
- Chat self-settings of name, label, and description reuses
  `dostigus_bots_update`
  ([ADR 0028](0028-bot-self-settings-via-chat.md)). Appearance stays on
  this Sheet. Model tier stays off Chat self-settings.
- Kit Sheet shell can center a title and render the close control as ×.
  A modal overlay stacks above a drawer so the appearance modal sits on
  the closet.
- The «Расписания» block is Store rows
  ([ADR 0027](0027-bot-schedules.md)). It is not a Manifest field and
  not this Sheet’s PATCH. The code PR adds the list, create Sheet, and
  detail Sheet.
- Out of this change: image upload, generated marks, a Model tier control
  in the closet, and delete of the Bot in the closet. Schedule delete
  lives on the detail Sheet, not as Bot delete.

## Alternatives

- Leave the flock grid inline on the Sheet — rejected. Appearance is its
  own modal with Save.
- Show Model tier under the description — rejected. It stays under Host
  Settings.
- Put delete of the Bot on this Sheet — rejected for this change.
- A chevron in the top-right — rejected. The Host close mark is ×.
- Keep Schedules off the closet until a later list Sheet — rejected on
  2026-09-24. The «Расписания» block is day-1
  ([ADR 0027](0027-bot-schedules.md)).
- Treat Schedules as Manifest fields on this PATCH — rejected. They are
  Store rows. Same handlers as `dostigus_schedules_*`.
