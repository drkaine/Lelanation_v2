<script setup lang="ts">
import {
  bootstrapMatchupGuideCreateSession,
  resolveMatchupGuideCreateStep,
} from '~/composables/useMatchupGuideCreateBuilder'
import {
  readMatchupGuideCreateQuery,
  matchupGuideCreateRouteQuery,
} from '~/utils/matchupGuideFromBuildSession'
import { useBuildStore } from '~/stores/BuildStore'
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

onMounted(() => {
  bootstrapMatchupGuideCreateSession(route.query)

  const { fromBuildId } = readMatchupGuideCreateQuery(route.query)
  const query = matchupGuideCreateRouteQuery(route.query)

  let step = resolveMatchupGuideCreateStep()
  if (fromBuildId) {
    const context = buildMatchupGuideStepAccessContext({
      buildValid: buildStore.isBuildValid,
      hasChampion: Boolean(buildStore.currentBuild?.champion),
      matchupEntries: [],
    })
    step = canOpenMatchupsGuideStep(context) ? 'matchups' : 'info'
  }

  router.replace(localePath({ path: `/matchups/sheets/create/${step}`, query }))
})
</script>

<template>
  <div></div>
</template>
