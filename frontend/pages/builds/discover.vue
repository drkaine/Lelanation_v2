<template>
  <BuildsIndexTabPage tab="discover" />
</template>

<script setup lang="ts">
import BuildsIndexTabPage from '~/components/builds/BuildsIndexTabPage.vue'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'

const discoveryStore = useBuildDiscoveryStore()
const requestFetch = useRequestFetch()

await useAsyncData('builds-index-discover', async () => {
  await discoveryStore.loadBuilds({ fetcher: requestFetch })
  return discoveryStore.builds.length
})
</script>
