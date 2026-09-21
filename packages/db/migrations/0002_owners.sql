CREATE TABLE `owners` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`username` text,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`singleton` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `owners_email_unique` ON `owners` (`email`);
--> statement-breakpoint
CREATE UNIQUE INDEX `owners_username_unique` ON `owners` (`username`);
--> statement-breakpoint
CREATE UNIQUE INDEX `owners_singleton_unique` ON `owners` (`singleton`);
