<template>
  <div
    class="flex items-center gap-3 rounded-lg border border-zinc-600/80 bg-zinc-950/90 px-3 py-2 shadow-[0_0_20px_rgba(0,0,0,0.35)]"
    :class="up ? 'shadow-[0_0_18px_rgba(34,197,94,0.25)]' : 'shadow-[0_0_18px_rgba(239,68,68,0.2)]'"
  >
    <div
      v-if="imageSrc"
      class="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-zinc-600 ring-1 ring-zinc-700/50"
    >
      <img :src="imageSrc" :alt="title" class="h-full w-full object-cover" loading="lazy" />
    </div>
    <div class="min-w-0 flex-1">
      <div class="truncate font-semibold text-zinc-100">{{ title }}</div>
      <div class="truncate text-xs text-zinc-400">{{ subtitle }}</div>
    </div>
    <div class="shrink-0 text-right font-mono">
      <div class="flex items-center justify-end gap-1 text-sm">
        <span v-if="up" class="text-emerald-400">▲</span>
        <span v-else class="text-rose-500">▼</span>
        <span :class="up ? 'text-emerald-400' : 'text-rose-500'" class="font-bold tracking-tight">
          {{ formattedDelta }}
        </span>
      </div>
      <div class="text-[10px] uppercase tracking-wider text-zinc-500">{{ metricLabel }}</div>
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
