import { computed, onMounted } from 'vue'
import { useVersionStore } from '~/stores/VersionStore'
import { getFallbackGameVersion } from '~/config/version'

export function useGameVersion() {
  const versionStore = useVersionStore()
  const fallbackVersion = getFallbackGameVersion()

  onMounted(() => {
    if (!versionStore.currentVersion) {
      versionStore.loadCurrentVersion().catch(() => undefined)
    }
  })

  const version = computed(() => versionStore.currentVersion || fallbackVersion)

  return { version, versionStore }
}
