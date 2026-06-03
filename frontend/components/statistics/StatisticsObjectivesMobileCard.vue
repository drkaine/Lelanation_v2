<script setup lang="ts">
export type ObjectivesMobileMetric = {
  label: string
  current: string
  delta?: string
  deltaClass?: string
}

export type ObjectivesMobileSubRow = {
  label: string
  metrics: ObjectivesMobileMetric[]
}

const props = defineProps<{
  title: string
  iconSrc?: string | null
  color?: string
  expandable?: boolean
  expanded?: boolean
  metrics: ObjectivesMobileMetric[]
  subRows?: ObjectivesMobileSubRow[]
}>()

const emit = defineEmits<{
  toggle: []
}>()

function onHeaderClick() {
  if (props.expandable) emit('toggle')
}
</script>

<template>
  <article
    class="statistics-objectives-mobile-card rounded-lg border border-primary/30 bg-surface/40 p-3"
  >
    <component
      :is="expandable ? 'button' : 'div'"
      :type="expandable ? 'button' : undefined"
      class="statistics-objectives-mobile-card-header flex w-full items-center gap-2 text-left"
      @click="onHeaderClick"
    >
      <span
        v-if="expandable"
        class="inline-block shrink-0 text-xs text-text/60 transition-transform duration-200"
        :class="expanded ? 'rotate-180' : ''"
        aria-hidden
        >▼</span
      >
      <span
        v-if="color"
        class="h-2.5 w-2.5 shrink-0 rounded-full"
        :style="{ backgroundColor: color }"
      />
      <img
        v-if="iconSrc"
        :src="iconSrc"
        :alt="title"
        class="h-5 w-5 shrink-0 object-contain"
        loading="lazy"
        decoding="async"
      />
      <h3 class="min-w-0 flex-1 text-sm font-semibold leading-snug text-text">
        {{ title }}
      </h3>
    </component>

    <div class="statistics-objectives-mobile-metrics mt-3 grid grid-cols-2 gap-2">
      <div
        v-for="(metric, idx) in metrics"
        :key="`metric-${idx}-${metric.label}`"
        class="rounded-md bg-black/20 px-2 py-1.5"
      >
        <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
          {{ metric.label }}
        </div>
        <div class="mt-0.5 text-sm font-medium tabular-nums text-text/90">
          {{ metric.current }}
        </div>
        <div
          v-if="metric.delta"
          class="text-xs tabular-nums leading-tight"
          :class="metric.deltaClass ?? 'text-text/80'"
        >
          {{ metric.delta }}
        </div>
      </div>
    </div>

    <div
      v-if="expanded && subRows?.length"
      class="statistics-objectives-mobile-subrows mt-2 space-y-2 border-t border-primary/20 pt-2"
    >
      <div
        v-for="(sub, sIdx) in subRows"
        :key="`sub-${sIdx}-${sub.label}`"
        class="rounded-md bg-surface/30 px-2 py-1.5"
      >
        <div class="mb-1.5 text-xs font-medium text-text/70">{{ sub.label }}</div>
        <div class="grid grid-cols-2 gap-1.5">
          <div v-for="(m, mIdx) in sub.metrics" :key="`sub-m-${sIdx}-${mIdx}`">
            <div class="text-[10px] text-text/55">{{ m.label }}</div>
            <div class="text-xs font-medium tabular-nums text-text/85">
              {{ m.current }}
            </div>
            <div
              v-if="m.delta"
              class="text-[10px] tabular-nums leading-tight"
              :class="m.deltaClass ?? 'text-text/80'"
            >
              {{ m.delta }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
