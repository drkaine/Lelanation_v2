<template>
  <div class="stat-card bg-surface-dark rounded border border-primary p-3">
    <p class="text-text/70 mb-1 text-xs">{{ label }}</p>
    <div class="flex items-center gap-2">
      <p class="text-lg font-bold text-text">{{ displayValue }}{{ suffix }}</p>
      <span
        v-if="delta !== null && delta !== 0"
        :class="['text-xs font-semibold transition-all', deltaClass]"
      >
        {{ delta > 0 ? '+' : '' }}{{ formatDelta }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface StatCardProps {
  label: string
  value: number
  previousValue?: number | null
  format?: 'number' | 'decimal' | 'percent'
  suffix?: string
}

const props = withDefaults(defineProps<StatCardProps>(), {
  format: 'number',
  previousValue: null,
  suffix: '',
})

const displayValue = computed(() => {
  if (props.format === 'percent') {
    return `${(props.value * 100).toFixed(1)}%`
  } else if (props.format === 'decimal') {
    return props.value.toFixed(2)
  }
  return Math.round(props.value).toString()
})

const delta = computed(() => {
  if (props.previousValue === null || props.previousValue === undefined) return null
  return props.value - props.previousValue
})

const formatDelta = computed(() => {
  if (!delta.value) return ''
  if (props.format === 'percent') {
    return `${(delta.value * 100).toFixed(1)}%`
  } else if (props.format === 'decimal') {
    return delta.value.toFixed(2)
  }
  return delta.value.toFixed(1)
})

const deltaClass = computed(() => {
  if (!delta.value) return ''
  if (delta.value > 0) return 'text-success'
  if (delta.value < 0) return 'text-error'
  return ''
})
</script>

<style scoped>
.text-success {
  color: var(--color-success);
}

.text-error {
  color: var(--color-error);
}
</style>
