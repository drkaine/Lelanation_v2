<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { matchupHighlights } from '~/utils/statistics/matchupHighlights'

export type HighlightRow = {
  id: number
  name: string
  img: string
  sub?: string
  games: number
  winrate: number
}

const props = defineProps<{
  rows: HighlightRow[]
  mode: 'matchups' | 'synergy'
  minGames: number
}>()

const { t, locale } = useI18n()

const hl = computed(() => matchupHighlights(props.rows, { minGames: props.minGames, limit: 5 }))
const isSyn = computed(() => props.mode === 'synergy')

function pct(v: number | null): string {
  return v == null ? '—' : `${v.toFixed(1)} %`
}
function num(v: number): string {
  return v.toLocaleString(locale.value)
}
/** Barre centrée sur 50 % : ±10 pts = pleine largeur. */
function barWidth(wr: number): string {
  return `${Math.min(100, Math.abs(wr - 50) * 10)}%`
}
</script>

<template>
  <section v-if="rows.length" class="mh" :aria-label="t('statisticsPage.championGroupMatchups')">
    <div class="mh-kpis">
      <div class="mh-kpi">
        <span class="mh-big">{{ num(hl.count) }}</span>
        <span class="mh-kpi-l">{{
          isSyn ? t('statisticsPage.muHlAllies') : t('statisticsPage.muHlOpponents')
        }}</span>
      </div>
      <div class="mh-kpi">
        <span class="mh-big">{{ num(hl.games) }}</span>
        <span class="mh-kpi-l">{{ t('statisticsPage.muHlGames') }}</span>
      </div>
      <div class="mh-kpi">
        <span class="mh-big">{{ pct(hl.meanWinrate) }}</span>
        <span class="mh-kpi-l">{{ t('statisticsPage.muHlMeanWr') }}</span>
      </div>
      <p class="mh-note">{{ t('statisticsPage.muHlNote', { min: minGames }) }}</p>
    </div>

    <div class="mh-cols">
      <article
        v-for="col in [
          {
            key: 'best',
            list: hl.best,
            up: true,
            label: isSyn ? t('statisticsPage.muHlBestAllies') : t('statisticsPage.ovBestMatchups'),
          },
          {
            key: 'worst',
            list: hl.worst,
            up: false,
            label: isSyn
              ? t('statisticsPage.muHlWorstAllies')
              : t('statisticsPage.ovWorstMatchups'),
          },
        ]"
        :key="col.key"
        class="mh-card"
      >
        <h3 class="mh-label">{{ col.label }}</h3>
        <ul v-if="col.list.length">
          <li v-for="r in col.list" :key="col.key + r.id + (r.sub ?? '')">
            <img v-if="r.img" :src="r.img" alt="" width="32" height="32" loading="lazy" />
            <span class="mh-name">
              {{ r.name }}
              <small
                >{{ r.sub ? r.sub + ' · ' : '' }}{{ num(r.games) }}
                {{ t('statisticsPage.ovGames') }}</small
              >
            </span>
            <span class="mh-track" aria-hidden="true">
              <span :class="col.up ? 'is-up' : 'is-down'" :style="{ width: barWidth(r.winrate) }" />
            </span>
            <b :class="col.up ? 'is-up' : 'is-down'">{{ pct(r.winrate) }}</b>
          </li>
        </ul>
        <p v-else class="mh-empty">{{ t('statisticsPage.ovMatchupsEmpty') }}</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.mh {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
}
.mh-kpis {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 32px;
  padding: 18px 24px;
  border: 1px solid #463714;
  border-radius: 10px;
  background: #0a1428;
}
.mh-kpi {
  display: flex;
  flex-direction: column;
}
.mh-big {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
  color: #f0e6d2;
  font-variant-numeric: tabular-nums;
}
.mh-kpi-l,
.mh-label {
  margin: 4px 0 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #a09b8c;
}
.mh-note {
  margin: 0 0 0 auto;
  font-size: 12px;
  color: #a09b8c;
}
.mh-cols {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
@media (max-width: 767px) {
  .mh-cols {
    grid-template-columns: 1fr;
  }
  .mh-note {
    margin-left: 0;
  }
}
.mh-card {
  min-width: 0;
  padding: 18px 20px;
  border: 1px solid #463714;
  border-radius: 10px;
  background: #0a1428;
  color: #f0e6d2;
}
.mh-label {
  margin: 0 0 12px;
}
.mh-card ul {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.mh-card li {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 80px 64px;
  align-items: center;
  gap: 12px;
}
.mh-card img {
  width: 32px;
  height: 32px;
  border: 1px solid #463714;
  border-radius: 6px;
}
.mh-name {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.mh-name small {
  font-size: 11px;
  font-weight: 500;
  color: #a09b8c;
}
.mh-track {
  height: 6px;
  border-radius: 3px;
  background: rgb(240 230 210 / 0.08);
  overflow: hidden;
}
.mh-track > span {
  display: block;
  height: 100%;
  border-radius: 3px;
}
.mh-track > .is-up {
  background: #0ac8b9;
}
.mh-track > .is-down {
  background: #e84057;
}
.mh-card b {
  text-align: right;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
b.is-up {
  color: #0ac8b9;
}
b.is-down {
  color: #e84057;
}
.mh-empty {
  margin: 0;
  font-size: 13px;
  color: #a09b8c;
}
</style>
