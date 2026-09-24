CREATE TABLE `bot_grants` (
  `bot_id` text NOT NULL,
  `person_id` text NOT NULL,
  `created_at` integer NOT NULL,
  PRIMARY KEY (`bot_id`, `person_id`),
  FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `bot_grants_person_id_idx` ON `bot_grants` (`person_id`);

-- Former `shared` Bots: one grant per Member who exists now, except the
-- creator (they already have access). The Owner always sees every Bot,
-- so the Owner is not a grant row. Former `private` Bots get no rows.
INSERT INTO `bot_grants` (`bot_id`, `person_id`, `created_at`)
SELECT `bots`.`id`, `members`.`id`, `bots`.`created_at`
FROM `bots`
INNER JOIN `members`
WHERE `bots`.`visibility` = 'shared'
  AND (`bots`.`created_by` IS NULL OR `members`.`id` != `bots`.`created_by`);

ALTER TABLE `bots` DROP COLUMN `visibility`;
