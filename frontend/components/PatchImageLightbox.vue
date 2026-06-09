<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="patch-image-lightbox fixed inset-0 z-50 flex flex-col bg-black/90"
        :class="{ 'patch-image-lightbox--landscape-fallback': useCssFallback }"
        @click.self="close"
      >
        <!-- Close button -->
        <button
          type="button"
          class="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-white/20"
          @click="close"
        >
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <!-- Zoom controls -->
        <div
          class="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2 rounded-full bg-black/50 p-2"
        >
          <button
            type="button"
            class="rounded-full p-2 text-white transition-colors hover:bg-white/20"
            :disabled="scale <= minScale"
            @click="zoomOut"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
            </svg>
          </button>
          <span class="flex items-center px-2 text-sm text-white">{{ zoomPercent }}%</span>
          <button
            type="button"
            class="rounded-full p-2 text-white transition-colors hover:bg-white/20"
            :disabled="scale >= maxScale"
            @click="zoomIn"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
          <button
            type="button"
            class="rounded-full p-2 text-white transition-colors hover:bg-white/20"
            @click="resetZoom"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4h16v16H4z"
              />
            </svg>
          </button>
        </div>

        <!-- Image container with zoom/pan -->
        <div
          ref="containerRef"
          class="patch-image-lightbox__stage relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="stopDrag"
          @mouseleave="stopDrag"
          @wheel.prevent="onWheel"
          @touchstart="onTouchStart"
          @touchmove.prevent="onTouchMove"
          @touchend="stopDrag"
          @touchcancel="stopDrag"
        >
          <div
            class="patch-image-lightbox__transform absolute left-1/2 top-1/2"
            :class="{ 'patch-image-lightbox__transform--animating': !isDragging }"
            :style="transformStyle"
          >
            <img
              ref="imageRef"
              :src="src"
              :alt="alt"
              class="block max-w-none select-none"
              draggable="false"
              @load="fitToViewport"
              @dragstart.prevent
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useLandscapeOrientationLock } from '~/composables/useLandscapeOrientationLock'

const props = defineProps<{
  src: string
  alt: string
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { lockLandscape, unlockLandscape, useCssFallback } = useLandscapeOrientationLock()
const containerRef = ref<HTMLDivElement>()
const imageRef = ref<HTMLImageElement>()

const fitScale = ref(1)
const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)

const minScale = computed(() => Math.max(fitScale.value * 0.5, 0.1))
const maxScale = computed(() => Math.max(fitScale.value * 5, 1))
const zoomPercent = computed(() => Math.round((scale.value / fitScale.value) * 100))

const transformStyle = computed(() => ({
  transform: `translate(calc(-50% + ${translateX.value}px), calc(-50% + ${translateY.value}px)) scale(${scale.value})`,
  transformOrigin: 'center center',
}))

const isDragging = ref(false)
const startX = ref(0)
const startY = ref(0)
const dragStartTranslateX = ref(0)
const dragStartTranslateY = ref(0)

let resizeListener: (() => void) | null = null

function fitToViewport(): void {
  const container = containerRef.value
  const img = imageRef.value
  if (!container || !img) return

  const cw = container.clientWidth
  const ch = container.clientHeight
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  if (!cw || !ch || !iw || !ih) return

  const padding = 24
  const fit = Math.min((cw - padding) / iw, (ch - padding) / ih, 1)
  fitScale.value = fit
  scale.value = fit
  translateX.value = 0
  translateY.value = 0
}

async function close() {
  await unlockLandscape()
  emit('close')
  resetZoom()
}

function zoomIn() {
  scale.value = Math.min(scale.value * 1.25, maxScale.value)
}

function zoomOut() {
  scale.value = Math.max(scale.value / 1.25, minScale.value)
}

function resetZoom() {
  scale.value = fitScale.value
  translateX.value = 0
  translateY.value = 0
}

function onWheel(event: WheelEvent) {
  const delta = event.deltaY > 0 ? 0.9 : 1.1
  scale.value = Math.min(Math.max(scale.value * delta, minScale.value), maxScale.value)
}

function startDrag(clientX: number, clientY: number) {
  isDragging.value = true
  startX.value = clientX
  startY.value = clientY
  dragStartTranslateX.value = translateX.value
  dragStartTranslateY.value = translateY.value
}

function onDragMove(clientX: number, clientY: number) {
  if (!isDragging.value) return
  translateX.value = dragStartTranslateX.value + (clientX - startX.value)
  translateY.value = dragStartTranslateY.value + (clientY - startY.value)
}

function onMouseDown(event: MouseEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  startDrag(event.clientX, event.clientY)
}

function onMouseMove(event: MouseEvent) {
  if (!isDragging.value) return
  event.preventDefault()
  onDragMove(event.clientX, event.clientY)
}

function onTouchStart(event: TouchEvent) {
  if (event.touches.length !== 1) return
  startDrag(event.touches[0].clientX, event.touches[0].clientY)
}

function onTouchMove(event: TouchEvent) {
  if (!isDragging.value || event.touches.length !== 1) return
  onDragMove(event.touches[0].clientX, event.touches[0].clientY)
}

function stopDrag() {
  isDragging.value = false
}

function bindResizeListener(): void {
  if (!import.meta.client || resizeListener) return
  resizeListener = () => {
    if (!props.isOpen) return
    fitToViewport()
  }
  window.addEventListener('resize', resizeListener)
  window.addEventListener('orientationchange', resizeListener)
}

function unbindResizeListener(): void {
  if (!import.meta.client || !resizeListener) return
  window.removeEventListener('resize', resizeListener)
  window.removeEventListener('orientationchange', resizeListener)
  resizeListener = null
}

onMounted(() => {
  const handleKeydown = (e: KeyboardEvent) => {
    if (!props.isOpen) return
    if (e.key === 'Escape') close()
    if (e.key === '+' || e.key === '=') zoomIn()
    if (e.key === '-') zoomOut()
    if (e.key === '0') resetZoom()
  }
  window.addEventListener('keydown', handleKeydown)
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
    unbindResizeListener()
  })
})

watch(
  () => props.isOpen,
  async open => {
    if (open) {
      translateX.value = 0
      translateY.value = 0
      await lockLandscape()
      bindResizeListener()
      await nextTick()
      if (imageRef.value?.complete && imageRef.value.naturalWidth) {
        fitToViewport()
      }
      return
    }
    unbindResizeListener()
    await unlockLandscape()
  }
)

watch(
  () => props.src,
  async () => {
    if (!props.isOpen) return
    await nextTick()
    fitToViewport()
  }
)

watch(useCssFallback, async () => {
  if (!props.isOpen) return
  await nextTick()
  fitToViewport()
})
</script>

<style>
.patch-image-lightbox--landscape-fallback {
  width: 100vh !important;
  height: 100vw !important;
  top: 50% !important;
  right: auto !important;
  bottom: auto !important;
  left: 50% !important;
  transform: translate(-50%, -50%) rotate(90deg);
}

.patch-image-lightbox__stage {
  touch-action: none;
}

.patch-image-lightbox__transform--animating {
  transition: transform 75ms ease-out;
}
</style>
