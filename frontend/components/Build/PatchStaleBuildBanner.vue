<template>
  <div
    v-if="show"
    class="mb-6 rounded-lg border-2 border-amber-500/60 bg-amber-500/10 p-4 text-text"
    role="status"
  >
    <div class="flex flex-col justify-between gap-3 md:flex-row md:items-center">
      <div>
        <p class="font-semibold text-amber-400">{{ t('buildsPage.patchStale.bannerTitle') }}</p>
        <p class="mt-1 text-sm text-text/80">
          {{ t('buildsPage.patchStale.bannerDescription', { version: patchStale.patchVersion }) }}
        </p>
        <p v-if="categoryLabel" class="mt-1 text-xs text-text/60">
          {{ categoryLabel }}
        </p>
      </div>

      <button
        class="rounded-lg border border-amber-500/60 bg-surface px-4 py-2 text-sm text-text transition-colors hover:bg-amber-500/10"
        @click="dismiss"
      >
        {{ t('buildsPage.patchStale.dismiss') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PatchStaleInfo } from '@lelanation/shared-types'

const props = defineProps<{
  patchStale?: PatchStaleInfo | null
  storageKey: string
}>()

const { t } = useI18n()
const dismissed = ref(false)

const show = computed(() => Boolean(props.patchStale) && !dismissed.value)

const categoryLabel = computed(() => {
  if (!props.patchStale?.categories?.length) return ''
  const labels = props.patchStale.categories.map(category =>
    t(`buildsPage.patchStale.categories.${category}`)
  )
  return labels.join(' · ')
})

const dismiss = () => {
  dismissed.value = true
  try {
    localStorage.setItem(`dismiss:${props.storageKey}`, '1')
  } catch {
    // ignore
  }
}

onMounted(() => {
  try {
    dismissed.value = localStorage.getItem(`dismiss:${props.storageKey}`) === '1'
  } catch {
    dismissed.value = false
  }
})
</script>
