<template>
  <div
    class="ui-build-card-surface flex items-center gap-3 rounded-xl px-3 py-2"
    :class="up ? 'shadow-[0_0_18px_rgba(34,197,94,0.25)]' : 'shadow-[0_0_18px_rgba(239,68,68,0.2)]'"
  >
    <div
      v-if="imageSrc"
      class="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-primary/30"
    >
      <img :src="imageSrc" :alt="title" class="h-full w-full object-cover" loading="lazy" />
    </div>
    <div class="min-w-0 flex-1">
      <div class="truncate font-semibold text-text-accent">{{ title }}</div>
      <div class="truncate text-xs text-text/60">{{ subtitle }}</div>
    </div>
    <div class="shrink-0 text-right font-mono">
      <div class="flex items-center justify-end gap-1 text-sm">
        <span v-if="up" class="text-info">▲</span>
        <span v-else class="text-error/900">▼</span>
        <span :class="up ? 'text-info' : 'text-error/900'" class="font-bold tracking-tight">
          {{ formattedDelta }}
        </span>
      </div>
      <div class="text-[10px] uppercase tracking-wider text-text/50">{{ metricLabel }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  title: string
  subtitle?: string
  delta: number
  metricLabel: string
  imageSrc?: string | null
}>()

const up = computed(() => props.delta >= 0)
const formattedDelta = computed(() => {
  const sign = props.delta > 0 ? '+' : ''
  return `${sign}${props.delta.toFixed(2)}%`
})
</script>
