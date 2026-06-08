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
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
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
          <span class="flex items-center px-2 text-sm text-white"
            >{{ Math.round(scale * 100) }}%</span
          >
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
          class="h-full w-full cursor-grab overflow-hidden active:cursor-grabbing"
          @mousedown="startDrag"
          @mousemove="onDrag"
          @mouseup="stopDrag"
          @mouseleave="stopDrag"
          @wheel.prevent="onWheel"
        >
          <img
            :src="src"
            :alt="alt"
            class="max-h-none max-w-none transition-transform duration-75 ease-out"
            :style="{
              transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
              transformOrigin: 'center center',
            }"
            @dragstart.prevent
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  src: string
  alt: string
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const containerRef = ref<HTMLDivElement>()

// Zoom state
const minScale = 0.5
const maxScale = 5
const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)

// Drag state
const isDragging = ref(false)
const startX = ref(0)
const startY = ref(0)
const dragStartTranslateX = ref(0)
const dragStartTranslateY = ref(0)

function close() {
  emit('close')
  resetZoom()
}

function zoomIn() {
  scale.value = Math.min(scale.value * 1.25, maxScale)
}

function zoomOut() {
  scale.value = Math.max(scale.value / 1.25, minScale)
}

function resetZoom() {
  scale.value = 1
  translateX.value = 0
  translateY.value = 0
}

function onWheel(event: WheelEvent) {
  const delta = event.deltaY > 0 ? 0.9 : 1.1
  const newScale = Math.min(Math.max(scale.value * delta, minScale), maxScale)
  scale.value = newScale
}

function startDrag(event: MouseEvent) {
  isDragging.value = true
  startX.value = event.clientX
  startY.value = event.clientY
  dragStartTranslateX.value = translateX.value
  dragStartTranslateY.value = translateY.value
}

function onDrag(event: MouseEvent) {
  if (!isDragging.value) return
  event.preventDefault()
  const deltaX = event.clientX - startX.value
  const deltaY = event.clientY - startY.value
  translateX.value = dragStartTranslateX.value + deltaX
  translateY.value = dragStartTranslateY.value + deltaY
}

function stopDrag() {
  isDragging.value = false
}

// Keyboard shortcuts
onMounted(() => {
  const handleKeydown = (e: KeyboardEvent) => {
    if (!props.isOpen) return
    if (e.key === 'Escape') close()
    if (e.key === '+' || e.key === '=') zoomIn()
    if (e.key === '-') zoomOut()
    if (e.key === '0') resetZoom()
  }
  window.addEventListener('keydown', handleKeydown)
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
})

// Reset zoom when opening
watch(
  () => props.isOpen,
  open => {
    if (open) resetZoom()
  }
)
</script>
