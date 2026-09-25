ALTER TABLE `turns` ADD `served_model_id` text;
ALTER TABLE `turns` ADD `prompt_tokens` integer;
ALTER TABLE `turns` ADD `completion_tokens` integer;
ALTER TABLE `turns` ADD `total_tokens` integer;
ALTER TABLE `turns` ADD `llm_call_count` integer;
