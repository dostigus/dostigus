CREATE TABLE `projects` (
  `id` text PRIMARY KEY NOT NULL,
  `slug` text NOT NULL,
  `name` text NOT NULL,
  `owner_id` text NOT NULL,
  `architect_bot_id` text,
  `architect_mode` text DEFAULT 'external' NOT NULL,
  `preview_url` text,
  `status` text DEFAULT 'active' NOT NULL,
  `context_project_id` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`owner_id`) REFERENCES `owners`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`architect_bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE UNIQUE INDEX `projects_slug_unique` ON `projects` (`slug`);
CREATE TABLE `project_tokens` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `token_hash` text NOT NULL,
  `label` text DEFAULT '' NOT NULL,
  `created_at` integer NOT NULL,
  `revoked_at` integer,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `project_tokens_token_hash_unique` ON `project_tokens` (`token_hash`);
CREATE INDEX `project_tokens_project_id_idx` ON `project_tokens` (`project_id`);
CREATE TABLE `repo_links` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `provider` text DEFAULT 'github' NOT NULL,
  `full_name` text NOT NULL,
  `default_branch` text DEFAULT 'main' NOT NULL,
  `docs_layout_json` text DEFAULT '{"adrs":"docs/adr","specs":"docs","glossary":"CONTEXT.md"}' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `repo_links_project_id_unique` ON `repo_links` (`project_id`);
CREATE TABLE `commands` (
  `id` text PRIMARY KEY NOT NULL,
  `repo_link_id` text NOT NULL,
  `setup` text,
  `lint` text,
  `test` text,
  `check` text,
  `run` text,
  `preview` text,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`repo_link_id`) REFERENCES `repo_links`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `commands_repo_link_id_unique` ON `commands` (`repo_link_id`);
CREATE TABLE `tasks` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `title` text NOT NULL,
  `body` text DEFAULT '' NOT NULL,
  `mode` text NOT NULL,
  `status` text DEFAULT 'new' NOT NULL,
  `created_by` text NOT NULL,
  `grill_policy` text NOT NULL,
  `grill_skip_reason` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `tasks_project_id_idx` ON `tasks` (`project_id`);
CREATE TABLE `tickets` (
  `id` text PRIMARY KEY NOT NULL,
  `task_id` text NOT NULL,
  `title` text NOT NULL,
  `brief` text DEFAULT '' NOT NULL,
  `blocked_by_json` text DEFAULT '[]' NOT NULL,
  `builder_hint` text,
  `status` text DEFAULT 'ready' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `tickets_task_id_idx` ON `tickets` (`task_id`);
CREATE TABLE `task_artifacts` (
  `task_id` text NOT NULL,
  `artifact_id` text NOT NULL,
  `created_at` integer NOT NULL,
  PRIMARY KEY (`task_id`, `artifact_id`),
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`artifact_id`) REFERENCES `artifacts`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `task_artifacts_artifact_id_idx` ON `task_artifacts` (`artifact_id`);
