<script setup lang="ts">
/** Bulle ⓘ d’aide tableau (même pattern que objectifs / fast-stats). */
withDefaults(
  defineProps<{
    ariaLabel: string
    text: string
    secondaryText?: string
    align?: 'end' | 'start'
  }>(),
  {
    secondaryText: undefined,
    align: 'end',
  }
)
</script>

<template>
  <span
    class="group/stat-tip relative inline-flex shrink-0 cursor-help text-text/50"
    :aria-label="ariaLabel"
  >
    ⓘ
    <span
      role="tooltip"
      class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
      :class="[
        secondaryText ? 'fast-stat-tooltip-popover--objectives' : '',
        align === 'end' ? 'fast-stat-tooltip-popover--end' : 'fast-stat-tooltip-popover--start',
      ]"
    >
      {{ text }}
      <span v-if="secondaryText" class="mt-1 block border-t border-primary/20 pt-1 text-text/80">
        {{ secondaryText }}
      </span>
    </span>
  </span>
</template>
