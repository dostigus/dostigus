CREATE TABLE `artifacts` (
  `id` text PRIMARY KEY NOT NULL,
  `filename` text NOT NULL,
  `mime` text NOT NULL,
  `byte_size` integer NOT NULL,
  `content_hash` text NOT NULL,
  `actor_person_id` text NOT NULL,
  `created_at` integer NOT NULL,
  `upload_id` text,
  `status` text DEFAULT 'complete' NOT NULL,
  `last_joined_at` integer
);
CREATE INDEX `artifacts_upload_id_hash_idx` ON `artifacts` (`upload_id`,`content_hash`);
CREATE INDEX `artifacts_status_created_at_idx` ON `artifacts` (`status`,`created_at`);
CREATE TABLE `message_artifacts` (
  `message_id` text NOT NULL,
  `artifact_id` text NOT NULL,
  `created_at` integer NOT NULL,
  PRIMARY KEY (`message_id`, `artifact_id`),
  FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`artifact_id`) REFERENCES `artifacts`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `message_artifacts_artifact_id_idx` ON `message_artifacts` (`artifact_id`);
