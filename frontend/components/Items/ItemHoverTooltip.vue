<template>
  <div
    v-if="item && tooltipsEnabled"
    ref="tooltipEl"
    class="item-hover-tooltip pointer-events-none fixed z-50 rounded-lg border border-accent bg-background shadow-lg"
    :style="tooltipStyle"
  >
    <div class="item-hover-tooltip__content">
      <div class="item-hover-tooltip__header">
        <img
          :src="getItemShopImageUrl(version, item)"
          :alt="item.name"
          class="item-hover-tooltip__image"
        />
        <div class="item-hover-tooltip__text">
          <div class="item-hover-tooltip__name">{{ item.name }}</div>
          <div class="item-hover-tooltip__price">{{ item.gold?.total || 0 }}</div>
          <div class="item-hover-tooltip__meta">
            <span class="item-hover-tooltip__meta-key">{{ t('stats.labels.goldValue') }}:</span>
            <span class="item-hover-tooltip__meta-value">{{ getItemGoldValue(item) }}</span>
          </div>
          <div class="item-hover-tooltip__meta">
            <span class="item-hover-tooltip__meta-key"
              >{{ t('stats.labels.goldEfficiency') }}:</span
            >
            <span class="item-hover-tooltip__meta-value">{{ formatItemGoldEfficiency(item) }}</span>
          </div>
        </div>
      </div>
      <div v-if="plaintext" class="item-hover-tooltip__plaintext">{{ plaintext }}</div>
      <hr v-if="plaintext && formattedDescription" class="item-hover-tooltip__separator" />
      <!-- eslint-disable vue/no-v-html -->
      <div
        v-if="formattedDescription"
        class="item-hover-tooltip__description tooltip-game-description"
        v-html="formattedDescription"
      />
      <!-- eslint-enable vue/no-v-html -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Item } from '~/types/build'
import { getItemShopImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'
import { formatItemTooltipHtml } from '~/utils/formatTooltipMarkupHtml'
import { resolveItemDescription, resolveItemPlaintext } from '~/utils/itemDescriptionFallbacks'
import { formatItemGoldEfficiency, getItemGoldValue } from '~/utils/formatItemStats'

const props = defineProps<{
  item: Item | null
  tooltipsEnabled: boolean
  tooltipStyle: Record<string, string>
  riotLocale: string
}>()

const tooltipRef = defineModel<HTMLElement | null>('tooltipRef', { default: null })
const tooltipEl = ref<HTMLElement | null>(null)

watch(tooltipEl, el => {
  tooltipRef.value = el
})

const { t } = useI18n()
const { version } = useGameVersion()

const plaintext = computed(() => resolveItemPlaintext(props.item, props.riotLocale))
const formattedDescription = computed(() => {
  const raw = resolveItemDescription(props.item, props.riotLocale)
  return raw ? formatItemTooltipHtml(raw) : ''
})
</script>

<style scoped>
.item-hover-tooltip {
  max-width: min(360px, calc(100vw - 1rem));
  padding: 0.75rem;
}

.item-hover-tooltip__content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.item-hover-tooltip__header {
  display: flex;
  gap: 0.65rem;
}

.item-hover-tooltip__image {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  object-fit: contain;
  border: 1px solid rgb(var(--rgb-accent) / 0.35);
  border-radius: 0.25rem;
}

.item-hover-tooltip__text {
  min-width: 0;
}

.item-hover-tooltip__name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-accent);
  line-height: 1.2;
}

.item-hover-tooltip__price {
  margin-top: 0.15rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: rgb(var(--rgb-primary-light));
}

.item-hover-tooltip__meta {
  margin-top: 0.15rem;
  font-size: 0.75rem;
  color: rgb(var(--rgb-text) / 0.75);
}

.item-hover-tooltip__meta-key {
  margin-right: 0.25rem;
}

.item-hover-tooltip__meta-value {
  font-weight: 600;
  color: rgb(var(--rgb-primary-light));
}

.item-hover-tooltip__plaintext {
  font-size: 0.8rem;
  font-style: italic;
  color: rgb(var(--rgb-text) / 0.75);
}

.item-hover-tooltip__separator {
  margin: 0;
  border: none;
  border-top: 1px solid rgb(var(--rgb-accent) / 0.25);
}

.item-hover-tooltip__description {
  font-size: 0.8rem;
  line-height: 1.45;
  color: rgb(var(--rgb-text) / 0.85);
}
</style>
