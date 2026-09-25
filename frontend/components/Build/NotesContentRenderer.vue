<template>
  <div
    class="notes-content-renderer"
    @mouseover="onEntityMouseOver"
    @mousemove="onEntityMouseMove"
    @mouseout="onEntityMouseOut"
  >
    <!-- eslint-disable vue/no-v-html -->
    <div class="notes-content-renderer__html" v-html="sanitizedHtml" />
    <!-- eslint-enable vue/no-v-html -->

    <NotesEntityTooltip :content="entityTooltipResolved" :pointer="entityTooltip.pointer" />
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import type { Champion } from '@lelanation/shared-types'
import NotesEntityTooltip from '~/components/Build/NotesEntityTooltip.vue'
import { useNotesEntityTooltip } from '~/composables/useNotesEntityTooltip'
import { sanitizeNotesHtml } from '~/utils/sanitizeNotesHtml'

const props = defineProps<{
  html: string
  champion?: Champion | null
}>()

const sanitizedHtml = computed(() => sanitizeNotesHtml(props.html || ''))

const {
  entityTooltip,
  entityTooltipResolved,
  onEntityMouseOver,
  onEntityMouseMove,
  onEntityMouseOut,
  hide: hideEntityTooltip,
} = useNotesEntityTooltip(() => props.champion)

watch(() => props.html, hideEntityTooltip)
</script>

<style scoped>
.notes-content-renderer__html {
  font-size: 0.9375rem;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.9);
}

.notes-content-renderer__html :deep(.notes-entity) {
  display: inline-flex;
  vertical-align: middle;
  margin: 0 2px;
}

.notes-content-renderer__html :deep(.notes-entity-icon) {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  vertical-align: middle;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
}

.notes-content-renderer__html :deep(ul) {
  margin: 0.5em 0;
  padding-left: 1.25em;
}

.notes-content-renderer__html :deep(li) {
  margin: 0.25em 0;
}

.notes-content-renderer__html :deep(strong),
.notes-content-renderer__html :deep(b) {
  color: rgba(255, 255, 255, 0.98);
  font-weight: 700;
}
</style>
