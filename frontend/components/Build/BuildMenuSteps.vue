<template>
  <div class="menu-build" role="navigation" aria-label="Build steps">
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
      :to="hasChampion ? localePath(stepHref('theorycraft')) : '#'"
      :class="[linkClass('theorycraft'), !hasChampion ? 'disabled' : '']"
    >
      {{ t('menu-build.theorycraft') }}
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { useBuildStore } from '~/stores/BuildStore'

const props = defineProps<{
  currentStep: string
  hasChampion: boolean
}>()

const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const buildStore = useBuildStore()

/** Garde ?editId= sur toutes les étapes tant qu'on édite un build existant */
function stepHref(step: 'champion' | 'rune' | 'item' | 'info' | 'theorycraft'): string {
  const id = buildStore.editSourceBuildId
  const base = `/builds/create/${step}`
  return id ? `${base}?editId=${encodeURIComponent(id)}` : base
}

const stepMap = {
  champion: 'champion',
  rune: 'rune',
  item: 'item',
  info: 'info',
  theorycraft: 'theorycraft',
} as const

// Determine active step from route
const currentRouteStep = computed(() => {
  const path = route.path
  if (path.includes('/champion')) return 'champion'
  if (path.includes('/rune')) return 'rune'
  if (path.includes('/item')) return 'item'
  if (path.includes('/info')) return 'info'
  if (path.includes('/theorycraft')) return 'theorycraft'
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
  cursor: pointer;
  color: var(--color-blue-50);
  font-weight: 700;
  text-decoration: none;
}

.menu-build a.active {
  color: var(--color-accent);
}

.menu-build a.disabled {
  opacity: 0.45;
  pointer-events: none;
}

.menu-build .arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
}

.menu-build .arrow::before {
  content: '›';
  color: color-mix(in srgb, var(--color-accent), transparent 35%);
  font-weight: 900;
}

@media (hover: hover) {
  .menu-build a:hover {
    text-decoration: underline;
  }
}

@media (max-width: 768px) {
  .menu-build {
    width: var(--width-all, 100%);
    gap: 0.25rem;
    padding: 0.5rem 0.5rem 0;
  }
}

@media (max-width: 500px) {
  .menu-build .arrow {
    margin: 0 0.4em;
  }
}
</style>
