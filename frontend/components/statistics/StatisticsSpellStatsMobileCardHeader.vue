<script setup lang="ts">
import { getSpellImageUrl } from '~/utils/imageUrl'

withDefaults(
  defineProps<{
    label: string
    gameVersion: string | null
    imageSpellId: number | null
    imageFile1: string | null
    imageSpellId2?: number | null
    imageFile2?: string | null
    isPair?: boolean
  }>(),
  {
    imageSpellId2: null,
    imageFile2: null,
    isPair: false,
  }
)
</script>

<template>
  <div
    class="statistics-champion-stats-mobile-identity statistics-spell-stats-mobile-identity flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5"
  >
    <div
      class="statistics-champion-stats-mobile-name w-full truncate text-center text-sm font-semibold leading-tight text-accent"
      :title="label"
    >
      {{ label }}
    </div>
    <div
      class="statistics-spell-stats-mobile-portraits flex shrink-0 items-center justify-center"
      :class="
        isPair && imageSpellId2 != null
          ? 'statistics-spell-stats-mobile-portraits--pair grid grid-cols-2 gap-1'
          : ''
      "
    >
      <img
        v-if="imageSpellId != null && imageFile1 && gameVersion"
        :src="getSpellImageUrl(gameVersion, imageFile1)"
        :alt="label"
        class="statistics-spell-stats-mobile-portrait rounded-sm border border-black/40 bg-black/25 object-contain"
        :class="isPair && imageSpellId2 != null ? 'h-9 w-9' : 'h-16 w-16'"
        :width="isPair && imageSpellId2 != null ? 36 : 64"
        :height="isPair && imageSpellId2 != null ? 36 : 64"
        loading="lazy"
        decoding="async"
      />
      <img
        v-if="isPair && imageSpellId2 != null && imageFile2 && gameVersion"
        :src="getSpellImageUrl(gameVersion, imageFile2)"
        :alt="label"
        class="statistics-spell-stats-mobile-portrait h-9 w-9 rounded-sm border border-black/40 bg-black/25 object-contain"
        width="36"
        height="36"
        loading="lazy"
        decoding="async"
      />
    </div>
  </div>
</template>
