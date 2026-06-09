<template>
  <span
    v-if="patchStale"
    class="inline-flex shrink-0 items-center rounded border border-red-500/60 bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-red-400"
    :title="badgeTitle"
  >
    {{ t('buildsPage.patchStale.badge') }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PatchStaleInfo } from '@lelanation/shared-types'

const props = defineProps<{
  patchStale?: PatchStaleInfo | null
}>()

const { t } = useI18n()

const badgeTitle = computed(() => {
  if (!props.patchStale) return ''
  return t('buildsPage.patchStale.badgeTitle', { version: props.patchStale.patchVersion })
})
</script>
