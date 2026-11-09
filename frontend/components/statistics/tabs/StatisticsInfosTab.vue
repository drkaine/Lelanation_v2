<script setup lang="ts">
import { computed } from 'vue'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'
import { divisionName } from '~/utils/statistics/divisionName'
import { infosPatchState, infosSummary, type InfosRow } from '~/utils/statistics/infosSummary'

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()
const infosMatrixColumns = computed(() => p.infosMatrixColumns ?? [])

const infosDivisionColumns = computed(() =>
  infosMatrixColumns.value.filter((d: string) => d !== 'ALL')
)

const infosRows = computed(() => (p.infosMatrixRows ?? []) as InfosRow[])
const patchState = computed(() => infosPatchState(infosRows.value))
const patchesDesc = computed(() => [...summary.value.patches].reverse())
const summary = computed(() =>
  infosSummary(infosRows.value, infosDivisionColumns.value, 0.8, patchState.value.defaultVersion)
)
const { locale } = useI18n()
const numLocale = computed(() => (String(locale.value).startsWith('fr') ? 'fr-FR' : 'en-US'))
const fmtInt = (v: number) => v.toLocaleString(numLocale.value)
const fmtCompact = (v: number) =>
  new Intl.NumberFormat(numLocale.value, { notation: 'compact', maximumFractionDigits: 0 }).format(
    v
  )
const fmtPct = (v: number) =>
  new Intl.NumberFormat(numLocale.value, { maximumFractionDigits: 1 }).format(v) +
  (numLocale.value === 'fr-FR' ? '\u00A0%' : '%')

function barTone(version: string): string {
  if (version === patchState.value.collecting?.version) return 'is-collecting'
  if (version === patchState.value.defaultVersion) return 'is-default'
  return ''
}

function barTitle(version: string, games: number): string {
  const row = infosRows.value.find(r => r.version === version)
  const lines = infosDivisionColumns.value
    .map(d => [d, Number(row?.byDivision[d] ?? 0)] as const)
    .filter(([, v]) => v > 0)
    .map(([d, v]) => `${divisionLabel(d)} : ${fmtInt(v)}`)
  return [`${version} · ${fmtInt(games)}`, ...lines].join('\n')
}

function divisionLabel(division: string): string {
  if (division === 'ALL') return p.t('statisticsPage.overviewVersionAll')
  return divisionName(division, numLocale.value === 'fr-FR' ? 'fr' : 'en')
}
</script>

