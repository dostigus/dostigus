import type { Skill } from '@dostigus/shared'
import type { OpenedStore } from './store'
import { parseSkillDescription, parseSkillId, parseSkillInstructions } from '@dostigus/shared'
import { skillsFromJson } from './map'
import { StoreError } from './store-error'

/**
 * Meta Skills are constructor how-to on a Bot. Plain
 * `{ id, description, instructions }` in `bots.skills_json`. Insert when the
 * id is absent. Do not call `upsertBotSkill`: that replaces text.
 * See ADR 0030 and ADR 0032.
 */

export const META_SKILL_IDS = [
  'platform-meta-schedules',
  'platform-meta-skills',
  'platform-meta-self-settings',
  'platform-meta-marketplace',
  'platform-meta-http-get',
] as const

export type MetaSkillId = (typeof META_SKILL_IDS)[number]

const META_SKILL_ID_SET = new Set<string>(META_SKILL_IDS)

export const META_SKILL_DESCRIPTIONS: Record<MetaSkillId, string> = {
  'platform-meta-schedules': 'Create, list, pause, update, resume, and delete Schedules (daily or weekly wall-clock Wake).',
  'platform-meta-skills': 'List, read, upsert, and delete Skill text on this Bot.',
  'platform-meta-self-settings': 'Change this Bot name, label, and description through dostigus_bots_update.',
  'platform-meta-marketplace': 'There is no Module catalog yet. Do not invent weather tools or packages.',
  'platform-meta-http-get': 'GET a public URL with dostigus_http_get. truncated means the body is incomplete.',
}

const META_SKILL_INSTRUCTIONS: Record<MetaSkillId, string> = {
  'platform-meta-schedules': `
# Schedule

Просьба создать, показать, поставить на паузу или изменить Schedule — это вызов инструмента. Не говори, что строка изменилась, пока инструмент не вернул успех.

- Создать: \`dostigus_schedules_create\`. \`botId\` — этот Bot. \`cadence\` — \`daily\` или \`weekly\`. \`timeLocal\` — \`HH:MM\` (24 часа, часовой пояс Cluster). Для \`weekly\` передай \`daysOfWeek\`: \`sun\`, \`mon\`, \`tue\`, \`wed\`, \`thu\`, \`fri\`, \`sat\`. Для \`daily\` \`daysOfWeek\` не передавай. \`wakeText\` — текст Wake. Не передавай \`nextRunAt\`: следующее срабатывание считает Host.
- Список: \`dostigus_schedules_list\` с \`botId\`.
- Пауза: \`dostigus_schedules_pause\` с \`id\`. Строка остаётся и не срабатывает.
- Изменить: \`dostigus_schedules_update\` с \`id\` и нужными полями \`cadence\`, \`timeLocal\`, \`daysOfWeek\`, \`wakeText\`. Host заново считает следующее срабатывание.
- Снова включить: \`dostigus_schedules_resume\` с \`id\`.
- Удалить: \`dostigus_schedules_delete\` с \`id\`.

Owner может передать \`personId\` в create и list. Фраза вроде «каждое утро в 08:00» — это create.

Если Wake должен прочитать публичный URL (прогноз, страница), \`wakeText\` велит вызвать \`dostigus_http_get\` и не выдумывать числа.
`.trim(),
  'platform-meta-skills': `
# Skill

Skill на этом Bot — объект \`{ id, description, instructions }\`. Это не Module package и не инструмент.

- Каталог: \`dostigus_skills_list\` с \`botId\` — \`{ id, description }[]\`.
- Полный текст: \`dostigus_skills_read\` с \`botId\` и \`id\`.
- Записать или заменить: \`dostigus_skills_upsert\`. \`id\` — буквы, цифры, \`_\` или \`-\`. Нужны \`description\` (1–200) и \`instructions\`. Тот же \`id\` заменяет текст и не создаёт новый id.
- Удалить: \`dostigus_skills_delete\` с \`botId\` и \`id\`.

Писать может создатель этого Bot или Owner. Не говори, что Skill изменён, пока инструмент не вернул успех.
`.trim(),
  'platform-meta-self-settings': `
# Свои настройки

Имя, label и description этого Bot меняются через \`dostigus_bots_update\`. Другого инструмента для этого нет.

- \`id\` — этот Bot.
- \`name\` — непустое имя.
- \`label\` и \`description\` — необязательны.

Успех только если \`dostigus_bots_update\` вернул успех. Ответ без вызова не меняет Manifest. Удаление Bot и Chat из Chat недоступно.
`.trim(),
  'platform-meta-marketplace': `
# Module package позже

Доменные Module package появятся через Marketplace. Сейчас их нет.

Не выдумывай инструменты погоды, Skill про погоду и Module package. Каталога и Apply нет. Не сей Weather Skill и не Apply пакет погоды. Публичный HTTP читается через \`dostigus_http_get\` (например Open-Meteo). Пробел закрывают уже существующие Skill (\`dostigus_skills_upsert\`), Schedule и свои настройки (\`dostigus_bots_update\`). Пакет пишет Builder, не этот Bot.
`.trim(),
  'platform-meta-http-get': `
# Host HTTP get

Публичный URL читается через \`dostigus_http_get\`. Это GET, не POST и не инструмент погоды.

- Передай \`url\` — полную ссылку, включая query. Собери её сам: схема, хост, путь, параметры.
- Пример прогноза: \`https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m,apparent_temperature&timezone=auto\`. Подставь \`latitude\`, \`longitude\` и \`timezone\`. Не выдумывай weather tool и не пиши Skill про погоду.
- Ответ: \`status\`, \`body\`, \`truncated\`. Если \`truncated\` true — тело неполное, не утверждай полный разбор JSON.
- Ошибка инструмента — не fetch. Сообщи ошибку.

Allowlist задаёт Owner в Settings. Пустой список — любые публичные хосты. Loopback и частные адреса Host всегда блокирует.
`.trim(),
}

