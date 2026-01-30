<script setup lang="ts">
import { useBuildStore } from '~/stores/BuildStore'

const router = useRouter()
const localePath = useLocalePath()
const buildStore = useBuildStore()

onMounted(() => {
  if (!buildStore.currentBuild) {
    buildStore.createNewBuild()
  }
  router.replace(localePath('/builds/create/champion'))
})
</script>

<template>
  <div></div>
</template>
