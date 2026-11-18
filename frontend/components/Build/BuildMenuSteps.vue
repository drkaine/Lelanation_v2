<template>
  <nav class="menu-build subnav" aria-label="Build steps">
    <NuxtLink :to="localePath(stepHref('champion'))" :class="linkClass('champion')">
      {{ t('menu-build.champion') }}
    </NuxtLink>
    <NuxtLink :to="localePath(stepHref('rune'))" :class="linkClass('rune')">
      {{ t('menu-build.rune') }}
    </NuxtLink>
    <NuxtLink :to="localePath(stepHref('item'))" :class="linkClass('item')">
      {{ t('menu-build.item') }}
    </NuxtLink>
    <NuxtLink
      :to="hasChampion ? localePath(stepHref('info')) : '#'"
      :class="[linkClass('info'), !hasChampion ? 'is-disabled' : '']"
    >
      {{ t('menu-build.info') }}
    </NuxtLink>
    <NuxtLink
      :to="hasChampion ? localePath(stepHref('notes')) : '#'"
      :class="[linkClass('notes'), !hasChampion ? 'is-disabled' : '']"
    >
      {{ t('menu-build.notes') }}
    </NuxtLink>
    <NuxtLink
      :to="canOpenGuide ? localePath(stepHref('guide')) : '#'"
      :class="[linkClass('guide'), !canOpenGuide ? 'is-disabled' : '']"
      :title="!canOpenGuide ? t('menu-build.guideNeedsValidBuild') : undefined"
    >
      {{ t('menu-build.guide') }}
    </NuxtLink>
    <NuxtLink
      :to="hasChampion ? localePath(stepHref('theorycraft')) : '#'"
      :class="[linkClass('theorycraft'), !hasChampion ? 'is-disabled' : '']"
    >
      {{ t('menu-build.theorycraft') }}
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { useBuildStore } from '~/stores/BuildStore'
import { isBuilderGuideRoute } from '~/utils/builderGuideStep'

const props = defineProps<{
  currentStep: string
  hasChampion: boolean
}>()

const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const buildStore = useBuildStore()

/** L'étape Guide s'ouvre dès que le build est valide (champion, runes, items, compétences). */
const canOpenGuide = computed(() => props.hasChampion && buildStore.isBuildValid)

/** Garde ?editId= sur toutes les étapes tant qu'on édite un build existant */
function stepHref(
  step: 'champion' | 'rune' | 'item' | 'info' | 'notes' | 'guide' | 'theorycraft'
): string {
  const id = buildStore.editSourceBuildId
  const base = `/builds/create/${step}`
  return id ? `${base}?editId=${encodeURIComponent(id)}` : base
}

const stepMap = {
  champion: 'champion',
  rune: 'rune',
  item: 'item',
  info: 'info',
  notes: 'notes',
  guide: 'guide',
  theorycraft: 'theorycraft',
} as const

// Determine active step from route
const currentRouteStep = computed(() => {
  const path = route.path
  if (isBuilderGuideRoute(path)) return 'guide'
  if (path.includes('/champion')) return 'champion'
  if (path.includes('/rune')) return 'rune'
  if (path.includes('/item')) return 'item'
  if (path.includes('/info')) return 'info'
  if (path.includes('/notes')) return 'notes'
  if (path.includes('/theorycraft')) return 'theorycraft'
  return props.currentStep || 'champion'
})

const isActive = (key: keyof typeof stepMap) => currentRouteStep.value === stepMap[key]

const linkClass = (key: keyof typeof stepMap) => ['subnav-link', isActive(key) ? 'is-active' : '']
</script>

<style scoped>
.menu-build {
  justify-content: center;
  margin: 0 auto;
  user-select: none;
}
</style>
