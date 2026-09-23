ALTER TABLE `threads` ADD `title` text DEFAULT '' NOT NULL;

CREATE TABLE `messages_new` (
  `id` text PRIMARY KEY NOT NULL,
  `bot_id` text,
  `role` text NOT NULL,
  `content` text NOT NULL,
  `created_at` integer NOT NULL,
  `person_id` text,
  `parts_json` text DEFAULT '[]' NOT NULL,
  `thread_id` text,
  FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE cascade
);
INSERT INTO `messages_new` (
  `id`, `bot_id`, `role`, `content`, `created_at`, `person_id`, `parts_json`, `thread_id`
)
SELECT
  `id`, `bot_id`, `role`, `content`, `created_at`, `person_id`, `parts_json`, `thread_id`
FROM `messages`;
DROP TABLE `messages`;
ALTER TABLE `messages_new` RENAME TO `messages`;
CREATE INDEX `messages_bot_id_created_at_idx` ON `messages` (`bot_id`, `created_at`);
CREATE INDEX `messages_thread_id_created_at_idx` ON `messages` (`thread_id`, `created_at`);
