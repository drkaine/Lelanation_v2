import { computed, onMounted } from 'vue'
import { useVersionStore } from '~/stores/VersionStore'

const FALLBACK_VERSION = '14.1.1'

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
