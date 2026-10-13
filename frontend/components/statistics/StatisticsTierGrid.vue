<template>
  <div class="statistics-overview-surface space-y-3 rounded-lg border border-primary/30 p-3">
    <section
      v-for="group in groups"
      :key="group.tier"
      class="stg-tier"
      :class="tierTokenClass(group.tier)"
    >
      <h3 class="stg-label">{{ group.tier }}</h3>
      <div class="stg-tiles">
        <NuxtLink
          v-for="row in group.rows"
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
          <span class="stg-wr">{{ percent(row.winrate) }}</span>
        </NuxtLink>
      </div>
    </section>
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

type GridRow = TierGridRow & { winrate: number; pickrate: number }

defineProps<{ groups: TierGridGroup<GridRow>[] }>()

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
.stg-tier {
  --tier-color: var(--color-tier-badge-d);
  display: flex;
  gap: 0.75rem;
  align-items: stretch;
}

.stg-label {
  display: flex;
  flex: 0 0 3rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  background: var(--tier-color);
  color: var(--color-background);
  font-size: 1.25rem;
  font-weight: 800;
}

.stg-tiles {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 0.5rem;
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
}

.stg-wr {
  color: var(--color-text-accent);
  font-size: 0.65rem;
  opacity: 0.85;
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
