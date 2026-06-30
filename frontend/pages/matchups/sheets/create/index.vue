<script setup lang="ts">
import {
  bootstrapMatchupGuideCreateSession,
  resolveMatchupGuideCreateStep,
} from '~/composables/useMatchupGuideCreateBuilder'
import {
  readMatchupGuideCreateQuery,
  matchupGuideCreateRouteQuery,
} from '~/utils/matchupGuideFromBuildSession'
import { startEditingMatchupGuide } from '~/utils/matchupGuideEditSession'
import { useBuildStore } from '~/stores/BuildStore'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'
import {
  canOpenMatchupsGuideStep,
  buildMatchupGuideStepAccessContext,
} from '~/utils/matchupGuideCreateSteps'

definePageMeta({
  middleware: 'matchup-guides-admin',
})

const router = useRouter()
const route = useRoute()
const localePath = useLocalePath()
const buildStore = useBuildStore()
const draftStore = useMatchupGuideDraftStore()

onMounted(async () => {
  const { editId, fromBuildId } = readMatchupGuideCreateQuery(route.query)
  const query = matchupGuideCreateRouteQuery(route.query)

  if (editId) {
    await startEditingMatchupGuide(editId)
    const step = resolveMatchupGuideCreateStep()
    router.replace(localePath({ path: `/matchups/sheets/create/${step}`, query }))
    return
  }

  bootstrapMatchupGuideCreateSession(route.query)

  let step = resolveMatchupGuideCreateStep()
  if (fromBuildId) {
    const context = buildMatchupGuideStepAccessContext({
      buildValid: buildStore.isBuildValid,
      hasChampion: Boolean(buildStore.currentBuild?.champion),
      matchupEntries: draftStore.matchupEntries,
    })
    step = canOpenMatchupsGuideStep(context) ? 'matchups' : 'info'
  }

  router.replace(localePath({ path: `/matchups/sheets/create/${step}`, query }))
})
</script>

<template>
  <div></div>
</template>
