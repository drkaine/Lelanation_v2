<template>
  <div v-if="config" class="theorycraft-item-stack" @click.stop>
    <input
      type="number"
      min="0"
      :max="config.maxStacks"
      class="theorycraft-item-stack__input"
      :value="stacks"
      :title="t('theorycraft.items.stacksInput')"
      @input="onInput"
    />
    <button
      v-if="config.supportsTransform"
      type="button"
      class="theorycraft-item-stack__full"
      :class="{ 'theorycraft-item-stack__full--active': isFullStack }"
      :title="t('theorycraft.items.fullStack')"
      @click="setFullStack"
    >
      {{ t('theorycraft.items.fullStackShort') }}
    </button>
    <button
      v-if="config.supportsTransform"
      type="button"
      class="theorycraft-item-stack__transform"
      :class="{ 'theorycraft-item-stack__transform--active': transformed }"
      :title="t('theorycraft.items.transformToggle')"
      @click="buildStore.toggleTheorycraftItemTransformed(index)"
    >
      {{ t('theorycraft.items.transformShort') }}
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

const transformed = computed(() => Boolean(buildStore.theorycraftItemTransformed[props.index]))

const isFullStack = computed(() => {
  if (!config.value?.supportsTransform) return false
  const threshold = config.value.transformThreshold ?? config.value.maxStacks
  return stacks.value >= threshold && transformed.value
})

function onInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  buildStore.setTheorycraftItemStacks(props.index, value)
}

function setFullStack() {
  if (!config.value) return
  if (isFullStack.value) {
    buildStore.setTheorycraftItemStacks(props.index, 0)
    buildStore.setTheorycraftItemTransformed(props.index, false)
    return
  }
  const threshold = config.value.transformThreshold ?? config.value.maxStacks
  buildStore.setTheorycraftItemStacks(props.index, threshold)
  buildStore.setTheorycraftItemTransformed(props.index, true)
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
  width: 2em;
  min-width: 1.125rem;
  height: 1.2em;
  border-radius: 0.2em;
  border: 1px solid rgb(200 155 60 / 0.45);
  background: rgb(10 20 40 / 0.95);
  padding: 0 0.125em;
  font-size: inherit;
  font-weight: 600;
  line-height: 1;
  color: rgb(255 255 255 / 0.9);
  text-align: center;
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

.theorycraft-item-stack__transform {
  border-radius: 0.25rem;
  border: 1px solid rgb(200 155 60 / 0.35);
  background: transparent;
  padding: 0 0.25rem;
  font-size: 0.55rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: rgb(255 255 255 / 0.65);
  line-height: 1.2;
}

.theorycraft-item-stack__transform--active {
  border-color: var(--color-accent, #c89b3c);
  color: var(--color-accent, #c89b3c);
  background: rgb(200 155 60 / 0.12);
}
</style>
