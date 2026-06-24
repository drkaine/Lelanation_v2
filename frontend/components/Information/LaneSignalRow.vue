<template>
  <div class="rounded-lg border border-primary/25 bg-surface/40 px-3 py-2.5">
    <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span
        class="inline-block rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary-light"
      >
        {{ shortLabel }}
      </span>
      <span class="text-sm font-medium text-text/90">{{ title }}</span>
    </div>
    <p class="mt-1.5 text-xs leading-snug text-text/65">{{ detail }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  shortLabel: string
  title: string
  detail: string
}>()
</script>
