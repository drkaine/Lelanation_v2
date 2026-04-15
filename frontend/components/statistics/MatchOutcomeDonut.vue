<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    total: number
    early: number
    surrenderOnly: number
    played: number
    /** Vue d’ensemble : défaut. Onglet Teams : teinte « parties jouées » + centre comme les cartes blue/red. */
    sideAccent?: 'default' | 'blue' | 'red'
  }>(),
  { total: 0, early: 0, surrenderOnly: 0, played: 0, sideAccent: 'default' }
)

const donutData = computed<number[]>(() => {
  const clamp = (v: number) => (Number.isFinite(v) ? Math.max(0, v) : 0)
  return [clamp(props.early), clamp(props.surrenderOnly), clamp(props.played)]
})

const radius = 48
const strokeWidth = 14
const circleLength = 2 * Math.PI * radius

const donutSegments = computed(() => {
  const early = donutData.value[0] ?? 0
  const surrenderOnly = donutData.value[1] ?? 0
  const played = donutData.value[2] ?? 0
  const total = early + surrenderOnly + played
  if (total <= 0) return []

  const colors = [
    donutCategories.value.early.color,
    donutCategories.value.surrender.color,
    donutCategories.value.played.color,
  ]
  const values = [early, surrenderOnly, played]
  let offset = 0

  return values.map((rawValue, index) => {
    const value = rawValue ?? 0
    const ratio = value / total
    const arcLength = circleLength * ratio
    const segment = {
      color: colors[index] ?? '#64748b',
      arcLength,
      offset,
    }
    offset += arcLength
    return segment
  })
})

const donutCategories = computed(() => {
  const playedColor =
    props.sideAccent === 'blue' ? '#38bdf8' : props.sideAccent === 'red' ? '#fb7185' : '#3b82f6'
  return {
    early: { name: 'Early', color: '#f59e0b' },
    surrender: { name: 'Surrender', color: '#fde68a' },
    played: { name: 'Played', color: playedColor },
  }
})

const centerPct = computed(() => {
  const total = props.total
  if (!total || total <= 0) return '0'
  return String(Math.round((props.played / total) * 100))
})

const centerPctClass = computed(() => {
  switch (props.sideAccent) {
    case 'blue':
      return 'block text-xl font-bold text-sky-600 dark:text-sky-300'
    case 'red':
      return 'block text-xl font-bold text-rose-600 dark:text-rose-300'
    default:
      return 'block text-xl font-bold text-blue-600 dark:text-blue-400'
  }
})
</script>

<template>
  <div
    class="pie-chart-2 relative inline-flex h-[112px] w-[112px] max-w-full shrink-0 items-center justify-center overflow-hidden sm:h-[132px] sm:w-[132px] lg:h-[150px] lg:w-[150px]"
    aria-hidden="true"
  >
    <svg
      viewBox="0 0 120 120"
      class="absolute inset-0 h-full w-full -rotate-90"
      role="presentation"
      focusable="false"
    >
      <circle
        cx="60"
        cy="60"
        :r="radius"
        fill="none"
        stroke="rgba(148, 163, 184, 0.18)"
        :stroke-width="strokeWidth"
      />
      <circle
        v-for="(segment, index) in donutSegments"
        :key="index"
        cx="60"
        cy="60"
        :r="radius"
        fill="none"
        :stroke="segment.color"
        :stroke-width="strokeWidth"
        stroke-linecap="butt"
        :stroke-dasharray="`${segment.arcLength} ${circleLength - segment.arcLength}`"
        :stroke-dashoffset="`-${segment.offset}`"
      />
    </svg>
    <div class="relative z-10 flex flex-col items-center text-center">
      <span :class="[centerPctClass, 'text-base sm:text-lg lg:text-xl']">{{ centerPct }}%</span>
    </div>
  </div>
</template>
