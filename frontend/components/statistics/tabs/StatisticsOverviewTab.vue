<script setup lang="ts">
import { computed, ref } from 'vue'
import { overviewKeyFigures } from '~/utils/statistics/overviewKeyFigures'
import { TREND_METRICS, trendRows, type TrendMetric } from '~/utils/statistics/overviewTrends'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'
import { barList, outcomeSegments, pairedBans } from '~/utils/statistics/overviewCards'

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()

const keyFigures = computed(() =>
  overviewKeyFigures({
    total: p.overviewMatchOutcomeTotal,
    surrenderOnly: p.overviewSurrenderOnlyCount,
    early: p.overviewEarlySurrenderCount,
    topBan: asChampionRows(p.overviewEffectiveTopBanrateChampions),
    topWinrateRise: asChampionRows(p.overviewTopWinrateSince),
  })
)

const trendMetric = ref<TrendMetric>('winrate')
/** Carte de liste affichée sur mobile (segment Joués / Winrate / Bannis). */
const mobileListKey = ref<'picks' | 'wins' | 'bans'>('picks')
const trendCols = computed(() => {
  const m = trendMetric.value
  const src = {
    winrate: [p.overviewTopWinrateSince, p.overviewBottomWinrateSince],
    pickrate: [p.overviewTopPickrateSince, p.overviewBottomPickrateSince],
    banrate: [p.overviewTopBanrateSince, p.overviewBottomBanrateSince],
  }[m]
  const r = trendRows(m, asChampionRows(src[0]), asChampionRows(src[1]))
  return [
    { key: 'ups' as const, rows: r.ups },
    { key: 'downs' as const, rows: r.downs },
  ]
})

function asChampionRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? rows : []
}

type ChampRow = {
  championId: number
  pickrate?: number
  winrate?: number
  banrate?: number
  banRatePercent?: string
}

function banValue(r: ChampRow): number {
  const v =
    typeof r.banRatePercent === 'string' ? parseFloat(r.banRatePercent) : Number(r.banrate ?? 0)
  return Number.isFinite(v) ? v : 0
}

const listCards = computed(() => {
  const rows = (src: unknown, pick: (r: ChampRow) => number) =>
    asChampionRows<ChampRow>(src).map(r => ({ championId: Number(r.championId), value: pick(r) }))
  return [
    {
      key: 'picks',
      favId: 'overview.mostPicked',
      titleKey: 'statisticsPage.fastStatsMostPicked',
      unitKey: 'statisticsPage.overviewCardPickUnit',
      linkKey: 'statisticsPage.overviewCardPickLink',
      tone: 'is-gold',
      rows: barList(
        rows(p.overviewTopPickrateChampionsFiltered, r => Number(r.pickrate ?? 0)),
        {
          limit: 5,
        }
      ),
      go: () => p.goToTierListWithSort('pickrate'),
    },
    {
      key: 'wins',
      favId: 'overview.bestWinrate',
      titleKey: 'statisticsPage.fastStatsBestWinrate',
      unitKey: 'statisticsPage.overviewCardWinUnit',
      linkKey: 'statisticsPage.overviewCardWinLink',
      tone: 'is-win',
      rows: barList(
        rows(p.overviewEffectiveTopWinrateChampions, r => Number(r.winrate ?? 0)),
        {
          limit: 5,
          baseline: 50,
        }
      ),
      go: () => p.goToTierListWithSort('winrate'),
    },
    {
      key: 'bans',
      favId: 'overview.mostBanned',
      titleKey: 'statisticsPage.fastStatsMostBanned',
      unitKey: 'statisticsPage.overviewCardBanUnit',
      linkKey: 'statisticsPage.overviewCardBanLink',
      tone: 'is-gold',
      rows: barList(rows(p.overviewEffectiveTopBanrateChampions, banValue), { limit: 5 }),
      go: () => p.goToBansTab(),
    },
  ]
})

