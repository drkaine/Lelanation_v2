<template>
  <section class="map-page">
    <aside class="sidebar">
      <h1>{{ t('mapPlanner.title') }}</h1>

      <label class="field">
        <span>{{ t('mapPlanner.boardName') }}</span>
        <input
          :value="store.currentBoard.name"
          type="text"
          maxlength="80"
          @input="store.renameCurrentBoard(($event.target as HTMLInputElement).value)"
        />
      </label>

      <label class="field">
        <span>{{ t('mapPlanner.map') }}</span>
        <select :value="store.currentBoard.mapId" @change="onMapChange">
          <option v-for="mapAsset in MAP_PLANNER_MAPS" :key="mapAsset.id" :value="mapAsset.id">
            {{ mapAsset.name }}
          </option>
        </select>
      </label>

      <div class="tool-group">
        <button :class="{ active: tool === 'brush' }" @click="tool = 'brush'">
          {{ t('mapPlanner.brush') }}
        </button>
        <button :class="{ active: tool === 'eraser' }" @click="tool = 'eraser'">
          {{ t('mapPlanner.eraser') }}
        </button>
        <button :class="{ active: tool === 'icon' }" @click="tool = 'icon'">
          {{ t('mapPlanner.iconTool') }}
        </button>
      </div>

      <label class="field">
        <span>{{ t('mapPlanner.brushColor') }}</span>
        <input v-model="brushColor" type="color" />
      </label>

      <label class="field">
        <span>{{ t('mapPlanner.brushSize') }}: {{ brushSize }}</span>
        <input v-model.number="brushSize" type="range" min="2" max="40" step="1" />
      </label>

      <div class="icons-grid">
        <button
          v-for="icon in MAP_PLANNER_ICONS"
          :key="icon.key"
          type="button"
          class="icon-button"
          :class="{ active: selectedIconKey === icon.key }"
          :title="icon.label"
          @click="selectIcon(icon.key)"
        >
          <img
            :src="resolveAsset(icon.localPath, icon.fallbackUrl)"
            :alt="icon.label"
            @error="markAssetFallback(icon.localPath)"
          />
        </button>
      </div>

      <div class="action-group">
        <button @click="store.addLayer()">{{ t('mapPlanner.addLayer') }}</button>
        <button @click="clearActiveLayer">{{ t('mapPlanner.resetLayer') }}</button>
        <button @click="store.clearAllLayers()">{{ t('mapPlanner.resetAll') }}</button>
      </div>

      <div class="action-group">
        <button @click="store.persistBoards()">{{ t('mapPlanner.saveBoard') }}</button>
        <button @click="store.createBoard()">{{ t('mapPlanner.newBoard') }}</button>
        <button @click="copyShareLink">{{ t('mapPlanner.share') }}</button>
        <button @click="downloadScreenshot">{{ t('mapPlanner.screenshot') }}</button>
      </div>

      <label class="field">
        <span>{{ t('mapPlanner.zoom') }}: {{ Math.round(zoom * 100) }}%</span>
        <input v-model.number="zoom" type="range" min="0.5" max="2.5" step="0.1" />
      </label>
    </aside>

    <main class="map-workspace">
      <div
        ref="stageRef"
        class="stage"
        :style="{ transform: `scale(${zoom})` }"
        @pointerdown="onStagePointerDown"
        @pointermove="onStagePointerMove"
        @pointerup="onStagePointerUp"
        @pointerleave="onStagePointerUp"
      >
        <img
          class="map-background"
          :src="resolveAsset(currentMap.localPath, currentMap.fallbackUrl)"
          alt="Map"
          @error="markAssetFallback(currentMap.localPath)"
        />
        <canvas ref="canvasRef" class="drawing-canvas" width="1024" height="1024" />
        <img
          v-for="iconInstance in visibleIcons"
          :key="iconInstance.id"
          class="placed-icon"
          :src="getIconAsset(iconInstance.iconKey).url"
          :alt="iconInstance.iconKey"
          :style="{
            left: `${iconInstance.x * 100}%`,
            top: `${iconInstance.y * 100}%`,
            width: `${iconInstance.size}px`,
            height: `${iconInstance.size}px`,
          }"
          @error="markAssetFallback(getIconAsset(iconInstance.iconKey).localPath)"
          @pointerdown.stop="onIconPointerDown(iconInstance, $event)"
        />
      </div>
    </main>

    <aside class="layers-panel">
      <h2>{{ t('mapPlanner.layers') }}</h2>
      <div
        v-for="layer in store.currentBoard.layers"
        :key="layer.id"
        class="layer-item"
        :class="{ active: layer.id === store.currentBoard.activeLayerId }"
      >
        <button type="button" class="layer-select" @click="store.setActiveLayer(layer.id)">
          {{ layer.name }}
        </button>
        <input
          :value="layer.name"
          type="text"
          maxlength="40"
          @change="store.renameLayer(layer.id, ($event.target as HTMLInputElement).value)"
        />
        <label>
          <input
            type="checkbox"
            :checked="layer.visible"
            @change="
              store.setLayerVisibility(layer.id, ($event.target as HTMLInputElement).checked)
            "
          />
          {{ t('mapPlanner.visible') }}
        </label>
        <div class="layer-actions">
          <button type="button" @click="store.duplicateLayer(layer.id)">⧉</button>
          <button type="button" @click="store.removeLayer(layer.id)">✕</button>
        </div>
      </div>

      <h2>{{ t('mapPlanner.savedBoards') }}</h2>
      <div class="saved-list">
        <button
          v-for="board in store.boards"
          :key="board.id"
          type="button"
          :class="{ active: board.id === store.currentBoard.id }"
          @click="store.loadBoard(board.id)"
        >
          {{ board.name }}
        </button>
      </div>
      <button class="danger" type="button" @click="store.deleteBoard(store.currentBoard.id)">
        {{ t('mapPlanner.deleteBoard') }}
      </button>
    </aside>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { MapPlannerIconInstance, MapPlannerStroke } from '~/stores/MapPlannerStore'
