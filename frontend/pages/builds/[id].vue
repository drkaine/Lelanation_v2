<template>
  <BuildDetailsPage :build-id="buildId" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import BuildDetailsPage from '~/components/Build/BuildDetailsPage.vue'

const route = useRoute()
const buildId = computed(() => route.params.id as string)
</script>
