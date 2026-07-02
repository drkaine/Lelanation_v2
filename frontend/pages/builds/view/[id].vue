<template>
  <BuildDetailsPage :build-id="buildId" :initial-build="initialBuild ?? null" />
</template>

<script setup lang="ts">
import BuildDetailsPage from '~/components/Build/BuildDetailsPage.vue'
import { useBuildDetailPage } from '~/composables/useBuildDetailPage'
import { isPublicBuildRouteId } from '~/utils/buildRouteId'

definePageMeta({
  validate: route => isPublicBuildRouteId(String(route.params.id ?? '')),
})

const { buildId, initialBuild } = useBuildDetailPage()
</script>