import { useMapPlannerStore } from '~/stores/MapPlannerStore'
import { MAP_PLANNER_ICONS, MAP_PLANNER_MAPS } from '~/utils/mapPlannerAssets'

type ToolMode = 'brush' | 'eraser' | 'icon'

interface StagePoint {
  x: number
  y: number
}

interface VisibleIconInstance extends MapPlannerIconInstance {
  layerId: string
}

const { t } = useI18n()
const route = useRoute()
const store = useMapPlannerStore()

const stageRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const tool = ref<ToolMode>('brush')
const brushColor = ref('#ff1744')
const brushSize = ref(8)
const selectedIconKey = ref(MAP_PLANNER_ICONS[0]?.key ?? '')
const zoom = ref(1)
const drawingStrokeId = ref<string | null>(null)
const draggedIconRef = ref<{ iconId: string; layerId: string } | null>(null)
const failedAssets = ref<Set<string>>(new Set())

const currentMap = computed(() => {
  return MAP_PLANNER_MAPS.find(item => item.id === store.currentBoard.mapId) ?? MAP_PLANNER_MAPS[0]!
})

const visibleIcons = computed(() => {
  const layers = [...store.currentBoard.layers].reverse()
  const icons: VisibleIconInstance[] = []
  for (const layer of layers) {
    if (!layer.visible) continue
    icons.push(...layer.icons.map(icon => ({ ...icon, layerId: layer.id })))
  }
  return icons
})

useHead({
  title: () => t('mapPlanner.metaTitle'),
})

function markAssetFallback(localPath: string): void {
  failedAssets.value.add(localPath)
}

function resolveAsset(localPath: string, fallbackUrl: string): string {
  return failedAssets.value.has(localPath) ? fallbackUrl : localPath
}

function getIconAsset(iconKey: string): { url: string; localPath: string } {
  const icon = MAP_PLANNER_ICONS.find(item => item.key === iconKey)
  if (!icon) {
    return { url: '', localPath: '' }
  }
  return {
    url: resolveAsset(icon.localPath, icon.fallbackUrl),
    localPath: icon.localPath,
  }
}

function getLayerById(layerId: string) {
  return store.currentBoard.layers.find(layer => layer.id === layerId) ?? null
}

