import { computed, onMounted } from 'vue'
import { useVersionStore } from '~/stores/VersionStore'
import { getFallbackGameVersion } from '~/config/version'

export function useGameVersion() {
  const versionStore = useVersionStore()

  onMounted(() => {
    if (!versionStore.currentVersion && versionStore.status === 'idle') {
      versionStore.loadCurrentVersion()
    }
  })

  const version = computed(() => versionStore.currentVersion || getFallbackGameVersion())

  return { version, versionStore }
}
