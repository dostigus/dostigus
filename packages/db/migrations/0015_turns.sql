CREATE TABLE `turns` (
  `id` text PRIMARY KEY NOT NULL,
  `thread_id` text NOT NULL,
  `bot_id` text NOT NULL,
  `person_id` text NOT NULL,
  `trigger` text NOT NULL,
  `outcome` text NOT NULL,
  `started_at` integer NOT NULL,
  `ended_at` integer,
  `schedule_id` text,
  `error_code` text,
  `phases_json` text DEFAULT '[]' NOT NULL,
  `tools_json` text DEFAULT '[]' NOT NULL,
  FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `turns_started_at_idx` ON `turns` (`started_at`);
CREATE INDEX `turns_bot_started_idx` ON `turns` (`bot_id`,`started_at`);
CREATE INDEX `turns_thread_started_idx` ON `turns` (`thread_id`,`started_at`);
