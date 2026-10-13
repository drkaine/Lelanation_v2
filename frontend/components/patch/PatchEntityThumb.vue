<template>
  <img
    v-if="entityImageUrl"
    :src="entityImageUrl"
    :alt="entity.name"
    width="48"
    height="48"
    loading="lazy"
    @error="onImageError"
  />
  <Icon v-else name="mdi:file-document-outline" aria-hidden="true" />
</template>

<script setup lang="ts">
import { usePatchEntityImage } from '~/composables/usePatchEntityImage'
import type { PatchEntity } from '~/stores/PatchNotesStore'

/** Miniature d'une entité de patch (champion, item…) via la même résolution que PatchGamingCard. */
const props = defineProps<{ entity: PatchEntity }>()
const { entityImageUrl, onImageError } = usePatchEntityImage(() => props.entity)
</script>
