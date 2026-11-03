<template>
  <nav class="guide-substeps" :aria-label="t('matchupGuideCreate.stepsAria')">
    <NuxtLink
      v-for="step in BUILDER_GUIDE_SUBSTEPS"
      :key="step"
      :to="isOpen(step) ? localePath({ path: builderGuideStepPath(step), query }) : '#'"
      :class="{ active: step === currentStep, disabled: !isOpen(step) }"
      @click="onClick(step, $event)"
    >
      {{ t(LABELS[step]) }}
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { useBuildStore } from '~/stores/BuildStore'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'
import {
  BUILDER_GUIDE_SUBSTEPS,
  builderGuideQuery,
  builderGuideStepPath,
  readBuilderGuideQuery,
  type BuilderGuideSubstep,
} from '~/utils/builderGuideStep'
import {
  buildMatchupGuideStepAccessContext,
  canNavigateToMatchupGuideStep,
} from '~/utils/matchupGuideCreateSteps'

defineProps<{ currentStep: BuilderGuideSubstep }>()

const LABELS: Record<BuilderGuideSubstep, string> = {
  matchups: 'matchupGuideCreate.stepMatchups',
  write: 'matchupGuideCreate.stepWrite',
  finalize: 'matchupGuideCreate.stepFinalize',
}

const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const buildStore = useBuildStore()
const draftStore = useMatchupGuideDraftStore()

const query = computed(() => builderGuideQuery(readBuilderGuideQuery(route.query)))

const context = computed(() =>
  buildMatchupGuideStepAccessContext({
    buildValid: buildStore.isBuildValid,
    hasChampion: Boolean(buildStore.currentBuild?.champion),
    matchupEntries: draftStore.matchupEntries,
  })
)

function isOpen(step: BuilderGuideSubstep): boolean {
  return canNavigateToMatchupGuideStep(step, context.value)
}

function onClick(step: BuilderGuideSubstep, event: MouseEvent) {
  if (!isOpen(step)) {
    event.preventDefault()
    return
  }
  draftStore.setLastStep(step)
}
</script>

<style scoped>
.guide-substeps {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem 1rem;
  margin: 0.35rem auto 0;
  font-family: var(--font-beaufort, ui-sans-serif, system-ui, sans-serif);
  font-size: var(--text-sm, 0.875rem);
  user-select: none;
}

.guide-substeps a {
  color: var(--color-blue-50);
  font-weight: 700;
  text-decoration: none;
  padding-bottom: 2px;
  border-bottom: 2px solid transparent;
}

.guide-substeps a.active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

.guide-substeps a.disabled {
  opacity: 0.45;
  pointer-events: none;
}

@media (hover: hover) {
  .guide-substeps a:not(.active):hover {
    text-decoration: underline;
  }
}
</style>
