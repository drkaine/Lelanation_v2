<template>
  <div class="flex justify-between">
    <span class="text-text/70">{{ label }}:</span>
    <span :class="valueClass">{{ displayValue }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface StatRowProps {
  label: string
  value: number
  isHighest?: boolean
  isLowest?: boolean
  format?: 'number' | 'decimal' | 'percent'
}

const props = withDefaults(defineProps<StatRowProps>(), {
  format: 'number',
})

const displayValue = computed(() => {
  if (props.format === 'decimal') {
    return props.value.toFixed(2)
  }
  return Math.round(props.value).toString()
})

const valueClass = computed(() => {
  if (props.isHighest) return 'text-success font-bold'
  if (props.isLowest) return 'text-error'
  return 'font-semibold text-text'
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
