<script setup lang="ts">
/** En-tête mobile unifié : nom + rôle (icône) au-dessus du portrait. */
withDefaults(
  defineProps<{
    championId: number
    championName: string
    searchQuery?: string
    roleLabel?: string | null
    roleIconSrc?: string | null
    portraitSrc?: string | null
    portraitAlt?: string
    portraitSize?: number
  }>(),
  {
    searchQuery: '',
    roleLabel: null,
    roleIconSrc: null,
    portraitSrc: null,
    portraitAlt: '',
    portraitSize: 64,
  }
)
</script>

<template>
  <StatisticsChampionDetailLink
    :champion-id="championId"
    class="statistics-champion-stats-mobile-identity flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
  >
    <div class="flex w-full min-w-0 flex-col items-center gap-0.5 text-center">
      <div
        class="statistics-champion-stats-mobile-name w-full truncate text-sm font-semibold leading-tight text-accent underline decoration-accent/40 underline-offset-2"
      >
        <StatisticsChampionNameHighlight
          :name="championName || String(championId)"
          :query="searchQuery"
        />
      </div>
      <div
        v-if="roleLabel"
        class="statistics-champion-stats-mobile-role flex max-w-full items-center justify-center gap-1 text-xs text-text/70"
      >
        <img
          v-if="roleIconSrc"
          :src="roleIconSrc"
          :alt="roleLabel"
          class="h-4 w-4 shrink-0 object-contain"
          width="16"
          height="16"
          loading="lazy"
          decoding="async"
        />
        <span class="truncate">{{ roleLabel }}</span>
      </div>
    </div>
    <StatisticsChampionPortrait
      :src="portraitSrc"
      :alt="portraitAlt || championName"
      :champion-id="championId"
      :champion-name="championName"
      :size="portraitSize"
      rounded="sm"
    />
  </StatisticsChampionDetailLink>
</template>
