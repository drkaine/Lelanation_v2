<template>
  <div class="rounded-lg border border-primary/25 bg-surface/40 p-4">
    <h3 class="text-base font-semibold text-accent">{{ title }}</h3>
    <p class="mt-1 text-sm text-text/80">{{ definition }}</p>
    <pre
      class="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md border border-primary/20 bg-background/70 px-3 py-2 font-mono text-xs leading-relaxed text-primary-light"
      >{{ formula }}</pre
    >
    <p class="mt-2 text-sm italic text-text/65">{{ example }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  definition: string
  formula: string
  example: string
}>()
</script>
