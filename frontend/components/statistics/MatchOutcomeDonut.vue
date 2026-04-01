<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    total: number
    early: number
    surrenderOnly: number
    played: number
  }>(),
  { total: 0, early: 0, surrenderOnly: 0, played: 0 }
)

/** Same geometry as win-share donut (Solo/Duo): viewBox 120, r=48, stroke 14 */
const R = 48
const circumference = 2 * Math.PI * R

const segs = computed(() => {
  const t = props.total
  if (!t || t <= 0) {
    return { dE: 0, dS: 0, dP: 0, offS: 0, offP: 0, center: '0' }
  }
  const pE = props.early / t
  const pS = props.surrenderOnly / t
  const pP = props.played / t
  const dE = circumference * pE
  const dS = circumference * pS
  const dP = circumference * pP
  return {
    dE,
    dS,
    dP,
    offS: -dE,
    offP: -(dE + dS),
    center: String(Math.round(pP * 100)),
  }
})
</script>

<template>
  <div
    class="pie-chart-2 relative inline-flex h-[150px] w-[150px] shrink-0 items-center justify-center"
    aria-hidden="true"
  >
    <svg class="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 120 120">
      <circle
        cx="60"
        cy="60"
        :r="R"
        fill="none"
        stroke="currentColor"
        stroke-width="14"
        stroke-linecap="butt"
        class="text-surface/50 dark:text-surface/40"
        :stroke-dasharray="circumference + ' ' + circumference"
        stroke-dashoffset="0"
      />
      <circle
        cx="60"
        cy="60"
        :r="R"
        fill="none"
        stroke="currentColor"
        stroke-width="14"
        stroke-linecap="butt"
        class="text-amber-500 dark:text-amber-300"
        :stroke-dasharray="segs.dE + ' ' + circumference"
        stroke-dashoffset="0"
      />
      <circle
        cx="60"
        cy="60"
        :r="R"
        fill="none"
        stroke="currentColor"
        stroke-width="14"
        stroke-linecap="butt"
        class="text-amber-200 dark:text-amber-100"
        :stroke-dasharray="segs.dS + ' ' + circumference"
        :stroke-dashoffset="segs.offS"
      />
      <circle
        cx="60"
        cy="60"
        :r="R"
        fill="none"
        stroke="currentColor"
        stroke-width="14"
        stroke-linecap="butt"
        class="text-blue-500 dark:text-blue-400"
        :stroke-dasharray="segs.dP + ' ' + circumference"
        :stroke-dashoffset="segs.offP"
      />
    </svg>
    <div class="relative z-10 flex flex-col items-center text-center">
      <span class="block text-xl font-bold text-blue-600 dark:text-blue-400"
        >{{ segs.center }}%</span
      >
    </div>
  </div>
</template>
