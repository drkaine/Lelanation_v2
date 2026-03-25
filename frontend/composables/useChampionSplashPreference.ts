import { computed, onMounted, watch } from 'vue'

const CHAMPION_SPLASH_ENABLED_KEY = 'lelanation_champion_splash_enabled'

export function useChampionSplashPreference() {
  const championSplashEnabled = useState<boolean>('champion-splash-enabled', () => false)
  const initialized = useState<boolean>('champion-splash-enabled-initialized', () => false)

  if (import.meta.client) {
    onMounted(() => {
      if (initialized.value) return
      initialized.value = true
      try {
        const saved = localStorage.getItem(CHAMPION_SPLASH_ENABLED_KEY)
        championSplashEnabled.value = saved === '1'
      } catch {
        // ignore localStorage errors
      }
    })
  }

  if (import.meta.client) {
    watch(
      championSplashEnabled,
      value => {
        try {
          localStorage.setItem(CHAMPION_SPLASH_ENABLED_KEY, value ? '1' : '0')
        } catch {
          // ignore localStorage errors
        }
      },
      { flush: 'post' }
    )
  }

  const championSplashDisabled = computed(() => !championSplashEnabled.value)

  const setChampionSplashEnabled = (value: boolean) => {
    championSplashEnabled.value = value
  }

  const toggleChampionSplashEnabled = () => {
    championSplashEnabled.value = !championSplashEnabled.value
  }

  return {
    championSplashEnabled,
    championSplashDisabled,
    setChampionSplashEnabled,
    toggleChampionSplashEnabled,
  }
}
