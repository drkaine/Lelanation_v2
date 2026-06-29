<template>
  <div class="menu-build" role="navigation" :aria-label="t('matchupGuideCreate.stepsAria')">
    <NuxtLink
      :to="localePath(stepHref('champion'))"
      :class="linkClass('champion')"
      @click="onStepClick('champion')"
    >
      {{ t('menu-build.champion') }}
    </NuxtLink>
    <span class="arrow" aria-hidden="true"></span>
    <NuxtLink
      :to="localePath(stepHref('rune'))"
      :class="linkClass('rune')"
      @click="onStepClick('rune')"
    >
      {{ t('menu-build.rune') }}
    </NuxtLink>
    <span class="arrow" aria-hidden="true"></span>
    <NuxtLink
      :to="localePath(stepHref('item'))"
      :class="linkClass('item')"
      @click="onStepClick('item')"
    >
      {{ t('menu-build.item') }}
    </NuxtLink>
    <span class="arrow" aria-hidden="true"></span>
    <NuxtLink
      :to="stepTo('info')"
      :class="[linkClass('info'), !canOpenInfo ? 'disabled' : '']"
      @click="onStepClick('info', $event)"
    >
      {{ t('menu-build.info') }}
    </NuxtLink>
    <span class="arrow" aria-hidden="true"></span>
    <NuxtLink
      :to="stepTo('matchups')"
      :class="[linkClass('matchups'), !canOpenMatchups ? 'disabled' : '']"
      @click="onStepClick('matchups', $event)"
    >
      {{ t('matchupGuideCreate.stepMatchups') }}
    </NuxtLink>
    <span class="arrow" aria-hidden="true"></span>
    <NuxtLink
      :to="stepTo('write')"
      :class="[linkClass('write'), !canOpenWrite ? 'disabled' : '']"
      @click="onStepClick('write', $event)"
    >
      {{ t('matchupGuideCreate.stepWrite') }}
    </NuxtLink>
    <span class="arrow" aria-hidden="true"></span>
    <NuxtLink
      :to="stepTo('finalize')"
      :class="[linkClass('finalize'), !canOpenFinalize ? 'disabled' : '']"
      @click="onStepClick('finalize', $event)"
    >
      {{ t('matchupGuideCreate.stepFinalize') }}
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useBuildStore } from '~/stores/BuildStore'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'
import {
  canNavigateToMatchupGuideStep,
  buildMatchupGuideStepAccessContext,
} from '~/utils/matchupGuideCreateSteps'
import { matchupGuideCreateRouteQuery } from '~/utils/matchupGuideFromBuildSession'

const props = defineProps<{
  currentStep: string
  hasChampion: boolean
}>()

const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const buildStore = useBuildStore()
const draftStore = useMatchupGuideDraftStore()

onMounted(() => {
  draftStore.hydrateFromStorage()
})

const { matchupEntries } = storeToRefs(draftStore)

const navigationContext = computed(() =>
  buildMatchupGuideStepAccessContext({
    buildValid: buildStore.isBuildValid,
    hasChampion: props.hasChampion,
    matchupEntries: matchupEntries.value,
  })
)

type StepKey = 'champion' | 'rune' | 'item' | 'info' | 'matchups' | 'write' | 'finalize'

const canOpenInfo = computed(() => props.hasChampion)

const canOpenMatchups = computed(() =>
  canNavigateToMatchupGuideStep('matchups', navigationContext.value)
)

const canOpenWrite = computed(() => canNavigateToMatchupGuideStep('write', navigationContext.value))

const canOpenFinalize = computed(() =>
  canNavigateToMatchupGuideStep('finalize', navigationContext.value)
)

function isStepAccessible(step: StepKey): boolean {
  if (step === 'champion' || step === 'rune' || step === 'item') return true
  if (step === 'info') return canOpenInfo.value
  if (step === 'matchups') return canOpenMatchups.value
  if (step === 'write') return canOpenWrite.value
  return canOpenFinalize.value
}

function stepTo(step: StepKey): string {
  if (!isStepAccessible(step)) return '#'
  return localePath(stepHref(step))
}

function onStepClick(step: StepKey, event?: MouseEvent) {
  if (!isStepAccessible(step)) {
    event?.preventDefault()
    return
  }
  draftStore.setLastStep(step)
}

function stepHref(step: StepKey): string {
  const base = `/matchups/sheets/create/${step}`
  const query = matchupGuideCreateRouteQuery(route.query)
  const params = new URLSearchParams(query)
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

const stepMap = {
  champion: 'champion',
  rune: 'rune',
  item: 'item',
  info: 'info',
  matchups: 'matchups',
  write: 'write',
  finalize: 'finalize',
} as const

const currentRouteStep = computed(() => {
  const path = route.path
  if (path.includes('/create/finalize')) return 'finalize'
  if (path.includes('/create/write')) return 'write'
  if (path.includes('/create/matchups')) return 'matchups'
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
  cursor: pointer;
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
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: none;
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

@media (hover: hover) {
  .menu-build a:not(.disabled):hover {
    color: rgb(var(--rgb-text-accent));
  }
}
</style>
