<template>
  <div
    class="inline-flex shrink-0 gap-0.5 rounded border border-primary/25 bg-surface/30 p-0.5"
    role="group"
    :aria-label="t('statisticsPage.settingsAlertsDeltaDirection')"
  >
    <button
      type="button"
      class="rounded p-1 transition"
      :class="
        modelValue.increase
          ? 'bg-info/20 text-info'
          : 'text-text/40 hover:bg-primary/10 hover:text-text/70'
      "
      :title="t('statisticsPage.settingsAlertsDeltaDirectionIncrease')"
      :aria-label="t('statisticsPage.settingsAlertsDeltaDirectionIncrease')"
      :aria-pressed="modelValue.increase"
      @click="toggle('increase')"
    >
      <Icon name="mdi:arrow-up" class="h-3.5 w-3.5" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="rounded p-1 transition"
      :class="
        modelValue.decrease
          ? 'bg-error/20 text-error/70'
          : 'text-text/40 hover:bg-primary/10 hover:text-text/70'
      "
      :title="t('statisticsPage.settingsAlertsDeltaDirectionDecrease')"
      :aria-label="t('statisticsPage.settingsAlertsDeltaDirectionDecrease')"
      :aria-pressed="modelValue.decrease"
      @click="toggle('decrease')"
    >
      <Icon name="mdi:arrow-down" class="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { DeltaDirectionFlags } from '~/utils/surveillanceDeltaDirection'
import { toggleDeltaDirectionFlag } from '~/utils/surveillanceDeltaDirection'

const props = defineProps<{
  modelValue: DeltaDirectionFlags
}>()

const emit = defineEmits<{
  'update:modelValue': [value: DeltaDirectionFlags]
}>()

const { t } = useI18n()

function toggle(key: keyof DeltaDirectionFlags): void {
  emit('update:modelValue', toggleDeltaDirectionFlag(props.modelValue, key))
}
</script>
