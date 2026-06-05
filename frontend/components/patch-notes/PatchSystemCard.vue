<template>
  <article
    class="patch-system-card rounded-xl border border-primary/25 bg-surface/40 p-4 shadow-sm"
  >
    <h3 class="text-base font-semibold text-text-accent">
      {{ lang === 'fr' ? section.title_fr : section.title_en }}
    </h3>
    <p class="mt-2 text-sm leading-relaxed text-text/80">
      {{ lang === 'fr' ? section.content_fr : section.content_en }}
    </p>
  </article>
</template>

<script setup lang="ts">
import type { PatchSystemSection } from '~/stores/PatchNotesStore'

defineProps<{
  section: PatchSystemSection
  lang: 'fr' | 'en'
}>()
</script>
