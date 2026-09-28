import type { ComputedRef, InjectionKey } from 'vue'
import { computed, inject, useId } from 'vue'

/** What `KitField` hands its control: one id, and the ids of its hint and error. */
export type KitFieldContext = {
  controlId: ComputedRef<string>
  describedBy: ComputedRef<string | undefined>
  invalid: ComputedRef<boolean>
  required: ComputedRef<boolean>
}

export type KitSelectOption = {
  value: string
  label: string
  disabled?: boolean
}

export const kitFieldKey: InjectionKey<KitFieldContext> = Symbol('kit-field')

/**
 * Wires a Kit control to the surrounding `KitField`, if any. An explicit
 * `id` or `invalid` on the control wins over the field.
 */
export function useKitFieldControl(props: { id?: string, invalid?: boolean }) {
  const field = inject(kitFieldKey, null)
  const ownId = useId()
  return {
    id: computed(() => props.id ?? field?.controlId.value ?? ownId),
    describedBy: computed(() => field?.describedBy.value),
    invalid: computed(() => Boolean(props.invalid || field?.invalid.value)),
    required: computed(() => field?.required.value ?? false),
  }
}
