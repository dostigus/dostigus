/** Board and Repo link values shared by the Host UI and the Store. */

export const TASK_MODES = ['quick', 'bug', 'feature', 'epic'] as const
export type TaskMode = typeof TASK_MODES[number]

export const TASK_STATUSES = [
  'new',
  'grilling',
  'awaiting_approval',
  'in_work',
  'awaiting_acceptance',
  'released',
  'dropped',
] as const
export type TaskStatus = typeof TASK_STATUSES[number]

export const COMMAND_KEYS = ['setup', 'lint', 'test', 'check', 'run', 'preview'] as const
export type CommandKey = typeof COMMAND_KEYS[number]
