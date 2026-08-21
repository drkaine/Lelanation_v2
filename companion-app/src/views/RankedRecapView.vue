<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { translate } from "../i18n";
import { championDisplayName, loadChampionNameMap } from "../championNames";
import { roleLabel } from "../i18n/matchJournalLabels";
import type { MatchJournalEntry } from "../types/matchJournal";
import { fetchChampionBenchmark, type CompanionBenchmark } from "../api/companionBenchmark";
import {
  RANKED_COMPARISON_ROWS,
  buildTrendSeries,
  formatDelta,
} from "../rankedRecapMetrics";
import { isRankedSoloDuo } from "../utils/rankedQueue";
import { rankTierForApi, roleForApi } from "../utils/rankTier";
import MetricTrendChart from "../components/MetricTrendChart.vue";

const props = defineProps<{
  language: "fr" | "en";
}>();

const entries = ref<MatchJournalEntry[]>([]);
const selectedId = ref<string | null>(null);
const loading = ref(false);
const benchmarkLoading = ref(false);
const benchmark = ref<CompanionBenchmark | null>(null);
const championNames = ref(new Map<number, string>());

let journalUnlisten: UnlistenFn | null = null;

function t(key: string, params?: Record<string, string | number>): string {
  return translate(props.language, key, params);
}

const rankedEntries = computed(() =>
  entries.value.filter(isRankedSoloDuo).sort((a, b) => b.playedAtMs - a.playedAtMs)
);

const selected = computed(() =>
  rankedEntries.value.find((e) => e.id === selectedId.value) ?? null
);

const trendSeries = computed(() =>
  buildTrendSeries(rankedEntries.value.slice().reverse(), benchmark.value)
);

function champName(id: number | null | undefined): string {
  return championDisplayName(championNames.value, id);
}

function formatDateTime(ms: number): { date: string; time: string } {
  const d = new Date(ms);
  const locale = props.language === "fr" ? "fr-FR" : "en-GB";
  return {
    date: d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
  };
}

function formatNum(v: number | null | undefined, integer = false): string {
  if (v == null || Number.isNaN(v)) return "—";
  return integer ? String(Math.round(v)) : v.toFixed(1);
}

function deltaClass(row: (typeof RANKED_COMPARISON_ROWS)[number], entry: MatchJournalEntry): string {
  const player = row.playerValue(entry);
  const bench = benchmark.value ? row.benchmarkValue(benchmark.value) : null;
  if (player == null || bench == null) return "";
  const d = player - bench;
  const good = row.lowerIsBetter ? d < 0 : d > 0;
  const bad = row.lowerIsBetter ? d > 0 : d < 0;
  if (good) return "delta-good";
  if (bad) return "delta-bad";
  return "";
}

async function loadChampionNames() {
  championNames.value = await loadChampionNameMap(props.language);
}

