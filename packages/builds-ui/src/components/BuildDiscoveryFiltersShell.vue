<script setup lang="ts">
defineProps<{
  hasActiveFilters: boolean
}>()

defineEmits<{
  clear: []
}>()
</script>

<template>
  <div class="build-filters flex flex-1 flex-wrap items-center gap-2">
    <slot />
    <button v-if="hasActiveFilters" class="filter-clear" @click="$emit('clear')">
      <slot name="clear-label">Clear</slot>
    </button>
  </div>
</template>

<style scoped>
.filter-clear {
  border-radius: 0.5rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.8);
  background: rgb(var(--rgb-background) / 0.25);
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
  color: rgb(var(--rgb-text));
  transition: background-color 0.2s ease;
}

.filter-clear:hover {
  background: rgb(var(--rgb-primary) / 0.2);
}
</style>
