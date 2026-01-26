<script setup lang="ts">
import { useBuildStore } from '~/stores/BuildStore'

// Redirect to champion step
const router = useRouter()
const buildStore = useBuildStore()

onMounted(() => {
  // Only create a new build if one doesn't exist
  // Don't reset an existing build
  if (!buildStore.currentBuild) {
    buildStore.createNewBuild()
  }

  router.replace('/builds/create/champion')
})
</script>

<template>
  <div></div>
</template>
