<template>
  <div class="menu-build" role="navigation" :aria-label="t('matchupGuideCreate.stepsAria')">
    <NuxtLink :to="localePath(stepHref('champion'))" :class="linkClass('champion')">
      {{ t('menu-build.champion') }}
    </NuxtLink>
    <span class="arrow" aria-hidden="true"></span>
    <NuxtLink :to="localePath(stepHref('rune'))" :class="linkClass('rune')">
      {{ t('menu-build.rune') }}
    </NuxtLink>
    <span class="arrow" aria-hidden="true"></span>
    <NuxtLink :to="localePath(stepHref('item'))" :class="linkClass('item')">
      {{ t('menu-build.item') }}
    </NuxtLink>
    <span class="arrow" aria-hidden="true"></span>
    <NuxtLink
      :to="hasChampion ? localePath(stepHref('info')) : '#'"
      :class="[linkClass('info'), !hasChampion ? 'disabled' : '']"
    >
      {{ t('menu-build.info') }}
    </NuxtLink>
    <span class="arrow" aria-hidden="true"></span>
    <NuxtLink
      :to="canOpenMatchups ? localePath(stepHref('matchups')) : '#'"
      :class="[linkClass('matchups'), !canOpenMatchups ? 'disabled' : '']"
    >
      {{ t('matchupGuideCreate.stepMatchups') }}
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'

const props = defineProps<{
  currentStep: string
  hasChampion: boolean
  canOpenMatchups?: boolean
}>()

const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const buildStore = useBuildStore()

const canOpenMatchups = computed(() => props.canOpenMatchups ?? buildStore.isBuildValid)

function stepHref(step: 'champion' | 'rune' | 'item' | 'info' | 'matchups'): string {
  return `/matchups/sheets/create/${step}`
}

const stepMap = {
  champion: 'champion',
  rune: 'rune',
  item: 'item',
  info: 'info',
  matchups: 'matchups',
} as const

const currentRouteStep = computed(() => {
  const path = route.path
  if (path.includes('/matchups')) return 'matchups'
  if (path.includes('/champion')) return 'champion'
  if (path.includes('/rune')) return 'rune'
  if (path.includes('/item')) return 'item'
  if (path.includes('/info')) return 'info'
  return props.currentStep || 'champion'
})

const isActive = (key: keyof typeof stepMap) => currentRouteStep.value === stepMap[key]

const linkClass = (key: keyof typeof stepMap) => (isActive(key) ? 'active' : '')
</script>

<style scoped>
.menu-build {
  font-family: var(--font-beaufort, ui-sans-serif, system-ui, sans-serif);
  align-items: center;
  user-select: none;
  font-size: var(--text-base, 1rem);
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem 0.5rem 0;
  justify-content: center;
}

.menu-build a {
  color: rgb(var(--rgb-text) / 0.75);
  text-decoration: none;
  padding: 0.25rem 0.5rem;
  border-radius: 0.35rem;
  transition: color 0.2s ease;
}

.menu-build a.active {
  color: rgb(var(--rgb-text-accent));
  font-weight: 700;
}

.menu-build a.disabled {
  pointer-events: none;
  opacity: 0.45;
}

.arrow {
  display: inline-block;
  width: 0.45rem;
  height: 0.45rem;
  border-right: 2px solid rgb(var(--rgb-text) / 0.45);
  border-bottom: 2px solid rgb(var(--rgb-text) / 0.45);
  transform: rotate(-45deg);
  margin: 0 0.1rem;
}
</style>
