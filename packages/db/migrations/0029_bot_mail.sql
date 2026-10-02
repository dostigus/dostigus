ALTER TABLE `cluster_settings` ADD `mail_allowlist` text;
CREATE TABLE `bot_mail_bindings` (
  `bot_id` text PRIMARY KEY NOT NULL,
  `imap_host` text NOT NULL,
  `imap_port` integer NOT NULL,
  `imap_user` text NOT NULL,
  `imap_password` text NOT NULL,
  `smtp_host` text NOT NULL,
  `smtp_port` integer NOT NULL,
  `smtp_user` text,
  `smtp_password` text,
  `updated_by` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE cascade
);
