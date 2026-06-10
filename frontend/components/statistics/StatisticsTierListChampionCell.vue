<script setup lang="ts">
import { computed, inject } from 'vue'
import { championTransformLabelKey } from '~/utils/championTransformStats'
import type { ChampionTransform } from '~/utils/championTransformStats'

const props = defineProps<{
  championId: number
  /** Largeur colonne (défaut = tier list). */
  widthClass?: string
  highlightQuery?: string
  /** Permet à la colonne de s’élargir (tableau champion avec colonnes masquées). */
  allowGrow?: boolean
  portraitSrcOverride?: string | null
  championTransform?: ChampionTransform
  showTransformDropdown?: boolean
  transformView?: 'all' | ChampionTransform
  transformRows?: Array<{ championTransform?: ChampionTransform }>
  isTransformSubRow?: boolean
}>()

const emit = defineEmits<{
  'update:transformView': [value: 'all' | ChampionTransform]
}>()

const p = inject('statisticsPageCtx') as any

const width = props.widthClass ?? 'w-[220px] max-lg:w-[56px]'

const defaultPortraitSrc = computed(() => {
  if (!p.gameVersion || !p.championByKey(props.championId)) return null
  return p.getChampionImageUrl(p.gameVersion, p.championByKey(props.championId)!.image.full)
})

const portraitSrc = computed(() => props.portraitSrcOverride ?? defaultPortraitSrc.value)

const displayName = computed(() => {
  const base = String(p.championName(props.championId) || props.championId)
  if (props.championTransform == null) return base
  const suffix = p.t(championTransformLabelKey(props.championTransform))
  return `${base} · ${suffix}`
})
</script>

<template>
  <div
    class="tier-list-lolalytics-td flex items-center gap-2 px-2 max-lg:justify-center max-lg:gap-0 max-lg:px-0.5"
    :class="[width, allowGrow ? 'shrink' : 'shrink-0', isTransformSubRow ? 'pl-6 opacity-95' : '']"
  >
    <StatisticsChampionDetailLink
      :champion-id="championId"
      class="shrink-0 max-lg:flex max-lg:justify-center"
    >
      <img
        v-if="portraitSrc"
        :src="portraitSrc"
        :alt="p.championName(championId) || ''"
        class="h-[50px] w-[50px] border-2 border-black object-cover max-lg:h-10 max-lg:w-10"
        width="50"
        height="50"
        loading="lazy"
        decoding="async"
      />
    </StatisticsChampionDetailLink>
    <div class="flex min-w-0 flex-col gap-1 max-lg:hidden">
      <StatisticsChampionDetailLink :champion-id="championId" class="min-w-0">
        <span
          class="block min-w-0 truncate text-[12px] text-accent text-text/90 underline decoration-accent/40 underline-offset-2"
        >
          <StatisticsChampionNameHighlight
            v-if="highlightQuery"
            :name="displayName"
            :query="highlightQuery"
          />
          <template v-else>{{ displayName }}</template>
        </span>
      </StatisticsChampionDetailLink>
      <StatisticsChampionTransformSelect
        v-if="showTransformDropdown && transformRows?.length"
        :champion-id="championId"
        :transform-rows="transformRows"
        :model-value="transformView ?? 'all'"
        @update:model-value="emit('update:transformView', $event)"
      />
    </div>
  </div>
</template>
