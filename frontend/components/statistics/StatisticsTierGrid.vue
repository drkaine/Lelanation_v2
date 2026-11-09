<template>
  <div class="statistics-overview-surface space-y-3 rounded-lg border border-primary/30 p-3">
    <div v-if="distribution.length" class="stg-dist">
      <div class="stg-dist-head">
        <span class="font-semibold">{{ t('statisticsPage.tierGridDistribution') }}</span>
        <span class="text-xs text-text/60">{{ t('statisticsPage.tierGridDistributionHint') }}</span>
      </div>
      <div class="stg-dist-bar" role="img" :aria-label="distributionAria">
        <div
          v-for="d in distribution"
          :key="d.tier"
          class="stg-dist-seg"
          :class="tierTokenClass(d.tier)"
          :style="{ flexGrow: d.count }"
        >
          {{ d.tier }}
        </div>
      </div>
      <div class="stg-dist-counts" aria-hidden="true">
        <span v-for="d in distribution" :key="d.tier" :style="{ flexGrow: d.count }">
          {{ d.count }}
        </span>
      </div>
    </div>

    <section
      v-for="group in groups"
      :key="group.tier"
      class="stg-tier"
      :class="tierTokenClass(group.tier)"
    >
      <h3 class="stg-label">
        <span>{{ group.tier }}</span>
        <span class="stg-count">{{ group.rows.length }}</span>
      </h3>
      <div class="stg-tiles">
        <NuxtLink
          v-for="row in shown(group).rows"
          :key="row.championId"
          :to="championStatsDetailPath(row.championId, localePath, championsStore.champions)"
          class="stg-tile"
          :title="`${championLabel(row.championId)} · WR ${percent(row.winrate)} · Pick ${percent(row.pickrate)}`"
        >
          <span class="stg-portrait">
            <img
              v-if="championImage(row.championId)"
              :src="championImage(row.championId)"
              :alt="championLabel(row.championId)"
              width="56"
              height="56"
              loading="lazy"
            />
          </span>
          <span class="stg-name">{{ championLabel(row.championId) }}</span>
          <span class="stg-wr" :class="`wr-${winrateTone(row.winrate)}`">
            {{ percent(row.winrate) }}
          </span>
          <span class="stg-pr"
            >{{ t('statisticsPage.tierGridPick') }} {{ percent(row.pickrate) }}</span
          >
        </NuxtLink>
        <button
          v-if="shown(group).hidden > 0"
          type="button"
          class="stg-more"
          @click="expanded[group.tier] = true"
        >
          {{ t('statisticsPage.tierGridMore', { count: shown(group).hidden }) }}
        </button>
        <button
          v-else-if="expanded[group.tier] && group.rows.length > TILE_LIMIT"
          type="button"
          class="stg-more"
          @click="expanded[group.tier] = false"
        >
          {{ t('statisticsPage.tierGridLess') }}
        </button>
      </div>
    </section>
    <p class="text-xs text-text/60">{{ t('statisticsPage.tierGridLegend') }}</p>
  </div>
</template>

<script setup lang="ts">
import { useChampionsStore } from '~/stores/ChampionsStore'
import { championStatsDetailPath } from '~/utils/championStatsRoutes'
import { getChampionImageUrl } from '~/utils/imageUrl'
import {
  tierTokenClass,
  type TierGridGroup,
  type TierGridRow,
} from '~/utils/statistics/tierListGrid'
import { tierDistribution, visibleTierRows, winrateTone } from '~/utils/statistics/tierGridDisplay'

type GridRow = TierGridRow & { winrate: number; pickrate: number }

const props = defineProps<{ groups: TierGridGroup<GridRow>[] }>()

/** Tuiles affichées par tier avant « + N autres ». */
const TILE_LIMIT = 20

const { t } = useI18n()
const expanded = reactive<Record<string, boolean>>({})
const distribution = computed(() => tierDistribution(props.groups))
const distributionAria = computed(() =>
  t('statisticsPage.tierGridDistributionAria', {
    list: distribution.value.map(d => `${d.tier} ${d.count}`).join(', '),
  })
)
function shown(group: TierGridGroup<GridRow>) {
  return visibleTierRows(group.rows, TILE_LIMIT, Boolean(expanded[group.tier]))
}

