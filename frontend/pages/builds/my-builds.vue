<template>
  <BuildsIndexTabPage tab="my-builds" />
</template>

<script setup lang="ts">
import BuildsIndexTabPage from '~/components/builds/BuildsIndexTabPage.vue'

definePageMeta({
  key: 'builds-library',
})
</script>