<template>
  <div class="space-y-2 pt-2 md:pt-8">
    <div v-if="p.overviewPending || p.infosMatrixPending" class="text-text/70">
      {{ p.t('statisticsPage.loading') }}
    </div>
    <div v-else-if="p.overviewError" class="rounded border border-error bg-surface p-3 text-error">
      {{ p.overviewError }}
    </div>
    <div
      v-else-if="p.infosMatrixError"
      class="rounded border border-error bg-surface p-3 text-error"
    >
      {{ p.infosMatrixError }}
    </div>
    <div v-else class="statistics-infos-tab space-y-4">
      <template v-if="summary.patches.length">
        <div class="infos-kpis">
          <article class="infos-kpi">
            <span class="infos-kpi-label">
              <span class="hidden md:inline">
                {{ p.t('statisticsPage.infosGamesTitleN', { n: summary.patches.length }) }}
              </span>
              <span class="md:hidden">
                {{ p.t('statisticsPage.infosGamesTitleShort', { n: summary.patches.length }) }}
              </span>
            </span>
            <span class="infos-kpi-value">{{ fmtInt(summary.total) }}</span>
          </article>
          <article v-if="patchState.defaultVersion" class="infos-kpi">
            <span class="infos-kpi-label">
              <span class="hidden md:inline">{{ p.t('statisticsPage.infosDefaultTitle') }}</span>
              <span class="md:hidden">{{ p.t('statisticsPage.infosDefaultShort') }}</span>
            </span>
            <span class="infos-kpi-value">{{ patchState.defaultVersion }}</span>
            <span class="infos-kpi-sub">{{ p.t('statisticsPage.infosDefaultSub') }}</span>
          </article>
          <article v-if="patchState.collecting" class="infos-kpi is-collecting">
            <span class="infos-kpi-label">
              {{
                p.t('statisticsPage.infosCollectingTitle', {
                  version: patchState.collecting.version,
                })
              }}
            </span>
            <span class="infos-kpi-value">
              {{ fmtInt(patchState.collecting.games) }}
              <small>
                / {{ fmtInt(patchState.collecting.needed) }}
                {{ p.t('statisticsPage.infosCollectingUnit') }}
              </small>
            </span>
            <div class="infos-kpi-track">
              <div
                class="infos-kpi-fill"
                :style="{ width: `${Math.max(patchState.collecting.pct, 1)}%` }"
              />
            </div>
          </article>
        </div>
        <div v-if="patchState.collecting" class="infos-collect-banner md:hidden">
          <p>
            <strong>
              {{
                p.t('statisticsPage.infosCollectingShort', {
                  version: patchState.collecting.version,
                })
              }}
            </strong>
            {{
              p.t('statisticsPage.infosCollectingNeeded', {
                n: fmtInt(patchState.collecting.games),
                needed: fmtInt(patchState.collecting.needed),
              })
            }}
          </p>
          <div class="infos-kpi-track">
            <div
              class="infos-kpi-fill"
              :style="{ width: `${Math.max(patchState.collecting.pct, 1)}%` }"
            />
          </div>
        </div>

        <article class="infos-card">
          <header class="infos-card-head">
            <h3 class="infos-card-title">{{ p.t('statisticsPage.infosChartTitle') }}</h3>
            <span class="infos-card-hint hidden md:inline">
              {{ p.t('statisticsPage.infosChartHint') }}
            </span>
          </header>
          <div class="infos-hbars md:hidden">
            <div
              v-for="x in patchesDesc"
              :key="'h-' + x.version"
              class="infos-hbar"
              :class="barTone(x.version)"
            >
              <span class="infos-hbar-label">{{ x.version }}</span>
              <div class="infos-div-track">
                <div class="infos-hbar-fill" :style="{ width: `${Math.max(x.heightPct, 0.5)}%` }" />
              </div>
              <span class="infos-hbar-value">{{ fmtCompact(x.games) }}</span>
            </div>
          </div>
          <div
            class="infos-bars"
            role="img"
            :aria-label="summary.patches.map(x => `${x.version} ${fmtInt(x.games)}`).join(', ')"
          >
            <div
              v-for="x in summary.patches"
              :key="x.version"
              class="infos-bar"
              :class="barTone(x.version)"
              :title="barTitle(x.version, x.games)"
            >
              <span class="infos-bar-value">{{ fmtCompact(x.games) }}</span>
              <div class="infos-bar-fill" :style="{ height: `${x.heightPct}%` }" />
              <span class="infos-bar-label">{{ x.version }}</span>
            </div>
          </div>
        </article>

        <article v-if="summary.divisions.length" class="infos-card">
          <header class="infos-card-head">
            <h3 class="infos-card-title">
              <span class="hidden md:inline">
                {{ p.t('statisticsPage.infosDivisionTitle', { version: summary.latestVersion }) }}
              </span>
              <span class="md:hidden">
                {{ p.t('statisticsPage.infosDivisionShort', { version: summary.latestVersion }) }}
              </span>
            </h3>
            <span v-if="summary.core" class="infos-card-hint hidden md:inline">
              {{
                p.t('statisticsPage.infosDivisionCore', {
                  pct: summary.core.sharePct,
                  from: divisionLabel(summary.core.from),
                  to: divisionLabel(summary.core.to),
                })
              }}
            </span>
          </header>
          <div v-for="d in summary.divisions" :key="d.division" class="infos-div-row">
            <span class="infos-div-name">
              <img
                v-if="p.getRankedEmblemUrl(d.division)"
                :src="p.getRankedEmblemUrl(d.division)!"
                alt=""
                class="infos-div-emblem"
                loading="lazy"
              />
              {{ divisionLabel(d.division) }}
            </span>
            <div class="infos-div-track">
              <div class="infos-div-fill" :style="{ width: `${Math.max(d.widthPct, 0.3)}%` }" />
            </div>
            <span class="infos-div-num">{{ fmtInt(d.games) }}</span>
            <span class="infos-div-pct">{{ fmtPct(d.sharePct) }}</span>
          </div>
        </article>
      </template>
      <div v-else class="statistics-empty-panel p-4">
        {{ p.t('statisticsPage.noData') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.infos-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}
.infos-kpi {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 20px;
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
}
.infos-kpi.is-collecting {
  border-color: #005a82;
}
.infos-kpi-label {
  font-size: 13px;
  color: #a09b8c;
}
.infos-kpi.is-collecting .infos-kpi-label {
  color: #0ac8b9;
}
.infos-kpi-value {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-size: 40px;
  font-weight: 700;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
  color: #f0e6d2;
}
.infos-kpi-value small {
  font-size: 20px;
  color: #a09b8c;
}
.infos-kpi-sub {
  font-size: 12px;
  color: #a09b8c;
}
.infos-kpi-track {
  height: 6px;
  margin-top: 6px;
  border-radius: 3px;
  background: #1e2328;
  overflow: hidden;
}
.infos-kpi-fill {
  height: 100%;
  background: #0ac8b9;
}
.infos-card {
  padding: 20px 24px;
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
}
.infos-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.infos-card-title {
  font-size: 15px;
  font-weight: 700;
  color: #f0e6d2;
}
.infos-card-hint {
  font-size: 12px;
  color: #a09b8c;
}
.infos-bars {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  height: 300px;
  padding: 24px 0 26px;
  border-bottom: 1px solid #463714;
}
.infos-bar {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: flex-end;
  height: 100%;
  min-width: 0;
}
.infos-bar-value {
  margin-bottom: 6px;
  text-align: center;
  font-size: 11px;
  color: #c8c3b4;
  white-space: nowrap;
}
.infos-bar-fill {
  width: 100%;
  min-height: 2px;
  border-radius: 2px 2px 0 0;
  background: #5b5a56;
}
.infos-bar:hover .infos-bar-fill {
  background: #785a28;
}
.infos-bar.is-default .infos-bar-fill {
  background: #c8aa6e;
}
.infos-bar.is-collecting .infos-bar-fill {
  background: #0ac8b9;
}
.infos-bar-label {
  position: absolute;
  bottom: -22px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: #a09b8c;
  white-space: nowrap;
}
.infos-div-row {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr) 72px 56px;
  align-items: center;
  gap: 12px;
  padding: 5px 0;
  font-size: 14px;
}
.infos-div-name {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #f0e6d2;
}
.infos-div-emblem {
  width: 22px;
  height: 22px;
  object-fit: contain;
}
.infos-div-track {
  height: 8px;
  border-radius: 4px;
  background: #1e2328;
  overflow: hidden;
}
.infos-div-fill {
  height: 100%;
  border-radius: 4px;
  background: #c8aa6e;
}
.infos-div-num {
  text-align: right;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #f0e6d2;
}
.infos-div-pct {
  text-align: right;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #a09b8c;
}
.infos-collect-banner {
  padding: 12px 14px;
  font-size: 13px;
  color: #0ac8b9;
  background: rgb(10 50 60 / 0.6);
  border: 1px solid #005a82;
  border-radius: 12px;
}
.infos-collect-banner strong {
  color: #f0e6d2;
}
.infos-hbars {
  display: grid;
  gap: 6px;
}
.infos-hbar {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 48px;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #a09b8c;
}
.infos-hbar-fill {
  height: 100%;
  border-radius: 4px;
  background: #5b5a56;
}
.infos-hbar.is-default .infos-hbar-fill {
  background: #c8aa6e;
}
.infos-hbar.is-collecting .infos-hbar-fill {
  background: #0ac8b9;
}
.infos-hbar-value {
  text-align: right;
  font-weight: 700;
  color: #f0e6d2;
}
@media (max-width: 767px) {
  .infos-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .infos-kpi {
    padding: 14px;
  }
  .infos-kpi-label {
    font-size: 12px;
  }
  .infos-kpi.is-collecting,
  .infos-bars,
  .infos-kpi-sub,
  .infos-div-emblem,
  .infos-div-num {
    display: none;
  }
  .infos-card {
    padding: 14px;
  }
  .infos-bars {
    gap: 4px;
    height: 200px;
  }
  .infos-bar-value {
    font-size: 9px;
  }
  .infos-bar-label {
    font-size: 9px;
  }
  .infos-div-row {
    grid-template-columns: 96px minmax(0, 1fr) 44px;
    gap: 8px;
    font-size: 13px;
  }
  .infos-kpi-value {
    font-size: 32px;
  }
}
</style>