function getActiveLayer() {
  return (
    store.currentBoard.layers.find(layer => layer.id === store.currentBoard.activeLayerId) ?? null
  )
}

function toStagePoint(event: PointerEvent): StagePoint | null {
  const stage = stageRef.value
  if (!stage) return null
  const rect = stage.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
  }
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: MapPlannerStroke): void {
  if (stroke.points.length < 2) return
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.width
  ctx.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over'
  ctx.beginPath()
  const first = stroke.points[0]
  if (!first) {
    ctx.restore()
    return
  }
  ctx.moveTo(first.x * 1024, first.y * 1024)
  for (const point of stroke.points.slice(1)) {
    ctx.lineTo(point.x * 1024, point.y * 1024)
  }
  ctx.stroke()
  ctx.restore()
}

function renderCanvas(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const layers = [...store.currentBoard.layers].reverse()
  for (const layer of layers) {
    if (!layer.visible) continue
    for (const stroke of layer.strokes) {
      drawStroke(ctx, stroke)
    }
  }
}

function selectIcon(iconKey: string): void {
  selectedIconKey.value = iconKey
  tool.value = 'icon'
}

function onMapChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  store.setMap(value)
}

function addIconAt(point: StagePoint): void {
  const layer = getActiveLayer()
  if (!layer || !selectedIconKey.value) return
  layer.icons.push({
    id: crypto.randomUUID(),
    iconKey: selectedIconKey.value,
    x: point.x,
    y: point.y,
    size: 46,
  })
  store.touchBoard()
  renderCanvas()
}

function onStagePointerDown(event: PointerEvent): void {
  const point = toStagePoint(event)
  if (!point) return
  const layer = getActiveLayer()
  if (!layer) return

  if (tool.value === 'icon') {
    addIconAt(point)
    return
  }

  const strokeId = crypto.randomUUID()
  drawingStrokeId.value = strokeId
  layer.strokes.push({
    id: strokeId,
    color: brushColor.value,
    width: brushSize.value,
    eraser: tool.value === 'eraser',
    points: [point],
  })
  renderCanvas()
}

function onStagePointerMove(event: PointerEvent): void {
  const point = toStagePoint(event)
  if (!point) return

  if (draggedIconRef.value) {
    const layer = getLayerById(draggedIconRef.value.layerId)
    const icon = layer?.icons.find(item => item.id === draggedIconRef.value?.iconId)
    if (!icon) return
    icon.x = point.x
    icon.y = point.y
    renderCanvas()
    return
  }

  if (!drawingStrokeId.value) return
  const layer = getActiveLayer()
  const stroke = layer?.strokes.find(item => item.id === drawingStrokeId.value)
  if (!stroke) return
  stroke.points.push(point)
  renderCanvas()
}

function onStagePointerUp(): void {
  if (drawingStrokeId.value) {
    drawingStrokeId.value = null
    store.touchBoard()
  }
  if (draggedIconRef.value) {
    draggedIconRef.value = null
    store.touchBoard()
  }
}

function onIconPointerDown(icon: VisibleIconInstance, event: PointerEvent): void {
  const layer = getLayerById(icon.layerId)
  if (!layer) return
  if (tool.value === 'eraser') {
    layer.icons = layer.icons.filter(item => item.id !== icon.id)
    store.touchBoard()
    renderCanvas()
    return
  }
  if (tool.value === 'icon') {
    draggedIconRef.value = { iconId: icon.id, layerId: icon.layerId }
    event.preventDefault()
  }
}

function clearActiveLayer(): void {
  store.clearLayer(store.currentBoard.activeLayerId)
  renderCanvas()
}

