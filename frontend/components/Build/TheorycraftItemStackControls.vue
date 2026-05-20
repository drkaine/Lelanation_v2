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

function onInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  buildStore.setTheorycraftItemStacks(props.index, value)
}
</script>

<style scoped>
.theorycraft-item-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  margin-top: 0.125rem;
}

.theorycraft-item-stack__input {
  width: 2.75rem;
  height: 1.25rem;
  border-radius: 0.25rem;
  border: 1px solid rgb(200 155 60 / 0.45);
  background: rgb(10 20 40 / 0.95);
  padding: 0 0.25rem;
  font-size: 0.65rem;
  font-weight: 600;
  color: rgb(255 255 255 / 0.9);
  text-align: center;
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
