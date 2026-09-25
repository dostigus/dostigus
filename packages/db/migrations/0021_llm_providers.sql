ALTER TABLE `llm_gateway` ADD `providers_json` text DEFAULT '[]' NOT NULL;
ALTER TABLE `llm_gateway` ADD `tier_binds_json` text DEFAULT '{}' NOT NULL;
