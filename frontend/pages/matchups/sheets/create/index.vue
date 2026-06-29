<script setup lang="ts">
import { useBuildStore } from '~/stores/BuildStore'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'

definePageMeta({
  middleware: 'matchup-guides-admin',
})

const router = useRouter()
const localePath = useLocalePath()
const buildStore = useBuildStore()
const draftStore = useMatchupGuideDraftStore()

onMounted(() => {
  draftStore.startNewGuide()
  buildStore.createNewBuild()
  buildStore.ensureCurrentBuild()
  router.replace(localePath('/matchups/sheets/create/champion'))
})
</script>

<template>
  <div></div>
</template>
