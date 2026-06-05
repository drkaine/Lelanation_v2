<template>
  <div class="champion-spell-order-inline-recap space-y-2 border-b border-primary/15 pb-2.5">
    <div v-if="firstThree.length === 3" class="flex items-center gap-2">
      <span
        class="w-[5.5rem] shrink-0 text-[9px] font-semibold uppercase tracking-wide text-text/50"
      >
        {{ t('statisticsPage.championSpellOrderRecapFirstThree') }}
      </span>
      <div class="flex items-center gap-0.5">
        <img
          v-for="(skill, si) in firstThree"
          :key="'f3-' + si"
          :src="skillIconUrl(skill) ?? undefined"
          :alt="skillLabel(skill)"
          class="h-6 w-6 rounded-sm border border-primary/30 object-cover"
          width="24"
          height="24"
        />
      </div>
    </div>
    <div v-if="maxOrder.length" class="flex items-center gap-2">
      <span
        class="w-[5.5rem] shrink-0 text-[9px] font-semibold uppercase tracking-wide text-text/50"
      >
        {{ t('statisticsPage.championSpellOrderRecapMaxOrder') }}
      </span>
      <div class="flex flex-wrap items-center gap-0.5">
        <template v-for="(skill, si) in maxOrder" :key="'max-' + si">
          <img
            v-if="skillIconUrl(skill)"
            :src="skillIconUrl(skill)!"
            :alt="skillLabel(skill)"
            class="h-6 w-6 shrink-0 rounded-sm border border-primary/30 object-cover"
            width="24"
            height="24"
          />
          <span
            v-if="si < maxOrder.length - 1"
            class="px-0.5 text-[9px] font-bold text-text/40"
            aria-hidden="true"
            >›</span
          >
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { getChampionSpellImageUrl } from '~/utils/imageUrl'
import type { SpellOrderSkillKey } from '~/utils/championSpellOrderMerge'

const props = defineProps<{
  firstThree: SpellOrderSkillKey[]
  maxOrder: SpellOrderSkillKey[]
  championId: number
  gameVersion: string
  spells?: Array<{ name?: string; image?: { full?: string } }>
}>()

const { t } = useI18n()

function skillIndex(key: SpellOrderSkillKey): number {
  if (key === 'Q') return 0
  if (key === 'W') return 1
  if (key === 'E') return 2
  return 3
}

function skillLabel(key: SpellOrderSkillKey): string {
  return props.spells?.[skillIndex(key)]?.name ?? t(`skills.key.${key}`)
}

function skillIconUrl(key: SpellOrderSkillKey): string | null {
  if (props.championId <= 0) return null
  const file = props.spells?.[skillIndex(key)]?.image?.full
  if (!file || !props.gameVersion) return null
  return getChampionSpellImageUrl(props.gameVersion, String(props.championId), file)
}
</script>
