<template>
  <button
    v-if="config"
    type="button"
    class="theorycraft-item-passive-toggle"
    :class="{ 'theorycraft-item-passive-toggle--active': isActive }"
    :title="toggleTitle"
    @click.stop="toggle"
  >
    {{ t('theorycraft.items.passiveActive') }}
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import { getTheorycraftActivatableItemPassiveConfig } from '~/utils/theorycraftItemPassives'

const props = defineProps<{
  index: number
  itemId: string
}>()

const { t } = useI18n()
const buildStore = useBuildStore()

const config = computed(() => getTheorycraftActivatableItemPassiveConfig(props.itemId))

const isActive = computed(() => Boolean(buildStore.theorycraftActiveItemPassives[props.index]))

const toggleTitle = computed(() => {
  if (!config.value) return ''
  const name = t(config.value.labelKey)
  return isActive.value
    ? t('theorycraft.items.passiveActiveOff', { name })
    : t('theorycraft.items.passiveActiveOn', { name })
})

function toggle() {
  buildStore.toggleTheorycraftActiveItemPassive(props.index)
}
</script>

<style scoped>
.theorycraft-item-passive-toggle {
  margin-top: 0.125rem;
  border-radius: 0.2rem;
  border: 1px solid rgb(200 155 60 / 0.35);
  background: transparent;
  padding: 0 0.25rem;
  font-size: 0.5rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: rgb(255 255 255 / 0.65);
  line-height: 1.3;
  white-space: nowrap;
}

.theorycraft-item-passive-toggle--active {
  border-color: var(--color-accent, #c89b3c);
  color: var(--color-accent, #c89b3c);
  background: rgb(200 155 60 / 0.12);
}
</style>
