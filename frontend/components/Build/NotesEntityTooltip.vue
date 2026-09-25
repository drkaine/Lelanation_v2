<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { NotesEntityTooltipContent } from '~/composables/useNotesEntityTooltip'
import { fixedTooltipStyleFromPointer } from '~/utils/tooltipPosition'

/** Fixed tooltip of a build notes entity, following the pointer. */
const props = defineProps<{
  content: NotesEntityTooltipContent | null
  pointer: { x: number; y: number }
}>()

const el = ref<HTMLElement | null>(null)
const style = ref<Record<string, string>>({})

watch(
  () => [props.content, props.pointer] as const,
  () =>
    nextTick(() => {
      if (el.value) style.value = fixedTooltipStyleFromPointer(el.value, props.pointer)
    }),
  { immediate: true }
)
</script>

<template>
  <Teleport to="body">
    <!-- eslint-disable vue/no-v-html -->
    <div v-if="content" ref="el" class="notes-entity-tooltip" :style="style">
      <div class="notes-entity-tooltip-name">{{ content.name }}</div>
      <div v-if="content.html !== null" class="notes-entity-tooltip-desc" v-html="content.html" />
    </div>
    <!-- eslint-enable vue/no-v-html -->
  </Teleport>
</template>

<style scoped>
.notes-entity-tooltip {
  position: fixed;
  z-index: 9999;
  max-width: 280px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(8, 12, 20, 0.96);
  pointer-events: none;
}

.notes-entity-tooltip-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-accent, #c8aa6e);
  margin-bottom: 4px;
}

.notes-entity-tooltip-desc {
  font-size: 12px;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.85);
}
</style>
