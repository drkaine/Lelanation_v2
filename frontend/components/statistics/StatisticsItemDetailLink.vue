<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { useI18n } from 'vue-i18n'
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
  if (props.stopPropagation) e.stopPropagation()
}
</script>

<template>
  <NuxtLink
    v-if="to"
    :to="to"
    :aria-label="linkAriaLabel"
    class="statistics-item-detail-link"
    :class="attrs.class"
    @click="handleClick"
  >
    <slot />
  </NuxtLink>
  <span v-else class="statistics-item-detail-link-fallback" :class="attrs.class">
    <slot />
  </span>
</template>
