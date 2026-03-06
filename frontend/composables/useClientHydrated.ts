import { onMounted } from 'vue'

/**
 * SSR-safe flag: stays false during SSR + initial client hydration,
 * flips true only after the app is mounted on the client.
 *
 * Use it to avoid reading localStorage / window-dependent values
 * that would change the initial VDOM and trigger hydration mismatches.
 */
export function useClientHydrated() {
  const hydrated = useState<boolean>('client-hydrated', () => false)

  if (import.meta.client) {
    onMounted(() => {
      hydrated.value = true
    })
  }

  return { hydrated }
}
