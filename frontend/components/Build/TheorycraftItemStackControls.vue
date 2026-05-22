<template>
  <div v-if="config" class="theorycraft-item-stack" @click.stop>
    <input
      type="number"
      min="0"
      :max="inputMax"
      class="theorycraft-item-stack__input"
      :size="stackInputSize"
      :value="stacks"
      :title="t('theorycraft.items.stacksInput')"
      @input="onInput"
    />
    <button
      type="button"
      class="theorycraft-item-stack__full"
      :class="{ 'theorycraft-item-stack__full--active': isFullStack }"
      :title="fullStackTitle"
      @click="setFullStack"
    >
      {{ t('theorycraft.items.fullStackShort') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import { getTheorycraftStackableItemConfig } from '~/utils/theorycraftItemModifiers'

const props = defineProps<{
  index: number
  itemId: string
}>()

const { t } = useI18n()
const buildStore = useBuildStore()

const config = computed(() => getTheorycraftStackableItemConfig(props.itemId))

const stacks = computed(() => buildStore.theorycraftItemStacks[props.index] ?? 0)

const inputMax = computed(() =>
  config.value?.unlimitedStacks ? undefined : config.value?.maxStacks
)

const targetStacks = computed(() => {
  if (!config.value) return 0
  if (config.value.supportsTransform) {
    return config.value.transformThreshold ?? config.value.maxStacks ?? 0
  }
  if (config.value.unlimitedStacks) return config.value.presetStacks ?? 0
  return config.value.maxStacks ?? 0
})

const stackInputSize = computed(() => {
  const maxLen = config.value?.unlimitedStacks
    ? String(stacks.value || 0).length
    : String(config.value?.maxStacks ?? 0).length
  const valueLen = String(stacks.value || 0).length
  return Math.max(2, maxLen, valueLen) + 1
})

const fullStackTitle = computed(() => {
  if (!config.value) return ''
  if (config.value.supportsTransform) return t('theorycraft.items.fullStack')
  if (config.value.unlimitedStacks) {
    return t('theorycraft.runes.presetStack', { count: targetStacks.value })
  }
  return t('theorycraft.items.fullStackGlory', { max: config.value.maxStacks })
})

const isFullStack = computed(() => {
  if (!config.value || targetStacks.value <= 0) return false
  if (config.value.supportsTransform) {
    return (
      stacks.value >= targetStacks.value &&
      Boolean(buildStore.theorycraftItemTransformed[props.index])
    )
  }
  return stacks.value >= targetStacks.value
})

function onInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  buildStore.setTheorycraftItemStacks(props.index, value)
}

function setFullStack() {
  if (!config.value) return
  if (isFullStack.value) {
    buildStore.setTheorycraftItemStacks(props.index, 0)
    if (config.value.supportsTransform) {
      buildStore.setTheorycraftItemTransformed(props.index, false)
    }
    return
  }
  if (config.value.supportsTransform) {
    buildStore.setTheorycraftItemStacks(props.index, targetStacks.value)
    buildStore.setTheorycraftItemTransformed(props.index, true)
    return
  }
  buildStore.setTheorycraftItemStacks(props.index, targetStacks.value)
}
</script>

<style scoped>
.theorycraft-item-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  margin-top: 0.125rem;
  font-size: 0.65rem;
  line-height: 1;
}

.theorycraft-item-stack__input {
  box-sizing: border-box;
  width: auto;
  min-width: 2ch;
  max-width: 100%;
  height: 1.2em;
  border-radius: 0.2em;
  border: 1px solid rgb(200 155 60 / 0.45);
  background: rgb(10 20 40 / 0.95);
  padding: 0 0.35em;
  font-size: inherit;
  font-weight: 600;
  line-height: 1;
  color: rgb(255 255 255 / 0.9);
  text-align: center;
  field-sizing: content;
  appearance: textfield;
  -moz-appearance: textfield;
}

.theorycraft-item-stack__input::-webkit-outer-spin-button,
.theorycraft-item-stack__input::-webkit-inner-spin-button {
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
}

.theorycraft-item-stack__full {
  border-radius: 0.25rem;
  border: 1px solid rgb(200 155 60 / 0.35);
  background: transparent;
  padding: 0 0.2rem;
  font-size: 0.5rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: rgb(255 255 255 / 0.65);
  line-height: 1.2;
}

.theorycraft-item-stack__full--active {
  border-color: var(--color-accent, #c89b3c);
  color: var(--color-accent, #c89b3c);
  background: rgb(200 155 60 / 0.12);
}
</style>
