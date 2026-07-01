<template>
  <article
    class="champion-spell-order-card flex h-full w-full min-w-0 flex-col rounded-lg border border-primary/25 bg-background/35 p-2.5 transition-colors"
    :class="[
      canExpandLevels ? 'cursor-pointer touch-manipulation hover:border-primary/40' : '',
      levelsExpanded ? 'border-accent/35 bg-background/45' : '',
    ]"
    :role="canExpandLevels ? 'button' : undefined"
    :tabindex="canExpandLevels ? 0 : undefined"
    :aria-expanded="canExpandLevels ? levelsExpanded : undefined"
    :aria-label="
      canExpandLevels
        ? levelsExpanded
          ? t('statisticsPage.championSpellOrderHideLevelDetail')
          : t('statisticsPage.championSpellOrderShowLevelDetail')
        : undefined
    "
    @click="toggleLevels"
    @keydown.enter.prevent="toggleLevels"
    @keydown.space.prevent="toggleLevels"
  >
    <div class="mb-2.5 grid grid-cols-2 gap-2">
      <div class="rounded-md bg-black/25 px-2 py-1.5">
        <div class="text-[9px] font-semibold uppercase tracking-wide text-text/50">
          {{ t('statisticsPage.winrate') }}
        </div>
        <div class="text-lg font-bold tabular-nums leading-tight text-accent">
          {{ row.winrate.toFixed(1) }}%
        </div>
      </div>
      <div class="rounded-md bg-info/15 px-2 py-1.5 ring-1 ring-info/35">
        <div class="text-[9px] font-semibold uppercase tracking-wide text-primary-light/70">
          {{ t('statisticsPage.pickrate') }}
        </div>
        <div class="text-lg font-bold tabular-nums leading-tight text-primary-light">
          {{ row.pickrate.toFixed(1) }}%
        </div>
        <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/35" role="presentation">
          <div
            class="h-full rounded-full bg-info/90"
            :style="{ width: `${Math.min(100, Math.max(0, row.pickrate))}%` }"
          />
        </div>
      </div>
    </div>

    <ChampionSpellOrderInlineRecap
      v-if="rowRecap.firstThree.length === 3 || rowRecap.maxOrder.length"
      class="mb-2"
      :first-three="rowRecap.firstThree"
      :max-order="rowRecap.maxOrder"
      :champion-id="championId"
      :champion-slug="championSlug"
      :game-version="gameVersion"
      :spells="spells"
    />

    <div class="mb-2 text-right text-[10px] tabular-nums text-text/45">
      {{ t('statisticsPage.championSpellOrderGames', { count: row.games }) }}
    </div>

    <div
      v-show="levelsExpanded"
      class="champion-spell-order-levels mb-2 grid w-full gap-px"
      :style="{ gridTemplateColumns: `repeat(${displayLevels.length}, minmax(0, 1fr))` }"
      @click.stop
    >
      <div
        v-for="level in displayLevels"
        :key="'lvl-' + level"
        class="flex min-w-0 flex-col items-center gap-px"
      >
        <span class="text-[8px] font-medium leading-none text-text/40">{{ level }}</span>
        <div
          class="champion-spell-order-cell relative flex aspect-square w-full items-center justify-center overflow-visible rounded-sm border text-[8px] font-bold leading-none"
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
          <span v-if="skillAt(level)" class="champion-spell-order-cell-key" aria-hidden="true">{{
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
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveChampionSpellImageUrl } from '~/utils/imageUrl'
import ChampionSpellOrderInlineRecap from '~/components/statistics/ChampionSpellOrderInlineRecap.vue'
import {
  spellOrderRowRecap,
  type ChampionSpellOrderRowMerged,
} from '~/utils/championSpellOrderMerge'

type SkillKey = 'Q' | 'W' | 'E' | 'R'

const props = defineProps<{
  row: ChampionSpellOrderRowMerged
  championId: number
  championSlug?: string
  gameVersion: string
  spells?: Array<{ name?: string; image?: { full?: string } }>
  /** Conservé pour compat parent ; style carte unifié (DA site). */
  accent?: 'emerald' | 'rose' | 'sky' | 'amber'
}>()

const { t } = useI18n()

const levelsExpanded = ref(false)

const rowRecap = computed(() => spellOrderRowRecap(props.row.displayOrder))

const displayLevels = computed(() => {
  const n = Math.min(18, props.row.displayOrder.length)
  return Array.from({ length: n }, (_, i) => i + 1)
})

const canExpandLevels = computed(() => displayLevels.value.length > 0)

function toggleLevels() {
  if (!canExpandLevels.value) return
  levelsExpanded.value = !levelsExpanded.value
}

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
  if (!key || props.championId <= 0 || !props.gameVersion) return null
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

.champion-spell-order-cell-key {
  position: absolute;
  right: -3px;
  bottom: -3px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 11px;
  height: 11px;
  padding: 0 1px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.9);
  color: var(--color-gold-300, #fcd34d);
  font-size: 7px;
  font-weight: 700;
  line-height: 1;
}
</style>
