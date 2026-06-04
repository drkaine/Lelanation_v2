<script setup lang="ts">
import { inject } from 'vue'

const props = defineProps<{
  championId: number
  /** Largeur colonne (défaut = tier list). */
  widthClass?: string
  highlightQuery?: string
  /** Permet à la colonne de s’élargir (tableau champion avec colonnes masquées). */
  allowGrow?: boolean
}>()

const p = inject('statisticsPageCtx') as any

const width = props.widthClass ?? 'w-[220px] max-lg:w-[56px]'
</script>

<template>
  <div
    class="tier-list-lolalytics-td flex items-center gap-2 px-2 max-lg:justify-center max-lg:gap-0 max-lg:px-0.5"
    :class="[width, allowGrow ? 'shrink' : 'shrink-0']"
  >
    <StatisticsChampionDetailLink
      :champion-id="championId"
      class="flex min-w-0 items-center gap-2 max-lg:justify-center max-lg:gap-0"
    >
      <img
        v-if="p.gameVersion && p.championByKey(championId)"
        :src="p.getChampionImageUrl(p.gameVersion, p.championByKey(championId)!.image.full)"
        :alt="p.championName(championId) || ''"
        class="h-[50px] w-[50px] shrink-0 border-2 border-black object-cover max-lg:h-10 max-lg:w-10"
        width="50"
        height="50"
        loading="lazy"
        decoding="async"
      />
      <span
        class="min-w-0 truncate text-[12px] text-accent text-text/90 underline decoration-accent/40 underline-offset-2 max-lg:hidden"
      >
        <StatisticsChampionNameHighlight
          v-if="highlightQuery"
          :name="String(p.championName(championId) || championId)"
          :query="highlightQuery"
        />
        <template v-else>{{ p.championName(championId) || String(championId) }}</template>
      </span>
    </StatisticsChampionDetailLink>
  </div>
</template>