async function loadJournal() {
  loading.value = true;
  try {
    entries.value = await invoke<MatchJournalEntry[]>("get_match_journal");
    const list = entries.value.filter(isRankedSoloDuo);
    if (!selectedId.value && list.length > 0) {
      selectedId.value = list[0].id;
    } else if (selectedId.value && !list.some((e) => e.id === selectedId.value)) {
      selectedId.value = list[0]?.id ?? null;
    }
  } catch {
    entries.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadBenchmark(entry: MatchJournalEntry) {
  benchmarkLoading.value = true;
  benchmark.value = null;
  try {
    benchmark.value = await fetchChampionBenchmark({
      championId: entry.championId,
      patch: entry.patch || null,
      rankTier: rankTierForApi(entry.rankTier),
      role: roleForApi(entry.role),
    });
  } finally {
    benchmarkLoading.value = false;
  }
}

async function deleteEntry(id: string) {
  try {
    entries.value = await invoke<MatchJournalEntry[]>("delete_match_journal_entry", { id });
    const list = entries.value.filter(isRankedSoloDuo);
    if (selectedId.value === id) {
      selectedId.value = list[0]?.id ?? null;
    }
  } catch {
    /* ignore */
  }
}

watch(
  selected,
  (entry) => {
    if (entry) void loadBenchmark(entry);
    else benchmark.value = null;
  },
  { immediate: true }
);

watch(
  () => props.language,
  () => {
    void loadChampionNames();
  }
);

onMounted(async () => {
  await loadChampionNames();
  await loadJournal();
  journalUnlisten = await listen<MatchJournalEntry[]>("lcu:match-journal-updated", (ev) => {
    entries.value = ev.payload;
    const list = ev.payload.filter(isRankedSoloDuo);
    if (list.length > 0) {
      selectedId.value = list[0].id;
    }
  });
});

onUnmounted(() => {
  if (journalUnlisten) void journalUnlisten();
});
</script>

<template>
  <section class="recap-page">
    <header class="recap-header">
      <div>
        <h2>{{ t("progression.recap.title") }}</h2>
        <p class="recap-sub">{{ t("progression.recap.subtitle") }}</p>
      </div>
      <button type="button" class="btn-refresh" :disabled="loading" @click="loadJournal">
        {{ loading ? t("progression.journal.loading") : t("progression.journal.refresh") }}
      </button>
    </header>

    <div v-if="rankedEntries.length === 0" class="recap-empty">
      {{ t("progression.recap.empty") }}
    </div>

    <div v-else class="recap-layout">
      <aside class="recap-list" :aria-label="t('progression.recap.history')">
        <button
          v-for="entry in rankedEntries"
          :key="entry.id"
          type="button"
          class="recap-row"
          :class="{ active: selectedId === entry.id, win: entry.win, loss: !entry.win }"
          @click="selectedId = entry.id"
        >
          <div class="row-top">
            <span class="row-date">{{ formatDateTime(entry.playedAtMs).date }}</span>
            <span class="row-time">{{ formatDateTime(entry.playedAtMs).time }}</span>
            <span class="row-result" :class="entry.win ? 'win' : 'loss'">
              {{ entry.win ? t("progression.journal.win") : t("progression.journal.loss") }}
            </span>
          </div>
          <div class="row-meta">
            <span v-if="entry.patch">{{ entry.patch }}</span>
            <span v-if="entry.rankTier">{{ entry.rankTier }}</span>
            <span v-if="entry.role">{{ roleLabel(language, entry.role) }}</span>
          </div>
          <div class="row-stats">
            {{ champName(entry.championId) }}
            <template v-if="entry.opponentChampionId">
              vs {{ champName(entry.opponentChampionId) }}
            </template>
            · {{ entry.stats.kills }}/{{ entry.stats.deaths }}/{{ entry.stats.assists }}
          </div>
        </button>
      </aside>

      <article v-if="selected" class="recap-detail">
        <header class="detail-header">
          <div>
            <h3>
              {{ formatDateTime(selected.playedAtMs).date }}
              {{ formatDateTime(selected.playedAtMs).time }}
            </h3>
            <p class="detail-meta">
              <span v-if="selected.patch">{{ t("progression.recap.patch") }} {{ selected.patch }}</span>
              <span v-if="selected.rankTier">{{ selected.rankTier }}</span>
              <span v-if="selected.region">{{ selected.region }}</span>
              <span v-if="selected.role">{{ roleLabel(language, selected.role) }}</span>
            </p>
          </div>
          <button type="button" class="btn-delete" @click="deleteEntry(selected.id)">
            {{ t("progression.journal.delete") }}
          </button>
        </header>

        <div class="detail-grid">
          <div class="detail-card">
            <h4>{{ t("progression.journal.matchInfo") }}</h4>
            <dl>
              <dt>{{ t("progression.journal.champion") }}</dt>
              <dd>{{ champName(selected.championId) }}</dd>
              <dt>{{ t("progression.journal.opponent") }}</dt>
              <dd>{{ champName(selected.opponentChampionId) }}</dd>
              <dt>{{ t("progression.journal.duration") }}</dt>
              <dd>{{ Math.round(selected.stats.gameDurationSeconds / 60) }} min</dd>
              <dt>{{ t("progression.journal.lp") }}</dt>
              <dd>
                {{
                  selected.stats.lpChange != null
                    ? (selected.stats.lpChange > 0 ? "+" : "") + selected.stats.lpChange
                    : "—"
                }}
              </dd>
            </dl>
          </div>

          <div class="detail-card">
            <h4>{{ t("progression.recap.benchmarkTitle") }}</h4>
            <p v-if="benchmarkLoading" class="bench-note">{{ t("progression.recap.benchmarkLoading") }}</p>
            <p v-else-if="!benchmark || benchmark.games <= 0" class="bench-note">
              {{ t("progression.recap.benchmarkEmpty") }}
            </p>
            <dl v-else>
              <dt>{{ t("progression.recap.benchmarkGames") }}</dt>
              <dd>{{ benchmark.games.toLocaleString() }}</dd>
              <dt v-if="benchmark.winrate != null">{{ t("progression.recap.benchmarkWr") }}</dt>
              <dd v-if="benchmark.winrate != null">{{ benchmark.winrate.toFixed(1) }}%</dd>
              <dt>{{ t("progression.recap.benchmarkScope") }}</dt>
              <dd>
                {{ champName(selected.championId) }}
                · {{ rankTierForApi(selected.rankTier) ?? "—" }}
                · {{ roleForApi(selected.role) ?? "—" }}
              </dd>
            </dl>
          </div>
        </div>

        <div class="compare-section">
          <h4>{{ t("progression.recap.compareTitle") }}</h4>
          <p class="compare-note">{{ t("progression.recap.compareNote") }}</p>
          <table class="compare-table">
            <thead>
              <tr>
                <th>{{ t("progression.recap.colMetric") }}</th>
                <th>{{ t("progression.recap.colYou") }}</th>
                <th>{{ t("progression.recap.colDb") }}</th>
                <th>{{ t("progression.recap.colDelta") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in RANKED_COMPARISON_ROWS" :key="row.id">
                <th>{{ t(row.labelKey) }}</th>
                <td>{{ formatNum(row.playerValue(selected), row.integer) }}</td>
                <td>
                  {{
                    benchmark
                      ? formatNum(row.benchmarkValue(benchmark), row.integer)
                      : "—"
                  }}
                </td>
                <td
                  :class="
                    deltaClass(row, selected) ||
                    (formatDelta(
                      row.playerValue(selected),
                      benchmark ? row.benchmarkValue(benchmark) : null
                    ).positive === true
                      ? row.lowerIsBetter
                        ? 'delta-bad'
                        : 'delta-good'
                      : formatDelta(
                            row.playerValue(selected),
                            benchmark ? row.benchmarkValue(benchmark) : null
                          ).positive === false
                        ? row.lowerIsBetter
                          ? 'delta-good'
                          : 'delta-bad'
                        : '')
                  "
                >
                  {{
                    formatDelta(
                      row.playerValue(selected),
                      benchmark ? row.benchmarkValue(benchmark) : null
                    ).text
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="rankedEntries.length > 1" class="trends-section">
          <h4>{{ t("progression.recap.trendsTitle") }}</h4>
          <p class="trends-note">{{ t("progression.recap.trendsNote") }}</p>
          <div class="trends-grid">
            <MetricTrendChart
              v-for="series in trendSeries"
              :key="series.id"
              :label="t(series.labelKey)"
              :points="series.points"
              :benchmark="series.benchmark"
              :lower-is-better="series.lowerIsBetter"
            />
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.recap-page {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 1rem 1.25rem 2rem;
  background: #0f1419;
  color: #e8eaed;
}
.recap-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}
.recap-header h2 {
  margin: 0 0 0.35rem;
  font-size: 1.25rem;
}
.recap-sub {
  margin: 0;
  color: #9aa0a6;
  font-size: 0.9rem;
  max-width: 42rem;
}
.btn-refresh {
  padding: 0.4rem 0.75rem;
  background: #1f2933;
  border: 1px solid #3c4043;
  border-radius: 6px;
  color: #e8eaed;
  cursor: pointer;
  font-size: 0.82rem;
}
.recap-empty {
  padding: 2rem;
  text-align: center;
  color: #9aa0a6;
  border: 1px dashed #2d3748;
  border-radius: 10px;
}
.recap-layout {
  display: grid;
  grid-template-columns: minmax(220px, 280px) 1fr;
  gap: 1rem;
  min-height: 400px;
}
.recap-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-height: 70vh;
  overflow: auto;
}
.recap-row {
  text-align: left;
  padding: 0.6rem 0.75rem;
  background: #151b24;
  border: 1px solid #2d3748;
  border-radius: 8px;
  color: #e8eaed;
  cursor: pointer;
}
.recap-row.active {
  border-color: #8ab4f8;
  background: #1a2332;
}
.row-top {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.82rem;
  margin-bottom: 0.25rem;
}
.row-date {
  font-weight: 600;
}
.row-time {
  color: #9aa0a6;
}
.row-result.win {
  color: #7ee787;
  margin-left: auto;
}
.row-result.loss {
  color: #f28b82;
  margin-left: auto;
}
.row-meta,
.row-stats {
  font-size: 0.78rem;
  color: #9aa0a6;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.recap-detail {
  background: #151b24;
  border: 1px solid #2d3748;
  border-radius: 10px;
  padding: 1rem;
}
.detail-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}
.detail-header h3 {
  margin: 0 0 0.35rem;
  font-size: 1.05rem;
}
.detail-meta {
  margin: 0;
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
  color: #9aa0a6;
  font-size: 0.85rem;
}
.btn-delete {
  padding: 0.35rem 0.65rem;
  background: transparent;
  border: 1px solid #5c2b2b;
  border-radius: 6px;
  color: #f28b82;
  cursor: pointer;
  font-size: 0.8rem;
  align-self: flex-start;
}
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.detail-card {
  background: #0f1419;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 0.75rem;
}
.detail-card h4 {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  color: #8ab4f8;
}
.detail-card dl {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.25rem 0.75rem;
  font-size: 0.85rem;
}
.detail-card dt {
  color: #9aa0a6;
}
.bench-note {
  margin: 0;
  font-size: 0.82rem;
  color: #9aa0a6;
}
.compare-section h4,
.trends-section h4 {
  margin: 0 0 0.35rem;
  font-size: 0.9rem;
}
.compare-note,
.trends-note {
  margin: 0 0 0.75rem;
  font-size: 0.8rem;
  color: #9aa0a6;
}
.compare-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
  margin-bottom: 1rem;
}
.compare-table th,
.compare-table td {
  border: 1px solid #2d3748;
  padding: 0.35rem 0.5rem;
  text-align: left;
}
.compare-table thead th {
  color: #8ab4f8;
  font-weight: 600;
}
.compare-table tbody th {
  color: #9aa0a6;
  font-weight: 500;
}
.delta-good {
  color: #7ee787;
}
.delta-bad {
  color: #f28b82;
}
.trends-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.65rem;
}
@media (max-width: 900px) {
  .recap-layout {
    grid-template-columns: 1fr;
  }
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
