CREATE TABLE `schedules` (
  `id` text PRIMARY KEY NOT NULL,
  `bot_id` text NOT NULL,
  `person_id` text NOT NULL,
  `cadence` text NOT NULL,
  `time_local` text NOT NULL,
  `days_of_week_json` text,
  `wake_text` text NOT NULL,
  `paused` integer DEFAULT 0 NOT NULL,
  `next_run_at` integer NOT NULL,
  `last_run_at` integer,
  `last_run_status` text,
  `defer_count` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `schedules_paused_next_run_at_idx` ON `schedules` (`paused`,`next_run_at`);
CREATE INDEX `schedules_bot_id_person_id_idx` ON `schedules` (`bot_id`,`person_id`);

CREATE TABLE `cluster_settings` (
  `id` text PRIMARY KEY NOT NULL,
  `timezone` text,
  `updated_at` integer NOT NULL
);
