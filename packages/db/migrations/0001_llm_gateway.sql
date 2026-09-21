CREATE TABLE `llm_gateway` (
	`id` text PRIMARY KEY NOT NULL,
	`base_url` text,
	`api_key` text,
	`default_tier` text DEFAULT 'strong' NOT NULL,
	`models_json` text DEFAULT '{}' NOT NULL,
	`updated_at` integer NOT NULL
);
