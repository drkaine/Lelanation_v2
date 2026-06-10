<script setup lang="ts">
import type { PingMetricKey } from '~/composables/statistics/useStatisticsPingsTab'
import { onPingIconError, pingIconSrc } from '~/utils/pingIcons'

defineProps<{
  metricKey: PingMetricKey
  label: string
  value: string
  delta?: string | null
  deltaClass?: string | null
}>()
</script>

<template>
  <div class="flex flex-col items-center rounded bg-primary/10 px-2 py-1.5 text-center">
    <img
      :src="pingIconSrc(metricKey)"
      :alt="label"
      :title="label"
      class="mb-1 h-7 w-7 object-contain"
      width="28"
      height="28"
      loading="lazy"
      decoding="async"
      @error="onPingIconError($event, metricKey)"
    />
    <div class="font-bold tabular-nums text-text">{{ value }}</div>
    <div
      v-if="delta != null"
      class="mt-0.5 text-[10px] tabular-nums leading-none"
      :class="deltaClass ?? 'text-text/55'"
    >
      {{ delta }}
    </div>
  </div>
</template>
