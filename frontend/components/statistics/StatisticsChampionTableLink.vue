<script setup lang="ts">
import { computed } from 'vue'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'

/** Champion cell of the statistics tables: portrait + name (search match highlighted), linking to the champion page. */
const props = defineProps<{
  championId: number
  /** Default: champion name from the page context. */
  name?: string
  /** Default: Data Dragon portrait of the champion (`null`: no portrait). */
  portraitSrc?: string | null
  query?: string
}>()

const p =
  injectStatisticsPageCtx<
    Pick<
      StatisticsIndexPageCtx,
      'championByKey' | 'championName' | 'gameVersion' | 'getChampionImageUrl'
    >
  >()

const displayName = computed(
  () => props.name ?? String(p.championName(props.championId) || props.championId)
)

const portrait = computed(() => {
  if (props.portraitSrc !== undefined) return props.portraitSrc
  const champion = p.championByKey(props.championId)
  return p.gameVersion && champion
    ? p.getChampionImageUrl(p.gameVersion, champion.image.full)
    : null
})
</script>

<template>
  <StatisticsChampionDetailLink :champion-id="championId" class="flex items-center gap-2">
    <img
      v-if="portrait"
      :src="portrait"
      :alt="displayName"
      class="h-[50px] w-[50px] shrink-0 border-2 border-black object-cover"
      width="50"
      height="50"
      loading="lazy"
      decoding="async"
    />
    <span
      class="min-w-0 truncate text-[12px] text-accent underline decoration-accent/40 underline-offset-2"
    >
      <StatisticsChampionNameHighlight :name="displayName" :query="query" />
    </span>
  </StatisticsChampionDetailLink>
</template>
