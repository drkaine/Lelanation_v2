<template>
  <div
    v-if="show"
    class="mb-6 rounded-lg border-2 border-warning bg-warning/10 p-4 text-text"
    role="status"
  >
    <div class="flex flex-col justify-between gap-3 md:flex-row md:items-center">
      <div>
        <p class="font-semibold text-warning">Build obsolète</p>
        <p class="mt-1 text-sm text-text/80">
          Version du build:
          <span class="font-semibold">{{ displayBuildVersion || 'inconnue' }}</span> · Version
          actuelle:
          <span class="font-semibold">{{ displayCurrentVersion || 'inconnue' }}</span>
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="onUpdate"
          class="rounded-lg bg-warning px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-warning/80"
          @click="onUpdate"
        >
          Mettre à jour
        </button>
        <button
          class="rounded-lg border border-warning bg-surface px-4 py-2 text-sm text-text transition-colors hover:bg-warning/10"
          @click="dismiss"
        >
          Masquer
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useVersionStore } from '~/stores/VersionStore'
import { formatBuildPatchVersion, patchFromGameVersion } from '~/utils/patchVersion'

const props = defineProps<{
  buildVersion: string
  storageKey: string
  onUpdate?: () => void
}>()

const versionStore = useVersionStore()
const dismissed = ref(false)

const currentVersion = computed(() => versionStore.currentVersion || '')
const displayBuildVersion = computed(() => formatBuildPatchVersion(props.buildVersion))
const displayCurrentVersion = computed(() => formatBuildPatchVersion(currentVersion.value))

const show = computed(() => {
  if (dismissed.value) return false
  if (!props.buildVersion || !currentVersion.value) return false
  return patchFromGameVersion(props.buildVersion) !== patchFromGameVersion(currentVersion.value)
})

const dismiss = () => {
  dismissed.value = true
  try {
    localStorage.setItem(`dismiss:${props.storageKey}`, '1')
  } catch {
    // ignore
  }
}

onMounted(async () => {
  try {
    dismissed.value = localStorage.getItem(`dismiss:${props.storageKey}`) === '1'
  } catch {
    dismissed.value = false
  }

  if (!versionStore.currentVersion) {
    await versionStore.loadCurrentVersion()
  }
})
</script>
