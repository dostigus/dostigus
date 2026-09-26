CREATE TABLE `installed_packs` (
  `id` text PRIMARY KEY NOT NULL,
  `pack_id` text NOT NULL,
  `version` text NOT NULL,
  `snapshot_json` text NOT NULL,
  `installed_at` integer NOT NULL
);
CREATE INDEX `installed_packs_pack_id_version_idx` ON `installed_packs` (`pack_id`, `version`);
ALTER TABLE `bots` ADD `installed_pack_id` text;
