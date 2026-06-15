<template>
  <BuildDetailsPage :build-id="buildId" :initial-build="initialBuild ?? null" />
</template>

<script setup lang="ts">
import BuildDetailsPage from '~/components/Build/BuildDetailsPage.vue'
import { useBuildDetailPage } from '~/composables/useBuildDetailPage'

const { buildId, initialBuild } = useBuildDetailPage()
</script>
