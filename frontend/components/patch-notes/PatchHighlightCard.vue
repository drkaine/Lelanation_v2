<template>
  <article
    class="patch-highlight-card overflow-hidden rounded-xl border border-primary/25 bg-surface/40 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
  >
    <div class="relative aspect-[16/9] w-full overflow-hidden bg-background/60">
      <img
        v-if="highlight.image_url"
        :src="highlight.image_url"
        :alt="title"
        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />
      <div v-else class="flex h-full w-full items-center justify-center text-sm text-text/40">
        —
      </div>
    </div>
    <div class="border-t border-primary/15 p-3">
      <p class="text-sm font-semibold leading-snug text-text">{{ title }}</p>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { PatchHighlight } from '~/stores/PatchNotesStore'

const props = defineProps<{
  highlight: PatchHighlight
  lang: 'fr' | 'en'
}>()

const title = computed(() =>
  props.lang === 'fr' ? props.highlight.title_fr : props.highlight.title_en
)
</script>