const localePath = useLocalePath()
const championsStore = useChampionsStore()

function champion(id: number) {
  return championsStore.champions.find(c => Number(c.key) === id) ?? null
}
function championLabel(id: number): string {
  return champion(id)?.name ?? `#${id}`
}
function championImage(id: number): string {
  const full = champion(id)?.image?.full
  return full ? getChampionImageUrl('latest', full) : ''
}
/** Ratio 0–1 → « 52.3% ». */
function percent(ratio: number): string {
  return Number.isFinite(ratio) ? `${(ratio * 100).toFixed(1)}%` : '—'
}
</script>

<style scoped>
.stg-dist {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--color-gold-500);
  border-radius: 0.75rem;
  background: var(--color-blue-600);
}

.stg-dist-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.stg-dist-bar,
.stg-dist-counts {
  display: flex;
  gap: 2px;
}

.stg-dist-bar {
  height: 1.75rem;
  overflow: hidden;
  border-radius: 0.375rem;
}

.stg-dist-seg {
  display: grid;
  min-width: 1.4rem;
  flex-basis: 0;
  place-items: center;
  background: var(--tier-color);
  color: var(--color-grey-500);
  font-size: 0.75rem;
  font-weight: 700;
}

.stg-dist-counts span {
  min-width: 1.4rem;
  flex-basis: 0;
  color: var(--color-grey-50);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.stg-tier {
  --tier-color: var(--color-tier-badge-d);
  display: grid;
  overflow: hidden;
  border: 1px solid var(--color-gold-500);
  border-radius: 0.75rem;
  background: var(--color-blue-600);
  grid-template-columns: 4.5rem 1fr;
}

.stg-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  margin: 0;
  background: var(--tier-color);
  color: var(--color-grey-500);
  font-family: 'Barlow Condensed', var(--font-heading, sans-serif);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
}

.stg-count {
  font-family: inherit;
  font-size: 0.7rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.stg-tiles {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
}

.stg-more {
  height: 2.75rem;
  padding: 0 1rem;
  border: 1px dashed var(--color-gold-400);
  border-radius: 0.625rem;
  background: transparent;
  color: var(--color-gold-100);
  font-weight: 600;
}

@media (max-width: 640px) {
  .stg-tier {
    grid-template-columns: 3rem 1fr;
  }

  .stg-label {
    font-size: 1.5rem;
  }

  .stg-tiles {
    padding: 0.625rem;
  }
}

.stg-tile {
  display: flex;
  width: 4.5rem;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  color: var(--color-text);
  text-align: center;
  transition: transform 0.15s;
}

.stg-tile:hover {
  transform: translateY(-2px);
}

.stg-portrait {
  display: block;
  width: 3.25rem;
  height: 3.25rem;
  overflow: hidden;
  border: 2px solid var(--tier-color);
  border-radius: 0.6rem;
  background: var(--color-blue-600);
}

.stg-tile:hover .stg-portrait {
  box-shadow: 0 0 12px var(--tier-color);
}

.stg-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.stg-name {
  width: 100%;
  overflow: hidden;
  font-size: 0.7rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-gold-300);
}

.stg-pr {
  color: var(--color-grey-50);
  font-size: 0.7rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.stg-wr {
  color: var(--color-grey-50);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
}

.stg-wr.wr-high {
  color: var(--color-blue-100);
}

.stg-wr.wr-low {
  color: #e2665a;
}

.tier-s-plus {
  --tier-color: var(--color-tier-badge-s-plus);
}

.tier-s {
  --tier-color: var(--color-tier-badge-s);
}

.tier-a {
  --tier-color: var(--color-tier-badge-a);
}

.tier-b {
  --tier-color: var(--color-tier-badge-b);
}

.tier-c {
  --tier-color: var(--color-tier-badge-c);
}

.tier-d {
  --tier-color: var(--color-tier-badge-d);
}
</style>
