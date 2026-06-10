<script setup lang="ts">
import { computed, inject } from 'vue'
import {
  championTransformLabelKey,
  normalizeChampionTransform,
  type ChampionTransform,
} from '~/utils/championTransformStats'

const props = defineProps<{
  championId: number
  modelValue: 'all' | ChampionTransform
  transformRows: Array<{ championTransform?: ChampionTransform }>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: 'all' | ChampionTransform]
}>()

const p = inject('statisticsPageCtx') as any

const selectId = computed(() => `champion-transform-${props.championId}`)

function onChange(event: Event): void {
  const raw = String((event.target as HTMLSelectElement).value ?? 'all')
  if (raw === 'all') {
    emit('update:modelValue', 'all')
    return
  }
  emit('update:modelValue', normalizeChampionTransform(Number(raw)))
}
</script>

<template>
  <div class="champion-transform-select min-w-0 max-lg:w-full">
    <label class="sr-only" :for="selectId">{{
      p.t('statisticsPage.championTransformSelect')
    }}</label>
    <select
      :id="selectId"
      class="w-full max-w-full truncate rounded border border-primary/35 bg-black/30 px-1.5 py-0.5 text-[10px] font-medium text-text/85 hover:border-primary/55 max-lg:text-xs"
      :value="modelValue === 'all' ? 'all' : String(modelValue)"
      @click.stop
      @mousedown.stop
      @pointerdown.stop
      @change="onChange"
    >
      <option value="all">{{ p.t('statisticsPage.championTransformAll') }}</option>
      <option
        v-for="row in transformRows"
        :key="`${championId}-${row.championTransform ?? 0}`"
        :value="String(row.championTransform ?? 0)"
      >
        {{ p.t(championTransformLabelKey(normalizeChampionTransform(row.championTransform))) }}
      </option>
    </select>
  </div>
</template>
