<template>
  <article
    class="champion-spell-order-card flex flex-col rounded-lg border border-primary/25 bg-background/35 p-2.5"
  >
    <div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
      <span class="text-text/55">{{ t('statisticsPage.winrate') }}</span>
      <span class="font-semibold tabular-nums text-accent">{{ row.winrate.toFixed(1) }}%</span>
      <span class="text-text/35">·</span>
      <span class="text-text/55">{{ t('statisticsPage.pickrate') }}</span>
      <span class="font-semibold tabular-nums text-primary">{{ row.pickrate.toFixed(1) }}%</span>
      <span class="ml-auto tabular-nums text-text/45">
        {{ t('statisticsPage.championSpellOrderGames', { count: row.games }) }}
      </span>
    </div>

    <div
      class="champion-spell-order-levels grid w-full gap-px"
      :style="{ gridTemplateColumns: `repeat(${displayLevels.length}, minmax(0, 1fr))` }"
    >
      <div
        v-for="level in displayLevels"
        :key="'lvl-' + level"
        class="flex min-w-0 flex-col items-center gap-px"
      >
        <span class="text-[8px] font-medium leading-none text-text/40">{{ level }}</span>
        <div
          class="champion-spell-order-cell flex aspect-square w-full items-center justify-center rounded-sm border text-[9px] font-bold leading-none"
          :class="cellClass(skillAt(level))"
          :title="skillTitle(skillAt(level))"
        >
          <img
            v-if="skillAt(level) && skillIconUrl(skillAt(level)!)"
            :src="skillIconUrl(skillAt(level)!)"
            :alt="skillTitle(skillAt(level))"
            class="h-full w-full rounded-sm object-cover"
          />
          <span v-else-if="skillAt(level)" class="select-none">{{
            skillDisplayKey(skillAt(level)!)
          }}</span>
        </div>
      </div>
    </div>

    <p v-if="row.extrapolated" class="mt-1.5 text-[10px] leading-snug text-text/45">
      {{ extrapolatedHint }}
    </p>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getChampionSpellImageUrl } from '~/utils/imageUrl'
import type { ChampionSpellOrderRowMerged } from '~/utils/championSpellOrderMerge'

type SkillKey = 'Q' | 'W' | 'E' | 'R'

const props = defineProps<{
  row: ChampionSpellOrderRowMerged
  championId: number
  gameVersion: string
  spells?: Array<{ name?: string; image?: { full?: string } }>
  /** Conservé pour compat parent ; style carte unifié (DA site). */
  accent?: 'emerald' | 'rose' | 'sky' | 'amber'
}>()

const { t } = useI18n()

const displayLevels = computed(() => {
  const n = Math.min(18, props.row.displayOrder.length)
  return Array.from({ length: n }, (_, i) => i + 1)
})

const extrapolatedHint = computed(() => {
  if (props.row.mergedFromPartial > 0 && props.row.mergedFromPartial < props.row.games) {
    return t('statisticsPage.championSpellOrderExtrapolatedPartial', {
      level: props.row.sourceMaxLevels,
      partial: props.row.mergedFromPartial,
    })
  }
  return t('statisticsPage.championSpellOrderExtrapolated', {
    level: props.row.sourceMaxLevels,
  })
})

function skillFromValue(v: number): SkillKey | null {
  if (v === 1) return 'Q'
  if (v === 2) return 'W'
  if (v === 3) return 'E'
  if (v === 4) return 'R'
  return null
}

function skillAt(level: number): SkillKey | null {
  const raw = props.row.displayOrder[level - 1]
  return skillFromValue(Number(raw))
}

function skillIndex(key: SkillKey): number {
  if (key === 'Q') return 0
  if (key === 'W') return 1
  if (key === 'E') return 2
  return 3
}

function skillDisplayKey(key: SkillKey): string {
  return t(`skills.key.${key}`)
}

function skillTitle(key: SkillKey | null): string {
  if (!key) return ''
  const spell = props.spells?.[skillIndex(key)]
  return spell?.name ?? key
}

function skillIconUrl(key: SkillKey | null): string | null {
  if (!key || props.championId <= 0) return null
  const file = props.spells?.[skillIndex(key)]?.image?.full
  if (!file || !props.gameVersion) return null
  return getChampionSpellImageUrl(props.gameVersion, String(props.championId), file)
}

function cellClass(key: SkillKey | null): string {
  if (!key) return 'champion-spell-order-cell--empty'
  return `champion-spell-order-cell--${key.toLowerCase()}`
}
</script>

<style scoped>
.champion-spell-order-cell--empty {
  border-color: rgb(var(--rgb-primary) / 0.12);
  background: rgb(var(--rgb-primary) / 0.04);
  color: transparent;
}

.champion-spell-order-cell--q {
  border-color: rgb(var(--rgb-primary) / 0.45);
  background: rgb(var(--rgb-primary) / 0.18);
  color: rgb(var(--rgb-primary-light) / 1);
}

.champion-spell-order-cell--w {
  border-color: rgb(var(--rgb-primary-dark) / 0.5);
  background: rgb(var(--rgb-primary-dark) / 0.22);
  color: rgb(var(--rgb-primary-light) / 1);
}

.champion-spell-order-cell--e {
  border-color: rgb(var(--rgb-primary-light) / 0.35);
  background: rgb(var(--rgb-primary) / 0.12);
  color: rgb(var(--rgb-primary-light) / 0.95);
}

.champion-spell-order-cell--r {
  border-color: rgb(var(--rgb-accent) / 0.55);
  background: rgb(var(--rgb-accent) / 0.2);
  color: rgb(var(--rgb-accent) / 1);
}
</style>
