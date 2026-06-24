<template>
  <div class="rounded-lg border border-primary/25 bg-surface/40 px-3 py-2.5">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="text-sm text-text/90">{{ label }}</span>
      <kbd
        class="inline-block shrink-0 whitespace-nowrap rounded-md border border-accent/35 bg-accent/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary-light"
      >
        {{ keys }}
      </kbd>
    </div>
    <p v-if="description" class="mt-1 text-xs leading-snug text-text/60">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  keys: string
  label: string
  description?: string
}>()
</script>
