CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`email` text,
	`username` text,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`disabled_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_email_unique` ON `members` (`email`);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_username_unique` ON `members` (`username`);
--> statement-breakpoint
ALTER TABLE `messages` ADD `person_id` text;
