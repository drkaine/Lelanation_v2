<script setup lang="ts">
import { useBuildStore } from '~/stores/BuildStore'

const router = useRouter()
const localePath = useLocalePath()
const buildStore = useBuildStore()

onMounted(() => {
  buildStore.ensureCurrentBuild()
  router.replace(localePath(`/builds/create/${buildStore.getLastBuilderStep()}`))
})
</script>

<template>
  <div></div>
</template>
