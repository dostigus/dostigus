ALTER TABLE `members` ADD `locale` text;
--> statement-breakpoint
UPDATE `members` SET `locale` = 'en' WHERE `locale` IS NULL;
