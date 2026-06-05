<template>
  <article
    class="patch-skin-card overflow-hidden rounded-xl border border-primary/25 bg-surface/40 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
  >
    <div class="relative aspect-[3/4] w-full overflow-hidden bg-background/60">
      <img
        v-if="skin.image_url"
        :src="skin.image_url"
        :alt="displayName"
        class="h-full w-full object-cover"
        loading="lazy"
      />
    </div>
    <div class="border-t border-primary/15 p-3">
      <p class="font-semibold text-text">{{ displayName }}</p>
      <p class="mt-0.5 text-xs text-text/60">{{ skin.champion }}</p>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { PatchSkin } from '~/stores/PatchNotesStore'

const props = defineProps<{
  skin: PatchSkin
  lang: 'fr' | 'en'
}>()

const displayName = computed(() => (props.lang === 'fr' ? props.skin.name_fr : props.skin.name_en))
</script>
