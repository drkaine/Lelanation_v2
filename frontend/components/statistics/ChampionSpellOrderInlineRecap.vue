<template>
  <div class="champion-spell-order-inline-recap space-y-2 border-b border-primary/15 pb-2.5">
    <div v-if="firstThree.length === 3" class="flex items-start gap-2">
      <span
        class="w-[5.5rem] shrink-0 pt-0.5 text-[9px] font-semibold uppercase tracking-wide text-text/50"
      >
        {{ t('statisticsPage.championSpellOrderRecapFirstThree') }}
      </span>
      <div class="flex min-w-0 flex-wrap items-center gap-1">
        <template v-for="(skill, si) in firstThree" :key="'f3-' + si">
          <ChampionSpellIconBadge
            :skill-key="skill"
            :image-url="skillIconUrl(skill)"
            :label="skillLabel(skill)"
            size="sm"
          />
          <span
            v-if="si < 2"
            class="px-0.5 text-[10px] font-bold leading-none text-text/40"
            aria-hidden="true"
            >›</span
          >
        </template>
      </div>
    </div>

    <div v-if="maxOrder.length" class="flex items-center gap-2">
      <span
        class="w-[5.5rem] shrink-0 text-[9px] font-semibold uppercase tracking-wide text-text/50"
      >
        {{ t('statisticsPage.championSpellOrderRecapMaxOrder') }}
      </span>
      <div class="flex min-w-0 flex-wrap items-center gap-1">
        <template v-for="(skill, si) in maxOrder" :key="'max-' + si">
          <ChampionSpellIconBadge
            :skill-key="skill"
            :image-url="skillIconUrl(skill)"
            :label="skillLabel(skill)"
            size="sm"
          />
          <span
            v-if="si < maxOrder.length - 1"
            class="px-0.5 text-[10px] font-bold leading-none text-text/40"
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
import { resolveChampionSpellImageUrl } from '~/utils/imageUrl'
import ChampionSpellIconBadge from '~/components/statistics/ChampionSpellIconBadge.vue'
import type { SpellOrderSkillKey } from '~/utils/championSpellOrderMerge'

const props = defineProps<{
  firstThree: SpellOrderSkillKey[]
  maxOrder: SpellOrderSkillKey[]
  championId: number
  championSlug?: string
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
  if (props.championId <= 0 || !props.gameVersion) return null
  const slug = (props.championSlug ?? '').trim()
  const file = props.spells?.[skillIndex(key)]?.image?.full
  if (file) {
    return (
      resolveChampionSpellImageUrl(
        props.gameVersion,
        {
          slug,
          numericId: props.championId,
        },
        file
      ) || null
    )
  }
  if (!slug) return null
  return resolveChampionSpellImageUrl(props.gameVersion, { slug }, `${slug}${key}.png`) || null
}
</script>
