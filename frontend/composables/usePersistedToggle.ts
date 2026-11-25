import { ref } from 'vue'

/**
 * Bascule ouvert/fermé dont le choix est retenu dans localStorage.
 * Fermé par défaut ; `restore()` relit le choix (à appeler côté client, ex. onMounted).
 */
export function usePersistedToggle(storageKey: string, defaultOpen = false) {
  const open = ref(defaultOpen)

  function restore() {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw === '1') open.value = true
      else if (raw === '0') open.value = false
    } catch {
      // stockage inaccessible : on garde la valeur par défaut
    }
  }

  function toggle() {
    open.value = !open.value
    try {
      localStorage.setItem(storageKey, open.value ? '1' : '0')
    } catch {
      // stockage inaccessible : choix non retenu
    }
  }

  return { open, toggle, restore }
}
