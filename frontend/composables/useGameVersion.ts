import { computed, onMounted } from 'vue'
import { useVersionStore } from '~/stores/VersionStore'

// Fallback version should match the latest available data
const FALLBACK_VERSION = '16.2.1'

export function useGameVersion() {
  const versionStore = useVersionStore()

  onMounted(() => {
    if (!versionStore.currentVersion && versionStore.status === 'idle') {
      versionStore.loadCurrentVersion()
    }
  })

  const version = computed(() => versionStore.currentVersion || FALLBACK_VERSION)

  return { version, versionStore }
}
