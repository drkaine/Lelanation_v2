<template>
  <div v-if="rows.length > 0" class="flex flex-col items-center gap-3">
    <div class="relative inline-flex h-[132px] w-[132px] items-center justify-center">
      <svg viewBox="0 0 120 120" class="absolute inset-0 h-full w-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          :r="DONUT_RADIUS"
          fill="none"
          stroke="rgba(148, 163, 184, 0.18)"
          :stroke-width="DONUT_STROKE"
        />
        <circle
          v-for="(seg, idx) in segments"
          :key="rows[idx]?.key ?? idx"
          cx="60"
          cy="60"
          :r="DONUT_RADIUS"
          fill="none"
          :stroke="seg.color"
          :stroke-width="DONUT_STROKE"
          :stroke-dasharray="`${seg.arc} ${DONUT_CIRCLE - seg.arc}`"
          :stroke-dashoffset="`-${seg.offset}`"
        />
      </svg>
      <span class="relative z-10 text-lg font-bold text-info dark:text-primary-light">100%</span>
    </div>
    <ul class="grid w-full max-w-[360px] grid-cols-2 gap-x-3 gap-y-1 text-xs text-text/85">
      <li
        v-for="row in rows"
        :key="'legend-' + row.key"
        class="flex items-center justify-between gap-2"
      >
        <span class="inline-flex min-w-0 items-center gap-2">
          <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: row.color }" />
          <span class="truncate">{{ row.label }}</span>
        </span>
        <span class="shrink-0 font-semibold">{{ distPct(row.value, total) }}</span>
      </li>
    </ul>
  </div>
  <div v-else class="text-sm text-text/60">{{ emptyLabel }}</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export type DonutRow = { key: string; label: string; value: number; color: string }

const props = defineProps<{
  rows: DonutRow[]
  total: number
  emptyLabel: string
}>()

const DONUT_RADIUS = 46
const DONUT_STROKE = 14
const DONUT_CIRCLE = 2 * Math.PI * DONUT_RADIUS

function distPct(value: number, total: number): string {
  if (!total) return '—'
  return `${((value / total) * 100).toFixed(2)}%`
}

const segments = computed(() => {
  const total = props.total
  if (!total) return []
  let offset = 0
  return props.rows.map(row => {
    const arc = DONUT_CIRCLE * (row.value / total)
    const segment = { arc, offset, color: row.color }
    offset += arc
    return segment
  })
})
</script>
