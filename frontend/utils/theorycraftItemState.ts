import type { ComputedRef, InjectionKey } from 'vue'

/** Theorycraft item toggles of one build side, as stored per storage scope. */
export interface TheorycraftItemState {
  disabled: number[]
  stacks: Record<number, number>
  transformed: Record<number, boolean>
  activePassives: Record<number, boolean>
}

/** Item state of an inactive vs card; null means the live store state. */
export const THEORYCRAFT_ITEM_STATE_KEY: InjectionKey<ComputedRef<TheorycraftItemState | null>> =
  Symbol('theorycraftItemState')
