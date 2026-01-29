<template>
  <Transition name="toast">
    <div
      v-if="show"
      :class="[
        'fixed right-4 top-4 z-50 flex items-center gap-3 rounded-lg border-2 px-6 py-4 shadow-lg',
        type === 'success' ? 'border-success bg-success/20 text-success' : '',
        type === 'error' ? 'border-error bg-error/20 text-error' : '',
        type === 'warning' ? 'border-warning bg-warning/20 text-warning' : '',
        type === 'info' ? 'border-info bg-info/20 text-info' : '',
      ]"
      role="alert"
    >
      <div class="flex items-center gap-3">
        <span v-if="type === 'success'" class="text-2xl">✓</span>
        <span v-if="type === 'error'" class="text-2xl">✗</span>
        <span v-if="type === 'warning'" class="text-2xl">⚠</span>
        <span v-if="type === 'info'" class="text-2xl">ℹ</span>
        <p class="font-semibold">{{ message }}</p>
      </div>
      <button
        class="ml-4 text-lg opacity-70 transition-opacity hover:opacity-100"
        aria-label="Fermer"
        @click="close"
      >
        ×
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

interface Props {
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

const props = withDefaults(defineProps<Props>(), {
  type: 'success',
  duration: 3000,
})

const emit = defineEmits<{
  close: []
}>()

const show = ref(false)
let timeoutId: ReturnType<typeof setTimeout> | null = null

const close = () => {
  show.value = false
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
  setTimeout(() => emit('close'), 300) // Wait for transition
}

onMounted(() => {
  show.value = true
  if (props.duration > 0) {
    timeoutId = setTimeout(close, props.duration)
  }
})

watch(
  () => props.message,
  () => {
    show.value = true
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    if (props.duration > 0) {
      timeoutId = setTimeout(close, props.duration)
    }
  }
)
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
