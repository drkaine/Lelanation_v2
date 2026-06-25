<template>
  <slot v-if="showIf" />
</template>

<script setup lang="ts">
defineProps<{
  showIf: boolean
}>()
</script>
