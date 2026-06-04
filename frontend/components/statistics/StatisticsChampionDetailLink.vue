<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { useI18n } from 'vue-i18n'
import { navigateTo } from '#app'
import { useLocalePath } from '#i18n'
import { championStatsDetailPathIfValid } from '~/utils/championStatsRoutes'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    championId: number
    /** Empêche la propagation (lignes cliquables, boutons voisins). */
    stopPropagation?: boolean
    /** Libellé accessibilité ; défaut = i18n championStatsOpenDetail. */
    ariaLabel?: string
  }>(),
  { stopPropagation: true, ariaLabel: undefined }
)

const attrs = useAttrs()
const localePath = useLocalePath()
const { t } = useI18n()

const to = computed(() => championStatsDetailPathIfValid(props.championId, localePath))

const linkAriaLabel = computed(() => props.ariaLabel ?? t('statisticsPage.championStatsOpenDetail'))

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
    class="statistics-champion-detail-link"
    :class="attrs.class"
    @click="handleClick"
  >
    <slot />
  </a>
  <span v-else class="statistics-champion-detail-link-fallback" :class="attrs.class">
    <slot />
  </span>
</template>
