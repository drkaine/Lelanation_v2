<script setup lang="ts">
/** En-tête mobile objets : nom + type au-dessus du portrait (aligné champions / sorts). */
withDefaults(
  defineProps<{
    itemName: string
    typeLabel?: string | null
    imageSrc?: string | null
    imageAlt?: string
    portraitSize?: number
  }>(),
  {
    typeLabel: null,
    imageSrc: null,
    imageAlt: '',
    portraitSize: 64,
  }
)
</script>

<template>
  <div
    class="statistics-champion-stats-mobile-identity statistics-item-stats-mobile-identity flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5"
  >
    <div class="flex w-full min-w-0 flex-col items-center gap-0.5 text-center">
      <div
        class="statistics-champion-stats-mobile-name w-full truncate text-sm font-semibold leading-tight text-accent"
        :title="itemName"
      >
        {{ itemName }}
      </div>
      <div
        v-if="typeLabel"
        class="statistics-item-stats-mobile-type w-full truncate text-xs text-text/70"
      >
        {{ typeLabel }}
      </div>
    </div>
    <div
      class="statistics-item-stats-mobile-portrait flex shrink-0 items-center justify-center rounded-sm border border-black/40 bg-black/25"
      :style="{ width: `${portraitSize}px`, height: `${portraitSize}px` }"
    >
      <img
        v-if="imageSrc"
        :src="imageSrc"
        :alt="imageAlt || itemName"
        class="h-full w-full rounded-sm object-contain"
        :width="portraitSize"
        :height="portraitSize"
        loading="lazy"
        decoding="async"
      />
    </div>
  </div>
</template>
