# Store (`@dostigus/db`)

SQLite Store. `openStore` applies `STORE_MIGRATIONS` in
[`src/migrations.ts`](src/migrations.ts).

## Store migration

Every Store migration commit updates three copies together:

1. `migrations/NNNN_name.sql`
2. The `STORE_MIGRATIONS` entry with that `id` in
   [`src/migrations.ts`](src/migrations.ts)
3. One row in [`migrations/meta/_journal.json`](migrations/meta/_journal.json)
   whose `tag` equals that `id`

Do not land the SQL file and the embedded statement without the journal
row. [`tests/unit/migrations-journal.test.ts`](tests/unit/migrations-journal.test.ts)
fails `pnpm check` when the journal `tag`s, the `migrations/*.sql`
filenames, and the embedded `id`s are not the same list, in the same order.
The SQL file is the drizzle-kit copy and can contain `statement-breakpoint`
markers, so the check does not compare file bytes to the embedded statement.

## Adding a column

Same checklist as [AGENTS.md](../../AGENTS.md#adding-a-store-column).
Example: [`migrations/0009_message_parts.sql`](migrations/0009_message_parts.sql)
([#59](https://github.com/dostigus/dostigus/pull/59)) added `messages.parts_json`.
Write the next column the same way, by hand.

1. **Schema.** [`src/schema.ts`](src/schema.ts).
2. **MessageRecord.** Snake_case field on `MessageRecord` in
   [`src/map.ts`](src/map.ts). Map it in `toMessage` when Chat reads the
   field. On another table, use that table's record type in the same file.
3. **Every SELECT.** Every statement that lists that table's columns. On
   `messages`, the `SELECT` in `listMessages` and the `INSERT` in
   `insertMessageRow` in [`src/queries.ts`](src/queries.ts).
4. **SQL file.** `migrations/NNNN_name.sql` in the migration commit.
   `NNNN` is the next index after the last journal `tag`.
5. **Embedded SQL.** The same statement on `STORE_MIGRATIONS` in
   [`src/migrations.ts`](src/migrations.ts), in that same commit. The
   `id` is the filename without `.sql` (`0009_message_parts`).
6. **Journal.** In that same commit, one object in
   [`migrations/meta/_journal.json`](migrations/meta/_journal.json):
   next `idx`, `version` `"6"`, `when` equal to the previous `when` plus
   `86400000`, `tag` equal to that `id`, `breakpoints` `true`. That file
   is the only file under `migrations/meta/`.

Keep the SQL file, the embedded statement, and the journal `tag` the same
so a fresh Store and an existing Store boot with the same columns.
