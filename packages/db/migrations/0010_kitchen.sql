CREATE TABLE `kitchen_pantry` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `qty` text,
  `created_at` integer NOT NULL
);
CREATE TABLE `kitchen_cooked` (
  `id` text PRIMARY KEY NOT NULL,
  `label` text NOT NULL,
  `xp` integer NOT NULL,
  `person_id` text,
  `created_at` integer NOT NULL
);
CREATE TABLE `kitchen_recipe` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `ingredients` text NOT NULL,
  `updated_at` integer NOT NULL
);
