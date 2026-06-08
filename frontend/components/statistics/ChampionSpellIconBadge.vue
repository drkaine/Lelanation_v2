<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SpellOrderSkillKey } from '~/utils/championSpellOrderMerge'

export type ChampionSpellBadgeKey = SpellOrderSkillKey | 'P'

const props = withDefaults(
  defineProps<{
    skillKey: ChampionSpellBadgeKey
    imageUrl: string | null
    label: string
    size?: 'sm' | 'md'
  }>(),
  {
    size: 'sm',
  }
)

const { t } = useI18n()

const displayKey = computed(() => t(`skills.key.${props.skillKey}`))

const boxClass = computed(() =>
  props.size === 'md'
    ? 'champion-spell-icon-badge--md h-7 w-7'
    : 'champion-spell-icon-badge--sm h-6 w-6'
)
</script>

<template>
  <span
    class="champion-spell-icon-badge relative inline-flex shrink-0 items-center justify-center overflow-visible"
    :class="boxClass"
  >
    <img
      v-if="imageUrl"
      :src="imageUrl"
      :alt="label"
      class="h-full w-full rounded-sm border border-primary/30 object-cover"
    />
    <span
      v-else
      class="inline-flex h-full w-full items-center justify-center rounded-sm border border-primary/30 bg-primary/15 text-[9px] font-bold text-text/85"
    >
      {{ displayKey }}
    </span>
    <span class="champion-spell-icon-key" aria-hidden="true">{{ displayKey }}</span>
  </span>
</template>

<style scoped>
.champion-spell-icon-key {
  position: absolute;
  right: -4px;
  bottom: -4px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 13px;
  height: 13px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.9);
  color: var(--color-gold-300, #fcd34d);
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}

.champion-spell-icon-badge--sm .champion-spell-icon-key {
  width: 12px;
  height: 12px;
  font-size: 8px;
}
</style>