const outcome = computed(() =>
  outcomeSegments({
    played: p.overviewPlayedCount,
    surrender: p.overviewSurrenderOnlyCount,
    early: p.overviewEarlySurrenderCount,
  })
)
const outcomeAria = computed(() =>
  outcome.value
    .map(s => `${s.pct.toFixed(1)} % ${p.t(`statisticsPage.overviewOutcome_${s.key}`)}`)
    .join(', ')
)

const bansPair = computed(() =>
  pairedBans(
    asChampionRows(p.overviewTeamsData?.bans?.byWin),
    asChampionRows(p.overviewTeamsData?.bans?.byLoss),
    5
  )
)

function onThinPatchAction(): void {
  const notice = p.overviewThinPatch
  if (!notice) return
  p.selectStatsVersion(notice.mode === 'selected' ? notice.reliableVersion : notice.thinVersion)
}
</script>

<template>
  <div class="space-y-3 md:space-y-6">
    <div v-if="p.overviewThinPatch" class="ov-thin-patch" role="status">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" class="flex-none">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.6" />
        <path d="M10 9v5M10 6v.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
      <p v-if="p.overviewThinPatch.mode === 'fallback'" class="m-0 flex-1 md:hidden">
        <strong>{{
          p.t('statisticsPage.overviewThinPatchShortLead', {
            version: p.overviewThinPatch.thinVersion,
          })
        }}</strong>
        {{
          p.t('statisticsPage.overviewThinPatchShortTail', {
            reliable: p.overviewThinPatch.reliableVersion,
          })
        }}
      </p>
      <p class="m-0 flex-1" :class="{ 'hidden md:block': p.overviewThinPatch.mode === 'fallback' }">
        {{
          p.t(
            p.overviewThinPatch.mode === 'selected'
              ? 'statisticsPage.overviewThinPatchSelected'
              : 'statisticsPage.overviewThinPatchFallback',
            {
              version: p.overviewThinPatch.thinVersion,
              count: p.overviewThinPatch.matchCount,
              needed: p.overviewThinPatch.needed,
              reliable: p.overviewThinPatch.reliableVersion,
            }
          )
        }}
      </p>
      <button
        type="button"
        class="ov-thin-patch-btn"
        :class="{ 'hidden md:inline-block': p.overviewThinPatch.mode === 'fallback' }"
        @click="onThinPatchAction"
      >
        {{
          p.overviewThinPatch.mode === 'selected'
            ? p.t('statisticsPage.overviewThinPatchShowReliable', {
                reliable: p.overviewThinPatch.reliableVersion,
              })
            : p.t('statisticsPage.overviewThinPatchShowNew', {
                version: p.overviewThinPatch.thinVersion,
              })
        }}
      </button>
    </div>
    <div class="rounded-lg">
      <div v-if="p.overviewPending" class="text-text/70">
        {{ p.t('statisticsPage.loading') }}
      </div>
      <div
        v-else-if="p.overviewError"
        class="rounded border border-error/50 bg-error/10 p-4 text-error"
      >
        <p class="mb-2">{{ p.overviewError }}</p>
        <button
          type="button"
          class="rounded bg-accent px-3 py-1.5 text-sm font-medium text-background hover:opacity-90"
          @click="p.loadOverview()"
        >
          {{ p.t('statisticsPage.retry') }}
        </button>
      </div>
      <div v-else-if="p.overviewData" class="space-y-[10px]">
        <ul class="ov-keys" :aria-label="p.t('statisticsPage.overviewKeysAria')">
          <li class="ov-key">
            <span class="ov-key-label hidden md:inline">{{
              p.t('statisticsPage.overviewKeyGames')
            }}</span>
            <span class="ov-key-label is-short md:hidden">{{
              p.t('statisticsPage.overviewKeyGamesShort')
            }}</span>
            <span class="ov-key-value">{{ keyFigures.games.toLocaleString() }}</span>
          </li>
          <li class="ov-key">
            <span class="ov-key-label hidden md:inline">{{
              p.t('statisticsPage.overviewKeySurrender')
            }}</span>
            <span class="ov-key-label is-short md:hidden">{{
              p.t('statisticsPage.overviewKeySurrenderShort')
            }}</span>
            <span class="ov-key-value">{{
              keyFigures.surrenderPct != null ? `${keyFigures.surrenderPct.toFixed(1)} %` : '—'
            }}</span>
            <span v-if="keyFigures.earlyPct != null" class="ov-key-sub ov-mhide">{{
              p.t('statisticsPage.overviewKeyEarly', { pct: keyFigures.earlyPct.toFixed(1) })
            }}</span>
          </li>
          <li class="ov-key ov-mhide">
            <span class="ov-key-label">{{ p.t('statisticsPage.overviewKeyTopBan') }}</span>
            <span class="ov-key-value">{{
              keyFigures.topBan
                ? (p.championName(keyFigures.topBan.championId) ?? keyFigures.topBan.championId)
                : '—'
            }}</span>
            <span v-if="keyFigures.topBan" class="ov-key-sub"
              >{{ keyFigures.topBan.banrate.toFixed(1) }} % banrate</span
            >
          </li>
          <li class="ov-key ov-mhide">
            <span class="ov-key-label">{{ p.t('statisticsPage.overviewKeyTopRise') }}</span>
            <span class="ov-key-value">{{
              keyFigures.topRise
                ? (p.championName(keyFigures.topRise.championId) ?? keyFigures.topRise.championId)
                : '—'
            }}</span>
            <span v-if="keyFigures.topRise" class="ov-key-sub ov-key-up"
              >▲ +{{ keyFigures.topRise.delta.toFixed(1) }} pts ·
              {{ keyFigures.topRise.winrate.toFixed(1) }} %</span
            >
          </li>
        </ul>
        <section class="ov-grid3 ov-lists">
          <div
            role="tablist"
            class="ov-mseg md:hidden"
            :aria-label="p.t('statisticsPage.overviewTrendsAria')"
          >
            <button
              v-for="card in listCards"
              :key="card.key"
              type="button"
              role="tab"
              :aria-selected="mobileListKey === card.key"
              :class="['ov-mseg-btn', mobileListKey === card.key ? 'is-active' : '']"
              @click="mobileListKey = card.key as 'picks' | 'wins' | 'bans'"
            >
              {{ p.t(`statisticsPage.overviewMobileSeg_${card.key}`) }}
            </button>
          </div>
          <article
            v-for="card in listCards"
            :key="card.key"
            :class="['ov-card', mobileListKey === card.key ? '' : 'is-mhidden']"
          >
            <header class="ov-card-head ov-mhide">
              <h3 class="ov-card-title">
                <button
                  type="button"
                  class="ov-fav"
                  :class="{ 'is-on': p.cardIsFavorite(card.favId) }"
                  :aria-pressed="p.cardIsFavorite(card.favId)"
                  :title="p.t(card.titleKey)"
                  @click="p.toggleFavoriteCard(card.favId, p.t(card.titleKey))"
                >
                  {{ p.cardIsFavorite(card.favId) ? '★' : '☆' }}
                </button>
                {{ p.t(card.titleKey) }}
              </h3>
              <span class="ov-card-unit">{{ p.t(card.unitKey) }}</span>
            </header>
            <ol v-if="card.rows.length" class="ov-bars">
              <li v-for="row in card.rows" :key="row.championId" class="ov-bar-row">
                <img
                  v-if="p.gameVersion && p.championByKey(row.championId)"
                  loading="lazy"
                  decoding="async"
                  :src="
                    p.getChampionImageUrl(
                      p.gameVersion,
                      p.championByKey(row.championId)!.image.full
                    )
                  "
                  :alt="p.championName(row.championId) || ''"
                  class="ov-thumb"
                />
                <span v-else class="ov-thumb" />
                <div class="ov-bar-main">
                  <StatisticsChampionDetailLink :champion-id="row.championId" class="ov-bar-name">
                    {{ p.championName(row.championId) || row.championId }}
                  </StatisticsChampionDetailLink>
                  <div class="ov-track">
                    <div class="ov-fill" :class="card.tone" :style="{ width: `${row.pct}%` }" />
                  </div>
                </div>
                <span class="ov-bar-val">{{ row.value.toFixed(2) }} %</span>
              </li>
            </ol>
            <p v-else class="ov-empty">{{ p.t('statisticsPage.fastStatsNoData') }}</p>
            <button type="button" class="ov-card-link" @click="card.go()">
              {{ p.t(card.linkKey) }} →
            </button>
          </article>
        </section>
        <!-- Tendances depuis X : hausse / baisse, onglets métrique -->
        <section class="ov-trends w-full">
          <header class="ov-trends-head">
            <h3 class="ov-trends-title is-mobile md:hidden">
              {{
                p.t('statisticsPage.overviewTrendsMobileTitle', {
                  metric: p.t(`statisticsPage.overviewTrendsMetric_${trendMetric}`),
                  version: p.progressionFromVersion || '—',
                })
              }}
            </h3>
            <select
              v-model="trendMetric"
              class="ov-trends-select md:hidden"
              :aria-label="p.t('statisticsPage.overviewTrendsAria')"
            >
              <option v-for="m in TREND_METRICS" :key="m" :value="m">
                {{ p.t(`statisticsPage.overviewTrendsMetric_${m}`) }}
              </option>
            </select>
            <div class="ov-mhide">
              <h3 class="ov-trends-title">
                {{
                  p.t('statisticsPage.overviewTrendsTitle', {
                    version: p.progressionFromVersion || '—',
                  })
                }}
              </h3>
              <span class="ov-trends-sub">{{ p.t('statisticsPage.overviewTrendsSub') }}</span>
            </div>
            <div
              role="tablist"
              class="ov-trends-tabs ov-mhide"
              :aria-label="p.t('statisticsPage.overviewTrendsAria')"
            >
              <button
                v-for="m in TREND_METRICS"
                :key="m"
                type="button"
                role="tab"
                class="ov-trends-tab"
                :class="{ 'is-active': trendMetric === m }"
                :aria-selected="trendMetric === m"
                @click="trendMetric = m"
              >
                {{ p.t(`statisticsPage.overviewTrendsMetric_${m}`) }}
              </button>
            </div>
          </header>
          <div class="ov-trends-cols">
            <div v-for="col in trendCols" :key="col.key" class="ov-trends-col">
              <h4 class="ov-trends-col-title" :class="col.key === 'ups' ? 'is-up' : 'is-down'">
                {{ col.key === 'ups' ? '▲' : '▼' }}
                {{ p.t(`statisticsPage.overviewTrends_${col.key}`) }}
              </h4>
              <p v-if="!col.rows.length" class="text-xs text-text/60">
                {{ p.t('statisticsPage.fastStatsNoProgression') }}
              </p>
              <div v-for="row in col.rows" :key="row.championId" class="ov-trend-row">
                <StatisticsChampionDetailLink :champion-id="row.championId" class="ov-trend-champ">
                  <img
                    v-if="p.gameVersion && p.championByKey(row.championId)"
                    loading="lazy"
                    decoding="async"
                    :src="
                      p.getChampionImageUrl(
                        p.gameVersion,
                        p.championByKey(row.championId)!.image.full
                      )
                    "
                    :alt="p.championName(row.championId) || ''"
                    class="h-6 w-6 shrink-0 rounded-full object-cover"
                  />
                  <span class="truncate">{{
                    p.championName(row.championId) || row.championId
                  }}</span>
                </StatisticsChampionDetailLink>
                <span class="ov-trend-fromto">
                  {{ row.from.toFixed(1) }} → <strong>{{ row.to.toFixed(1) }}</strong>
                </span>
                <div class="ov-trend-bar" :class="col.key === 'ups' ? 'is-up' : 'is-down'">
                  <div class="ov-trend-track">
                    <div class="ov-trend-fill" :style="{ width: `${row.barPct}%` }" />
                  </div>
                  <span class="ov-trend-delta"
                    >{{ row.delta > 0 ? '+' : '−' }}{{ Math.abs(row.delta).toFixed(1) }}</span
                  >
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="ov-grid3 ov-mhide">
          <article class="ov-card">
            <h3 class="ov-card-title">{{ p.t('statisticsPage.overviewMatchOutcomesTitle') }}</h3>
            <div v-if="p.overviewAbandonsPending || p.overviewPending" class="ov-empty">
              {{ p.t('statisticsPage.loading') }}
            </div>
            <template v-else-if="p.overviewMatchOutcomeTotal > 0">
              <div class="ov-stack" role="img" :aria-label="outcomeAria">
                <div
                  v-for="s in outcome"
                  :key="s.key"
                  :class="`ov-seg-${s.key}`"
                  :style="{ width: `${s.pct}%` }"
                />
              </div>
              <dl class="ov-legend">
                <template v-for="s in outcome" :key="s.key">
                  <dt>
                    <span class="ov-swatch" :class="`ov-seg-${s.key}`" />
                    {{ p.t(`statisticsPage.overviewOutcome_${s.key}`) }}
                  </dt>
                  <dd>{{ s.count.toLocaleString() }} · {{ s.pct.toFixed(1) }} %</dd>
                </template>
              </dl>
            </template>
            <div v-else class="ov-empty">{{ p.t('statisticsPage.overviewNoData') }}</div>
          </article>

          <article
            v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0"
            class="ov-card ov-span2"
          >
            <header class="ov-card-head">
              <h3 class="ov-card-title">{{ p.t('statisticsPage.overviewBansPairTitle') }}</h3>
              <span class="ov-pair-legend">
                <span
                  ><span class="ov-swatch is-win" />{{
                    p.t('statisticsPage.overviewBansWin')
                  }}</span
                >
                <span
                  ><span class="ov-swatch is-loss" />{{
                    p.t('statisticsPage.overviewBansLoss')
                  }}</span
                >
              </span>
            </header>
            <div v-for="b in bansPair" :key="b.championId" class="ov-pair-row">
              <StatisticsChampionDetailLink :champion-id="b.championId" class="ov-bar-name">
                {{ p.championName(b.championId) || b.championId }}
              </StatisticsChampionDetailLink>
              <div class="ov-pair-bars">
                <div class="ov-track is-thick">
                  <div class="ov-fill is-win" :style="{ width: `${b.winPct}%` }" />
                </div>
                <div class="ov-track is-thick">
                  <div class="ov-fill is-loss" :style="{ width: `${b.lossPct}%` }" />
                </div>
              </div>
              <span class="ov-pair-val">{{ b.win.toFixed(1) }} / {{ b.loss.toFixed(1) }} %</span>
            </div>
            <p class="ov-note">{{ p.t('statisticsPage.overviewBansPairNote') }}</p>
            <button type="button" class="ov-card-link" @click="p.goToBansTab()">
              {{ p.t('statisticsPage.overviewCardBanLink') }} →
            </button>
          </article>
        </section>
      </div>
      <div v-else class="text-text/70">{{ p.t('statisticsPage.overviewNoData') }}</div>
    </div>
  </div>
