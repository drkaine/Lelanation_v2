<script setup lang="ts">
import { computed } from 'vue'
import { splitChampionNameHighlight } from '~/utils/championDisplay'

const props = defineProps<{
  name: string
  query?: string
}>()

const parts = computed(() => splitChampionNameHighlight(props.name, props.query ?? ''))
</script>

<template>
  <span class="champion-name-highlight">
    <template v-for="(part, i) in parts" :key="i">
      <mark v-if="part.match" class="rounded bg-accent/35 px-0.5 text-inherit">{{
        part.text
      }}</mark>
      <span v-else>{{ part.text }}</span>
    </template>
  </span>
</template>
