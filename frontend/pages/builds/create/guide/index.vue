<script setup lang="ts">
import { bootstrapMatchupGuideCreateSession } from '~/composables/useMatchupGuideCreateBuilder'
import { startEditingMatchupGuide } from '~/utils/matchupGuideEditSession'
import { useBuildStore } from '~/stores/BuildStore'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'
import {
  builderGuideQuery,
  builderGuideStepPath,
  readBuilderGuideQuery,
  resolveBuilderGuideSubstep,
} from '~/utils/builderGuideStep'

definePageMeta({
  layout: false,
})

const router = useRouter()
const route = useRoute()
const localePath = useLocalePath()
const buildStore = useBuildStore()
const draftStore = useMatchupGuideDraftStore()

onMounted(async () => {
  const parsed = readBuilderGuideQuery(route.query)
  const query = builderGuideQuery(parsed)

  if (parsed.guideEditId) {
    await startEditingMatchupGuide(parsed.guideEditId)
  } else {
    if (parsed.editId && buildStore.editSourceBuildId !== parsed.editId) {
      await buildStore.startEditingBuildById(parsed.editId)
    }
    bootstrapMatchupGuideCreateSession(route.query)
  }

  const step = resolveBuilderGuideSubstep(draftStore.lastStep, {
    buildValid: buildStore.isBuildValid,
    hasChampion: Boolean(buildStore.currentBuild?.champion),
    matchupEntries: draftStore.matchupEntries,
  })
  const path = step ? builderGuideStepPath(step) : '/builds/create/info'
  router.replace(localePath({ path, query }))
})
</script>

<template>
  <div></div>
</template>