async function copyShareLink(): Promise<void> {
  if (import.meta.server) return
  const shareCode = store.exportShareCode()
  const url = new URL(window.location.href)
  url.searchParams.set('share', shareCode)
  await navigator.clipboard.writeText(url.toString())
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image ${url}`))
    img.src = url
  })
}

async function downloadScreenshot(): Promise<void> {
  if (import.meta.server) return
  const screenshotCanvas = document.createElement('canvas')
  screenshotCanvas.width = 1024
  screenshotCanvas.height = 1024
  const ctx = screenshotCanvas.getContext('2d')
  if (!ctx) return

  const mapImage = await loadImage(
    resolveAsset(currentMap.value.localPath, currentMap.value.fallbackUrl)
  )
  ctx.drawImage(mapImage, 0, 0, 1024, 1024)

  const layers = [...store.currentBoard.layers].reverse().filter(layer => layer.visible)
  for (const layer of layers) {
    for (const stroke of layer.strokes) {
      drawStroke(ctx, stroke)
    }
    for (const icon of layer.icons) {
      const iconAsset = MAP_PLANNER_ICONS.find(item => item.key === icon.iconKey)
      if (!iconAsset) continue
      const iconImage = await loadImage(resolveAsset(iconAsset.localPath, iconAsset.fallbackUrl))
      const size = icon.size
      const x = icon.x * 1024 - size / 2
      const y = icon.y * 1024 - size / 2
      ctx.drawImage(iconImage, x, y, size, size)
    }
  }

  const link = document.createElement('a')
  link.href = screenshotCanvas.toDataURL('image/png')
  link.download = `${store.currentBoard.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`
  link.click()
}

onMounted(() => {
  store.hydrateFromStorage()
  const share = typeof route.query.share === 'string' ? route.query.share : ''
  if (share) {
    store.importShareCode(share)
  }
  renderCanvas()
})

watch(
  () => store.currentBoard.layers,
  () => {
    renderCanvas()
  },
  { deep: true }
)
</script>

<style scoped>
.map-page {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 290px;
  gap: 14px;
  padding: 14px;
}

.sidebar,
.layers-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: calc(100vh - 90px);
  overflow: auto;
  border-radius: 12px;
  border: 1px solid rgb(var(--rgb-accent) / 0.3);
  background: rgb(8 16 31 / 0.8);
  padding: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field input,
.field select {
  border: 1px solid rgb(var(--rgb-accent) / 0.35);
  border-radius: 8px;
  background: #0b1730;
  color: var(--color-blue-50);
  padding: 8px;
}

.tool-group,
.action-group {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.tool-group button,
.action-group button,
.layer-actions button,
.saved-list button,
.layer-select {
  border: 1px solid rgb(var(--rgb-accent) / 0.35);
  border-radius: 8px;
  background: #0f203f;
  color: var(--color-blue-50);
  padding: 8px;
  cursor: pointer;
}

.tool-group button.active,
.icon-button.active,
.saved-list button.active,
.layer-item.active .layer-select {
  border-color: rgb(var(--rgb-accent));
  color: var(--color-accent);
}

.icons-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.icon-button {
  border: 1px solid rgb(var(--rgb-accent) / 0.3);
  border-radius: 8px;
  background: #102146;
  padding: 6px;
  cursor: pointer;
}

.icon-button img {
  width: 100%;
  height: 40px;
  object-fit: contain;
}

.map-workspace {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  border-radius: 12px;
  border: 1px solid rgb(var(--rgb-accent) / 0.35);
  background: #050c19;
  min-height: calc(100vh - 90px);
}

.stage {
  position: relative;
  width: 1024px;
  height: 1024px;
  transform-origin: top left;
}

.map-background,
.drawing-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.map-background {
  object-fit: cover;
}

.drawing-canvas {
  z-index: 2;
}

.placed-icon {
  position: absolute;
  z-index: 4;
  transform: translate(-50%, -50%);
  user-select: none;
  -webkit-user-drag: none;
}

.layer-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  border: 1px solid rgb(var(--rgb-accent) / 0.2);
  border-radius: 10px;
  padding: 8px;
}

.layer-item input[type='text'] {
  border: 1px solid rgb(var(--rgb-accent) / 0.35);
  border-radius: 8px;
  background: #0c1a35;
  color: var(--color-blue-50);
  padding: 6px;
}

.layer-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.saved-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.danger {
  border-color: rgb(235 87 87 / 0.6);
}

@media (max-width: 1300px) {
  .map-page {
    grid-template-columns: 1fr;
  }

  .sidebar,
  .layers-panel {
    max-height: none;
  }
}
</style>
