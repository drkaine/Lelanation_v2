<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black p-4"
    @click="$emit('close')"
  >
    <div class="w-full max-w-lg rounded-lg bg-surface p-6" @click.stop>
      <div class="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 class="text-lg font-bold text-text">Partager ce build</h3>
          <p class="mt-1 text-sm text-text/70">Lien public (sans authentification).</p>
        </div>
        <button class="text-text/70 hover:text-text" aria-label="Fermer" @click="$emit('close')">
          ✕
        </button>
      </div>

      <div class="mb-3">
        <label class="mb-2 block text-xs font-semibold text-text/70">Lien</label>
        <div class="flex gap-2">
          <input
            :value="shareUrl"
            readonly
            class="w-full rounded border border-primary bg-surface px-3 py-2 text-sm text-text"
          />
          <button
            class="rounded bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            @click="copy"
          >
            Copier
          </button>
        </div>
        <p v-if="copied" class="mt-2 text-sm text-success">Lien copié.</p>
      </div>

      <div class="flex justify-end gap-2">
        <button
          class="rounded border border-primary bg-surface px-4 py-2 text-sm text-text hover:bg-primary hover:text-white"
          @click="$emit('close')"
        >
          Fermer
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  shareUrl: string
}>()

defineEmits<{
  (e: 'close'): void
}>()

const copied = ref(false)

const copy = async () => {
  try {
    await navigator.clipboard.writeText(props.shareUrl)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    // fallback: do nothing
  }
}
</script>
