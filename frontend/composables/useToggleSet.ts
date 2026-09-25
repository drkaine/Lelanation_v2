import { ref, type Ref } from 'vue'

/** Set of open/expanded keys; each change replaces the Set so dependents re-render. */
export function useToggleSet<T>(initial: Iterable<T> = []) {
  const set = ref(new Set(initial)) as Ref<Set<T>>

  function toggle(key: T): void {
    const next = new Set(set.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    set.value = next
  }

  function clear(): void {
    set.value = new Set()
  }

  return { set, toggle, clear }
}
