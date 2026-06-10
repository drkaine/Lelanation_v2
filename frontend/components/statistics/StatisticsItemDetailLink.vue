<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { useI18n } from 'vue-i18n'
import { navigateTo } from '#app'
import { useLocalePath } from '#i18n'
import { itemStatsDetailPathIfValid } from '~/utils/itemStatsRoutes'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    itemId: number
    stopPropagation?: boolean
    ariaLabel?: string
  }>(),
  { stopPropagation: true, ariaLabel: undefined }
)

const attrs = useAttrs()
const localePath = useLocalePath()
const { t } = useI18n()

const to = computed(() => itemStatsDetailPathIfValid(props.itemId, localePath))
const linkAriaLabel = computed(() => props.ariaLabel ?? t('statisticsPage.itemStatsOpenDetail'))

function handleClick(e: MouseEvent): void {
  const path = to.value
  if (!path) return
  if (props.stopPropagation) e.stopPropagation()
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return
  e.preventDefault()
  navigateTo(path)
}
</script>

<template>
  <a
    v-if="to"
    :href="to"
    :aria-label="linkAriaLabel"
    class="statistics-item-detail-link"
    :class="attrs.class"
    @click="handleClick"
  >
    <slot />
  </a>
  <span v-else class="statistics-item-detail-link-fallback" :class="attrs.class">
    <slot />
  </span>
</template>
