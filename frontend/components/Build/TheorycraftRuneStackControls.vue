<template>
  <div v-if="config" class="theorycraft-rune-stack" @click.stop>
    <span class="theorycraft-rune-stack__label">{{ label }}</span>
    <input
      type="number"
      min="0"
      :max="config.maxStacks"
      class="theorycraft-rune-stack__input"
      :size="stackInputSize"
      :value="stacks"
      :title="t('theorycraft.runes.stacksInput')"
      @input="onInput"
    />
    <button
      type="button"
      class="theorycraft-rune-stack__full"
      :class="{ 'theorycraft-rune-stack__full--active': isFullStack }"
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
import { getTheorycraftStackableRuneConfig } from '~/utils/theorycraftRuneModifiers'

const props = defineProps<{
  runeId: number
  label?: string
}>()

const { t } = useI18n()
const buildStore = useBuildStore()

const config = computed(() => getTheorycraftStackableRuneConfig(props.runeId))

const label = computed(
  () => props.label ?? (config.value ? t(config.value.labelKey) : String(props.runeId))
)

const stacks = computed(() => buildStore.theorycraftRuneStacks[props.runeId] ?? 0)

const stackInputSize = computed(() => {
  const maxLen = String(config.value?.maxStacks ?? 0).length
  const valueLen = String(stacks.value || 0).length
  return Math.max(2, maxLen, valueLen) + 1
})

const fullStackTitle = computed(() =>
  t('theorycraft.runes.fullStack', { max: config.value?.maxStacks ?? 0 })
)

const isFullStack = computed(
  () => stacks.value >= (config.value?.maxStacks ?? 0) && (config.value?.maxStacks ?? 0) > 0
)

function onInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  buildStore.setTheorycraftRuneStacks(props.runeId, value)
}

function setFullStack() {
  if (!config.value) return
  if (isFullStack.value) {
    buildStore.setTheorycraftRuneStacks(props.runeId, 0)
    return
  }
  buildStore.setTheorycraftRuneStacks(props.runeId, config.value.maxStacks)
}
</script>

<style scoped>
.theorycraft-rune-stack {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
}

.theorycraft-rune-stack__label {
  font-weight: 600;
  color: rgb(255 255 255 / 0.85);
  min-width: 0;
}

.theorycraft-rune-stack__input {
  box-sizing: border-box;
  width: auto;
  min-width: 2ch;
  height: 1.4em;
  border-radius: 0.2em;
  border: 1px solid rgb(200 155 60 / 0.45);
  background: rgb(10 20 40 / 0.95);
  padding: 0 0.35em;
  font-size: inherit;
  font-weight: 600;
  color: rgb(255 255 255 / 0.9);
  text-align: center;
}

.theorycraft-rune-stack__full {
  border-radius: 0.25rem;
  border: 1px solid rgb(200 155 60 / 0.35);
  background: transparent;
  padding: 0 0.35rem;
  font-size: 0.55rem;
  font-weight: 700;
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.65);
}

.theorycraft-rune-stack__full--active {
  border-color: var(--color-accent, #c89b3c);
  color: var(--color-accent, #c89b3c);
  background: rgb(200 155 60 / 0.12);
}
</style>