for (const id of META_SKILL_IDS) {
  parseSkillId(id)
  parseSkillDescription(META_SKILL_DESCRIPTIONS[id])
  parseSkillInstructions(META_SKILL_INSTRUCTIONS[id])
}

function seededMetaSkill(id: MetaSkillId): Skill {
  return {
    id,
    description: META_SKILL_DESCRIPTIONS[id],
    instructions: META_SKILL_INSTRUCTIONS[id],
  }
}

function readSkills(store: OpenedStore, botId: string): Skill[] {
  const row = store.sqlite.prepare(
    'SELECT skills_json FROM bots WHERE id = ?',
  ).get(botId) as { skills_json: string } | undefined
  if (!row) {
    throw new StoreError('Bot not found', 404)
  }
  return skillsFromJson(row.skills_json)
}

function writeSkills(store: OpenedStore, botId: string, skills: Skill[]): void {
  store.sqlite.prepare(
    'UPDATE bots SET skills_json = ? WHERE id = ?',
  ).run(JSON.stringify(skills), botId)
}

function missingMetaSkills(skills: Skill[]): Skill[] {
  const present = new Set(skills.map((skill) => skill.id))
  const missing: Skill[] = []
  for (const id of META_SKILL_IDS) {
    if (!present.has(id)) {
      missing.push(seededMetaSkill(id))
    }
  }
  return missing
}

/**
 * Bot create. Append each meta Skill whose id is absent.
 * An id that is already stored keeps its instructions.
 */
export function insertMissingMetaSkills(store: OpenedStore, botId: string): Skill[] {
  const skills = readSkills(store, botId)
  const missing = missingMetaSkills(skills)
  if (missing.length === 0) {
    return skills
  }
  const next = [...skills, ...missing]
  writeSkills(store, botId, next)
  return next
}

/**
 * Image upgrade for one Bot. Inserts the full set only when none of the
 * meta Skill ids are stored. Any one of them means no write: a partial
 * delete stays deleted, and an edit stays.
 */
export function upgradeBotMetaSkills(store: OpenedStore, botId: string): Skill[] {
  const skills = readSkills(store, botId)
  if (skills.some((skill) => META_SKILL_ID_SET.has(skill.id))) {
    return skills
  }
  return insertMissingMetaSkills(store, botId)
}

/**
 * Live Bot repair on Host open. Inserts platform-meta-http-get when that
 * id is absent (same insert-if-missing as Bot create). Does not restore
 * other deleted meta Skills.
 */
export function insertMissingHttpGetMetaSkill(store: OpenedStore, botId: string): Skill[] {
  const skills = readSkills(store, botId)
  if (skills.some((skill) => skill.id === 'platform-meta-http-get')) {
    return skills
  }
  const next = [...skills, seededMetaSkill('platform-meta-http-get')]
  writeSkills(store, botId, next)
  return next
}

/**
 * Fill empty `description` on stored platform-meta-* Skills. Does not
 * replace instructions or a description that is already set.
 */
export function backfillMetaSkillDescriptions(store: OpenedStore, botId: string): Skill[] {
  const skills = readSkills(store, botId)
  let changed = false
  const next = skills.map((skill) => {
    if (!META_SKILL_ID_SET.has(skill.id) || skill.description.trim()) {
      return skill
    }
    changed = true
    return {
      ...skill,
      description: META_SKILL_DESCRIPTIONS[skill.id as MetaSkillId],
    }
  })
  if (!changed) {
    return skills
  }
  writeSkills(store, botId, next)
  return next
}

/** Image upgrade for every Bot. Host open calls this. It does not overwrite. */
export function upgradeClusterMetaSkills(store: OpenedStore): void {
  const rows = store.sqlite.prepare('SELECT id FROM bots').all() as Array<{ id: string }>
  for (const row of rows) {
    upgradeBotMetaSkills(store, row.id)
    insertMissingHttpGetMetaSkill(store, row.id)
    backfillMetaSkillDescriptions(store, row.id)
  }
}
