import type { TaskStatus } from '@dostigus/shared'
import { TASK_STATUSES } from '@dostigus/shared'

export type BoardTask = {
  id: string
  title: string
  status: string
  mode: string
}

/** Columns follow the business status order, including empty ones. */
export function boardColumns<T extends BoardTask>(tasks: readonly T[]): Array<{ status: TaskStatus, tasks: T[] }> {
  return TASK_STATUSES.map((status) => ({
    status,
    tasks: tasks.filter((task) => task.status === status),
  }))
}