</template>

<style scoped>
.ov-keys {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 0 0 6px;
  padding: 0;
  list-style: none;
}
.ov-key {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid rgb(200 155 60 / 0.3);
  border-radius: 8px;
  background: rgb(10 50 60 / 0.35);
}
.ov-key-label {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-grey-50, #a09b8c);
}
.ov-key-value {
  overflow: hidden;
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-size: 1.6rem;
  font-weight: 600;
  line-height: 1.1;
  color: var(--color-gold-50, #f0e6d2);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ov-key-sub {
  font-size: 0.75rem;
  color: var(--color-grey-50, #a09b8c);
}
.ov-key-up {
  color: var(--color-blue-100, #0ac8b9);
}
@media (max-width: 768px) {
  .ov-keys {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

<style scoped>
.ov-thin-patch {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid color-mix(in srgb, var(--color-info, #0397ab) 50%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-info, #0397ab) 10%, transparent);
  color: var(--color-info, #0397ab);
  font-size: 13px;
}
.ov-thin-patch p {
  color: var(--color-text);
}
.ov-thin-patch-btn {
  flex: none;
  padding: 6px 12px;
  border: 1px solid currentColor;
  border-radius: 6px;
  font-weight: 600;
  white-space: nowrap;
}
@media (max-width: 639px) {
  .ov-thin-patch {
    flex-wrap: wrap;
  }
}
.ov-trends {
  border: 1px solid rgb(200 155 60 / 0.3);
  border-radius: 8px;
  padding: 12px;
}
.ov-trends-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.ov-trends-title {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-gold-50, #f0e6d2);
}
.ov-trends-sub {
  font-size: 12px;
  color: var(--color-grey-50, #a09b8c);
}
.ov-trends-tabs {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: rgb(10 20 40 / 0.6);
}
.ov-trends-tab {
  height: 32px;
  padding: 0 14px;
  border-radius: 6px;
  color: var(--color-grey-50, #a09b8c);
  font-size: 13px;
}
.ov-trends-tab.is-active {
  background: #0a323c;
  color: var(--color-gold-50, #f0e6d2);
  font-weight: 600;
}
.ov-trends-cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}
.ov-trends-col-title {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.ov-trends-col-title.is-up,
.ov-trend-bar.is-up .ov-trend-delta {
  color: var(--color-blue-100, #0ac8b9);
}
.ov-trends-col-title.is-down,
.ov-trend-bar.is-down .ov-trend-delta {
  color: #e2665a;
}
.ov-trend-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(90px, 140px);
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
}
.ov-trend-champ {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}
.ov-trend-fromto {
  font-variant-numeric: tabular-nums;
  color: var(--color-grey-50, #a09b8c);
}
.ov-trend-bar {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ov-trend-track {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: rgb(160 155 140 / 0.15);
  overflow: hidden;
}
.ov-trend-fill {
  height: 100%;
  border-radius: 3px;
}
.ov-trend-bar.is-up .ov-trend-fill {
  background: var(--color-blue-100, #0ac8b9);
}
.ov-trend-bar.is-down .ov-trend-fill {
  background: #e2665a;
}
.ov-trend-delta {
  min-width: 3.2em;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.ov-grid3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.ov-span2 {
  grid-column: span 2;
}
.ov-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 20px;
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
}
.ov-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.ov-card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #f0e6d2;
}
.ov-card-unit {
  font-size: 12px;
  color: #a09b8c;
}
.ov-fav {
  font-size: 14px;
  line-height: 1;
  color: #5b5a56;
}
.ov-fav.is-on {
  color: #c8aa6e;
}
.ov-bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ov-bar-row {
  display: grid;
  grid-template-columns: 32px 1fr 64px;
  align-items: center;
  gap: 10px;
}
.ov-thumb {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #0a323c;
  object-fit: cover;
}
.ov-bar-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.ov-bar-name {
  overflow: hidden;
  font-weight: 500;
  color: #f0e6d2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ov-track {
  height: 4px;
  background: #1e2328;
  border-radius: 2px;
}
.ov-track.is-thick {
  height: 6px;
  border-radius: 3px;
}
.ov-fill {
  height: 100%;
  border-radius: inherit;
  background: #c89b3c;
}
.ov-fill.is-win {
  background: #0ac8b9;
}
.ov-fill.is-loss {
  background: #e2665a;
}
.ov-bar-val,
.ov-pair-val,
.ov-legend dd {
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.ov-bar-val {
  font-weight: 600;
}
.ov-card-link {
  align-self: flex-start;
  padding-top: 4px;
  font-size: 13px;
  font-weight: 600;
  color: #c8aa6e;
}
.ov-card-link:hover {
  color: #f0e6d2;
}
.ov-empty {
  padding: 12px 0;
  font-size: 13px;
  text-align: center;
  color: #a09b8c;
}
.ov-stack {
  display: flex;
  gap: 2px;
  height: 14px;
  overflow: hidden;
  border-radius: 7px;
}
.ov-seg-played {
  background: #c89b3c;
}
.ov-seg-surrender {
  background: #005a82;
}
.ov-seg-early {
  background: #cdfafa;
}
.ov-legend {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px 12px;
  margin: 0;
  font-size: 13px;
}
.ov-legend dt {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #cbc3b0;
}
.ov-legend dd {
  margin: 0;
  font-weight: 600;
}
.ov-swatch {
  display: inline-block;
  flex: none;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  border-radius: 2px;
}
.ov-legend .ov-swatch {
  margin-right: 0;
}
.ov-swatch.is-win {
  background: #0ac8b9;
}
.ov-swatch.is-loss {
  background: #e2665a;
}
.ov-pair-legend {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #a09b8c;
}
.ov-pair-legend > span {
  display: flex;
  align-items: center;
}
.ov-pair-row {
  display: grid;
  grid-template-columns: 120px 1fr 120px;
  align-items: center;
  gap: 16px;
  padding: 6px 0;
}
.ov-pair-bars {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.ov-pair-val {
  font-size: 13px;
  color: #cbc3b0;
}
.ov-note {
  margin: 0;
  font-size: 12px;
  color: #a09b8c;
}
@media (max-width: 1023px) {
  .ov-grid3 {
    grid-template-columns: 1fr;
  }
  .ov-span2 {
    grid-column: auto;
  }
}
.ov-mseg {
  display: flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid #1e2328;
  border-radius: 8px;
  background: #010a13;
}
.ov-mseg-btn {
  flex: 1;
  height: 38px;
  border-radius: 6px;
  color: #a09b8c;
  font-size: 14px;
}
.ov-mseg-btn.is-active {
  background: #0a323c;
  color: #f0e6d2;
  font-weight: 700;
}
.ov-trends-select {
  height: 32px;
  padding: 0 8px;
  border: 1px solid #785a28;
  border-radius: 6px;
  background: #0a1428;
  color: #f0e6d2;
  font-size: 12px;
}
@media (max-width: 767px) {
  .ov-mhide,
  .ov-card.is-mhidden {
    display: none;
  }
  .ov-lists {
    gap: 0;
    padding: 16px;
    border: 1px solid #463714;
    border-radius: 12px;
    background: #0a1428;
  }
  .ov-lists .ov-mseg {
    margin-bottom: 14px;
  }
  .ov-lists .ov-card {
    padding: 0;
    border: 0;
    background: none;
  }
  .ov-key-value {
    font-size: 1.9rem;
  }
  .ov-key-label.is-short {
    text-transform: none;
    letter-spacing: 0;
    font-size: 0.75rem;
  }
  .ov-trends {
    padding: 16px;
    border-color: #463714;
    border-radius: 12px;
    background: #0a1428;
  }
  .ov-trends-title.is-mobile {
    font-family: inherit;
    font-size: 15px;
    font-weight: 600;
  }
  .ov-trends-cols {
    gap: 10px;
  }
  .ov-trend-row {
    grid-template-columns: minmax(0, 1fr) auto;
    padding: 10px 0;
    border-bottom: 1px solid #1e2328;
  }
  .ov-trend-row:nth-of-type(n + 4),
  .ov-trend-champ img,
  .ov-trend-fromto,
  .ov-trend-track {
    display: none;
  }
  .ov-pair-row {
    grid-template-columns: 90px 1fr auto;
    gap: 10px;
  }
}
</style>
