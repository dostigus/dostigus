ALTER TABLE `bots` ADD `visibility` text DEFAULT 'shared' NOT NULL;
ALTER TABLE `bots` ADD `created_by` text;
UPDATE `bots`
SET `created_by` = (
  SELECT `id` FROM `owners` ORDER BY `created_at` ASC, `id` ASC LIMIT 1
)
WHERE `created_by` IS NULL
  AND EXISTS (SELECT 1 FROM `owners`);

CREATE TABLE `threads` (
  `id` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL,
  `bot_id` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `threads_bot_id_idx` ON `threads` (`bot_id`);

CREATE TABLE `thread_participants` (
  `thread_id` text NOT NULL,
  `kind` text NOT NULL,
  `ref_id` text NOT NULL,
  PRIMARY KEY (`thread_id`, `kind`, `ref_id`),
  FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `thread_participants_kind_ref_idx` ON `thread_participants` (`kind`, `ref_id`);

ALTER TABLE `messages` ADD `thread_id` text;
CREATE INDEX `messages_thread_id_created_at_idx` ON `messages` (`thread_id`, `created_at`);

DROP TABLE IF EXISTS `_bot_thread_place`;
CREATE TEMP TABLE `_bot_thread_place` (
  `message_id` text PRIMARY KEY NOT NULL,
  `bot_id` text NOT NULL,
  `person_id` text NOT NULL
);

INSERT INTO `_bot_thread_place` (`message_id`, `bot_id`, `person_id`)
WITH `ordered` AS (
  SELECT
    `id`,
    `bot_id`,
    `role`,
    `person_id`,
    SUM(CASE
      WHEN `role` = 'user'
        AND `person_id` IS NOT NULL
        AND length(trim(`person_id`)) > 0
      THEN 1
      ELSE 0
    END) OVER (
      PARTITION BY `bot_id`
      ORDER BY `created_at` ASC, `id` ASC
    ) AS `grp`
  FROM `messages`
),
`keys` AS (
  SELECT `bot_id`, `grp`, min(`person_id`) AS `key_person`
  FROM `ordered`
  WHERE `role` = 'user'
    AND `person_id` IS NOT NULL
    AND length(trim(`person_id`)) > 0
  GROUP BY `bot_id`, `grp`
),
`owner` AS (
  SELECT `id` AS `owner_id`
  FROM `owners`
  ORDER BY `created_at` ASC, `id` ASC
  LIMIT 1
)
SELECT
  `ordered`.`id`,
  `ordered`.`bot_id`,
  CASE
    WHEN `ordered`.`grp` = 0 THEN (SELECT `owner_id` FROM `owner`)
    ELSE (
      SELECT `key_person` FROM `keys`
      WHERE `keys`.`bot_id` = `ordered`.`bot_id` AND `keys`.`grp` = `ordered`.`grp`
    )
  END AS `person_id`
FROM `ordered`
WHERE `ordered`.`id` IN (SELECT `id` FROM `messages` WHERE `thread_id` IS NULL)
  AND CASE
    WHEN `ordered`.`grp` = 0 THEN (SELECT `owner_id` FROM `owner`)
    ELSE (
      SELECT `key_person` FROM `keys`
      WHERE `keys`.`bot_id` = `ordered`.`bot_id` AND `keys`.`grp` = `ordered`.`grp`
    )
  END IS NOT NULL;

INSERT INTO `threads` (`id`, `kind`, `bot_id`, `created_at`)
SELECT
  'bt:' || `pairs`.`bot_id` || ':' || `pairs`.`person_id`,
  'bot',
  `pairs`.`bot_id`,
  COALESCE((
    SELECT MIN(`messages`.`created_at`)
    FROM `messages`
    INNER JOIN `_bot_thread_place` AS `placed`
      ON `placed`.`message_id` = `messages`.`id`
    WHERE `placed`.`bot_id` = `pairs`.`bot_id`
      AND `placed`.`person_id` = `pairs`.`person_id`
  ), 0)
FROM (
  SELECT DISTINCT `bot_id`, `person_id` FROM `_bot_thread_place`
) AS `pairs`
WHERE NOT EXISTS (
  SELECT 1 FROM `threads`
  WHERE `threads`.`id` = 'bt:' || `pairs`.`bot_id` || ':' || `pairs`.`person_id`
);

INSERT OR IGNORE INTO `thread_participants` (`thread_id`, `kind`, `ref_id`)
SELECT 'bt:' || `bot_id` || ':' || `person_id`, 'person', `person_id`
FROM (
  SELECT DISTINCT `bot_id`, `person_id` FROM `_bot_thread_place`
);

INSERT OR IGNORE INTO `thread_participants` (`thread_id`, `kind`, `ref_id`)
SELECT 'bt:' || `bot_id` || ':' || `person_id`, 'bot', `bot_id`
FROM (
  SELECT DISTINCT `bot_id`, `person_id` FROM `_bot_thread_place`
);

UPDATE `messages`
SET `thread_id` = (
  SELECT 'bt:' || `placed`.`bot_id` || ':' || `placed`.`person_id`
  FROM `_bot_thread_place` AS `placed`
  WHERE `placed`.`message_id` = `messages`.`id`
)
WHERE `thread_id` IS NULL
  AND EXISTS (
    SELECT 1 FROM `_bot_thread_place` AS `placed`
    WHERE `placed`.`message_id` = `messages`.`id`
  );

DROP TABLE IF EXISTS `_bot_thread_place`;
