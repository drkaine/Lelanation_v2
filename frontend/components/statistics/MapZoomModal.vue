<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  FULL_VIEW,
  panView,
  viewBoxAttr,
  zoomView,
  type MapView,
} from '~/utils/statistics/mapViewport'

/** Carte plein écran : zoom (molette, boutons), déplacement (glisser), filtres en slot. */
const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()

const view = ref<MapView>({ ...FULL_VIEW })
const svg = ref<SVGSVGElement | null>(null)
const drag = ref<{ x: number; y: number } | null>(null)
const zoomPct = computed(() => Math.round((100 / view.value.w) * 100))

function mapPoint(e: { clientX: number; clientY: number }): { x: number; y: number } {
  const rect = svg.value?.getBoundingClientRect()
  if (!rect?.width) return { x: 50, y: 50 }
  return {
    x: view.value.x + ((e.clientX - rect.left) / rect.width) * view.value.w,
    y: view.value.y + ((e.clientY - rect.top) / rect.height) * view.value.w,
  }
}
function zoom(factor: number): void {
  view.value = zoomView(
    view.value,
    factor,
    view.value.x + view.value.w / 2,
    view.value.y + view.value.w / 2
  )
}
function onWheel(e: WheelEvent): void {
  const p = mapPoint(e)
  view.value = zoomView(view.value, e.deltaY < 0 ? 1.25 : 0.8, p.x, p.y)
}
function onDown(e: PointerEvent): void {
  drag.value = { x: e.clientX, y: e.clientY }
  ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
}
function onMove(e: PointerEvent): void {
  if (!drag.value || !svg.value) return
  const k = view.value.w / svg.value.getBoundingClientRect().width
  view.value = panView(view.value, (drag.value.x - e.clientX) * k, (drag.value.y - e.clientY) * k)
  drag.value = { x: e.clientX, y: e.clientY }
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
  else if (e.key === '+' || e.key === '=') zoom(1.25)
  else if (e.key === '-') zoom(0.8)
}

watch(
  () => props.open,
  open => {
    if (typeof window === 'undefined') return
    if (open) {
      view.value = { ...FULL_VIEW }
      window.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
    } else {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }
)
onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="mz" role="dialog" aria-modal="true" :aria-label="title">
      <header class="mz-head">
        <h3>{{ title }}</h3>
        <div class="mz-tools">
          <button
            type="button"
            :aria-label="t('statisticsPage.mapModal.zoomOut')"
            @click="zoom(0.8)"
          >
            −
          </button>
          <span>{{ zoomPct }} %</span>
          <button
            type="button"
            :aria-label="t('statisticsPage.mapModal.zoomIn')"
            @click="zoom(1.25)"
          >
            +
          </button>
          <button type="button" @click="view = { ...FULL_VIEW }">
            {{ t('statisticsPage.mapModal.reset') }}
          </button>
          <button
            type="button"
            class="mz-close"
            :aria-label="t('statisticsPage.mapModal.close')"
            @click="emit('close')"
          >
            ✕
          </button>
        </div>
      </header>
      <div class="mz-body">
        <aside class="mz-filters"><slot name="filters" /></aside>
        <div class="mz-stage">
          <svg
            ref="svg"
            :viewBox="viewBoxAttr(view)"
            :class="{ 'is-drag': drag }"
            role="img"
            :aria-label="title"
            @wheel.prevent="onWheel"
            @pointerdown="onDown"
            @pointermove="onMove"
            @pointerup="drag = null"
            @pointercancel="drag = null"
            @dblclick="view = zoomView(view, 2, mapPoint($event).x, mapPoint($event).y)"
          >
            <image href="/data/community-dragon/map-planner/map11.png" width="100" height="100" />
            <slot />
          </svg>
          <p class="mz-hint">{{ t('statisticsPage.mapModal.hint') }}</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.mz {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  background: rgba(1, 10, 19, 0.97);
  color: #f0e6d2;
}
.mz-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid #463714;
}
.mz-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.mz-tools {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.mz-tools button {
  min-width: 32px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid #463714;
  border-radius: 6px;
  color: #f0e6d2;
}
.mz-tools button:hover {
  border-color: #c89b3c;
}
.mz-body {
  display: grid;
  flex: 1;
  min-height: 0;
  grid-template-columns: minmax(220px, 320px) minmax(0, 1fr);
}
.mz-filters {
  overflow-y: auto;
  padding: 14px 16px;
  border-right: 1px solid #463714;
}
.mz-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 12px;
}
.mz-stage svg {
  width: min(100%, calc(100vh - 120px));
  aspect-ratio: 1;
  border: 1px solid #463714;
  border-radius: 8px;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.mz-stage svg.is-drag {
  cursor: grabbing;
}
.mz-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: #a09b8c;
}
@media (max-width: 767px) {
  .mz-body {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }
  .mz-filters {
    max-height: 35vh;
    border-right: 0;
    border-bottom: 1px solid #463714;
  }
  .mz-stage svg {
    width: min(100%, 60vh);
  }
}
</style>
