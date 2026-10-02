CREATE TABLE `catalog_listings` (
	`pack_id` text NOT NULL,
	`version` text NOT NULL,
	`author` text NOT NULL,
	`author_link` text,
	`title_json` text NOT NULL,
	`short_json` text NOT NULL,
	`long_json` text NOT NULL,
	`screenshots_json` text DEFAULT '[]' NOT NULL,
	`assets_json` text DEFAULT '[]' NOT NULL,
	`status` text NOT NULL,
	`origin_url` text,
	`mirror_filename` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`published_at` integer,
	PRIMARY KEY (`pack_id`, `version`)
);
--> statement-breakpoint
CREATE INDEX `catalog_listings_status_idx` ON `catalog_listings` (`status`);
--> statement-breakpoint
CREATE INDEX `catalog_listings_sort_idx` ON `catalog_listings` (`sort_order`, `pack_id`);
--> statement-breakpoint
CREATE TABLE `catalog_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`byte_size` integer NOT NULL,
	`created_at` integer NOT NULL
);
