<script setup lang="ts">
defineProps<{
  empty: boolean
}>()
</script>

<template>
  <div v-if="empty" class="py-12 text-center">
    <slot name="empty" />
  </div>
  <div v-else class="build-grid-list">
    <slot />
  </div>
</template>

<style scoped>
.build-grid-list {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-evenly;
  gap: 10px;
  padding-inline: 5px;
  box-sizing: border-box;
}
</style>
