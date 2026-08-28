<template>
  <AppModal
    :open="true"
    size="md"
    title="Partager ce build"
    subtitle="Lien public (sans authentification)."
    close-label="Fermer"
    @close="$emit('close')"
  >
    <div class="mb-1">
      <label class="mb-2 block text-xs font-semibold uppercase tracking-wide text-text/70"
        >Lien</label
      >
      <div class="flex gap-2">
        <input
          :value="shareUrl"
          readonly
          class="w-full rounded-lg border border-primary/40 bg-background/60 px-3 py-2 text-sm text-text"
        />
        <button
          type="button"
          class="ui-build-card-button shrink-0 rounded-lg px-4 py-2 text-sm font-semibold"
          @click="copy"
        >
          Copier
        </button>
      </div>
      <p v-if="copied" class="mt-2 text-sm text-success">Lien copié.</p>
    </div>

    <template #footer>
      <button
        type="button"
        class="ui-build-card-button rounded-lg px-4 py-2 text-sm"
        @click="$emit('close')"
      >
        Fermer
      </button>
    </template>
  </AppModal>
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
