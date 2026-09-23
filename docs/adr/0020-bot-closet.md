# ADR 0020: Bot closet

- Status: accepted
- Date: 2026-09-23

## Decision

The right Bot Sheet opened from the Chat pill is the closet. Host copy
on that Sheet is Russian and casual. Docs stay English.

- Title is **Параметры**, centered. The close control is a **×** in the
  top-right, the same mark the Host picker uses for Back. It is not a
  chevron pair.
- A large Bot mark sits under the title. For the Owner, hover or focus
  shows a pencil on the mark and «Изменить аватар» under it. Either
  control opens a modal (`KitDialog`) with the eight flock birds and the
  hue-ordered accent swatches (last row centered). **Save**
  («Сохранить») writes `avatarShape` and `avatarColor`. **Reset**
  («Сбросить») restores `goose` and `#1F7AE5` in the draft; it does not
  write until Save. Closing the modal drops the draft. Members see the
  mark and cannot open the modal.
- Fields on the Sheet, and only these: name («Имя»), optional label
  («Метка»), and description («Описание»). They persist on the Manifest
  (`label`, `description`; empty string when unset). The Sheet does not
  show a Save button for those fields; leaving a field or closing the
  Sheet writes them. An empty name is refused while the Sheet is open.
- Model tier is not on this Sheet. It stays on Host Settings and on the
  Store / MCP surface. This Sheet’s PATCH does not send `modelTier`.
- Bot delete and Chat delete are not on this Sheet. The Owner delete
  route stays; a later layer will place the control.

The Chat pill still opens this Sheet, including from Host search. The
pill’s arrow slot is reserved on the left and the right, hidden at rest,
so the mark and name have the same inset. Hover or focus only fades the
arrow in.

## Context

ADR 0015 put appearance, rename, Model tier, and delete on the right
Sheet. ADR 0016 kept appearance inline on a Bot tab. Nick’s closet puts
appearance in its own modal and keeps Model tier and delete off this
surface.

## Consequences

- Store migration `0007_bot_label_description` adds `label` and
  `description` on `bots`. Create and update accept them. Invalid length
  is rejected. Omitting them on update keeps the stored values.
- MCP `dostigus_bots_create` / `dostigus_bots_update` accept the same
  optional fields.
- Kit Sheet shell can center a title and render the close control as ×.
  A modal overlay stacks above a drawer so the appearance modal sits on
  the closet.
- Out of this change: image upload, generated marks, a Model tier control
  in the closet, and delete in the closet.

## Alternatives

- Leave the flock grid inline on the Sheet — rejected. Appearance is its
  own modal with Save.
- Show Model tier under the description — rejected. It stays under Host
  Settings.
- Put delete on this Sheet — rejected for this change.
- A chevron in the top-right — rejected. The Host close mark is ×.
