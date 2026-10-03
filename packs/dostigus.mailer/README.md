# Mailer

A Bot for one live mailbox over IMAP and SMTP
([ADR 0048](https://github.com/dostigus/dostigus/blob/main/docs/adr/0048-mailer-product.md)).
This is not `dostigus.mail` (paste-only triage); both Packs stay.

## After Apply

1. The Owner or an Admin opens the Bot's Closet, Mailbox, and enters host,
   port, user, and an app password. Test connection checks both servers.
2. Resume the Morning inbox Schedule when you want a daily check. It lands
   paused.

## What the Bot can do

- List and read INBOX (read-only; nothing is marked read).
- Draft replies. A draft is sent only after you confirm it on your next
  message. A Schedule Wake never sends.

The mailbox login lives in the Cluster Store as the Bot mail binding. It is
never in this Pack, never in an Export, and never in the Catalog Store.
