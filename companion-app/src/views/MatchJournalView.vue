<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { translate } from "../i18n";
import { championDisplayName, loadChampionNameMap } from "../championNames";
import { METRIC_GROUPS, metricLabel, queueLabel, roleLabel } from "../i18n/matchJournalLabels";
import type { MatchJournalEntry } from "../types/matchJournal";

const props = defineProps<{
  language: "fr" | "en";
}>();

const entries = ref<MatchJournalEntry[]>([]);
const selectedId = ref<string | null>(null);
const loading = ref(false);
const copyFeedback = ref("");
const showLcuRaw = ref(false);
const championNames = ref(new Map<number, string>());

const isDev = import.meta.env.DEV;

let journalUnlisten: UnlistenFn | null = null;

function t(key: string, params?: Record<string, string | number>): string {
  return translate(props.language, key, params);
}

const selected = computed(() =>
  entries.value.find((e) => e.id === selectedId.value) ?? null
);

function champName(id: number | null | undefined): string {
  return championDisplayName(championNames.value, id);
}

async function loadChampionNames() {
  championNames.value = await loadChampionNameMap(props.language);
}

function formatDateTime(ms: number): { date: string; time: string } {
  const d = new Date(ms);
  const locale = props.language === "fr" ? "fr-FR" : "en-GB";
  return {
    date: d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
  };
}

function metricValue(entry: MatchJournalEntry, key: string): string {
  const v = entry.metrics[key];
  if (v == null || Number.isNaN(v)) return "—";
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

function hasMetric(entry: MatchJournalEntry, key: string): boolean {
  const v = entry.metrics[key];
  return v != null && !Number.isNaN(v);
}

function groupHasValues(entry: MatchJournalEntry, keys: readonly string[]): boolean {
  return keys.some((k) => hasMetric(entry, k));
}

async function loadJournal() {
  loading.value = true;
  try {
    entries.value = await invoke<MatchJournalEntry[]>("get_match_journal");
    if (!selectedId.value && entries.value.length > 0) {
      selectedId.value = entries.value[0].id;
    }
  } catch {
    entries.value = [];
  } finally {
    loading.value = false;
  }
}

async function deleteEntry(id: string) {
  try {
    entries.value = await invoke<MatchJournalEntry[]>("delete_match_journal_entry", { id });
    if (selectedId.value === id) {
      selectedId.value = entries.value[0]?.id ?? null;
    }
  } catch {
    /* ignore */
  }
}

const lcuRawJson = computed(() => {
  if (!selected.value?.lcuRaw) return "";
  return JSON.stringify(selected.value.lcuRaw, null, 2);
});

async function copyLcuRaw() {
  if (!selected.value?.lcuRaw) return;
  const text = JSON.stringify(selected.value.lcuRaw, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    copyFeedback.value = t("progression.journal.lcuCopied");
  } catch {
    copyFeedback.value = t("progression.journal.lcuCopyFail");
  }
  setTimeout(() => {
    copyFeedback.value = "";
  }, 2500);
}

onMounted(async () => {
  await loadChampionNames();
  await loadJournal();
  journalUnlisten = await listen<MatchJournalEntry[]>("lcu:match-journal-updated", (ev) => {
    entries.value = ev.payload;
    if (ev.payload.length > 0) {
      selectedId.value = ev.payload[0].id;
    }
  });
});

watch(
  () => props.language,
  () => {
    void loadChampionNames();
  }
);

onUnmounted(() => {
  if (journalUnlisten) void journalUnlisten();
});
</script>

<template>
  <section class="journal-page">
    <header class="journal-header">
      <div>
        <h2>{{ t("progression.journal.title") }}</h2>
        <p class="journal-sub">{{ t("progression.journal.subtitle") }}</p>
      </div>
      <button type="button" class="btn-refresh" :disabled="loading" @click="loadJournal">
        {{ loading ? t("progression.journal.loading") : t("progression.journal.refresh") }}
      </button>
    </header>

    <div v-if="entries.length === 0" class="journal-empty">
      {{ t("progression.journal.empty") }}
    </div>

    <div v-else class="journal-layout">
      <aside class="journal-list" aria-label="Historique">
        <button
          v-for="entry in entries"
          :key="entry.id"
          type="button"
          class="journal-row"
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
            <span v-if="entry.region">{{ entry.region }}</span>
            <span>{{ queueLabel(language, entry.queueId, entry.gameMode) }}</span>
            <span v-if="entry.role">{{ roleLabel(language, entry.role) }}</span>
          </div>
          <div class="row-stats">
            {{ champName(entry.championId) }}
            <template v-if="entry.opponentChampionId">
              vs {{ champName(entry.opponentChampionId) }}
            </template>
            · {{ entry.stats.kills }}/{{ entry.stats.deaths }}/{{ entry.stats.assists }}
            · {{ entry.stats.csTotal }} CS
          </div>
        </button>
      </aside>

      <article v-if="selected" class="journal-detail">
        <header class="detail-header">
          <div>
            <h3>
              {{ formatDateTime(selected.playedAtMs).date }}
              {{ formatDateTime(selected.playedAtMs).time }}
            </h3>
            <p class="detail-meta">
              <span v-if="selected.region">{{ selected.region }}</span>
              <span>{{ queueLabel(language, selected.queueId, selected.gameMode) }}</span>
              <span v-if="selected.patch">{{ selected.patch }}</span>
              <span v-if="selected.rankTier">{{ selected.rankTier }}</span>
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
              <dt>{{ t("progression.journal.role") }}</dt>
              <dd>{{ roleLabel(language, selected.role) }}</dd>
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
            <h4>KDA & farm</h4>
            <dl>
              <dt>KDA</dt>
              <dd>
                {{ selected.stats.kills }}/{{ selected.stats.deaths }}/{{ selected.stats.assists }}
              </dd>
              <dt>CS</dt>
              <dd>{{ selected.stats.csTotal }}</dd>
              <dt>CS @ 5</dt>
              <dd>{{ selected.stats.csAt5 ?? "—" }}</dd>
              <dt>CS @ 10</dt>
              <dd>{{ selected.stats.csAt10 ?? "—" }}</dd>
              <dt>{{ t("progression.journal.wards") }}</dt>
              <dd>
                {{ selected.stats.wardsPlaced }} / {{ selected.stats.visionWardsBought }} pink
              </dd>
            </dl>
          </div>
        </div>

        <div class="metrics-section">
          <h4>{{ t("progression.journal.metricsTitle") }}</h4>
          <p class="metrics-note">{{ t("progression.journal.metricsNote") }}</p>

          <div
            v-for="group in METRIC_GROUPS"
            :key="group.id"
            v-show="groupHasValues(selected, group.keys)"
            class="metric-group"
          >
            <h5>{{ t(group.labelKey) }}</h5>
            <table class="metrics-table">
              <tbody>
                <tr v-for="key in group.keys" :key="key">
                  <th>{{ metricLabel(language, key) }}</th>
                  <td>{{ metricValue(selected, key) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="isDev && selected.lcuRaw" class="lcu-raw-section">
          <div class="lcu-raw-header">
            <h4>{{ t("progression.journal.lcuRawTitle") }}</h4>
            <div class="lcu-raw-actions">
              <button type="button" class="btn-copy-lcu" @click="copyLcuRaw">
                {{ t("progression.journal.lcuCopy") }}
              </button>
              <button type="button" class="btn-toggle-lcu" @click="showLcuRaw = !showLcuRaw">
                {{
                  showLcuRaw
                    ? t("progression.journal.lcuHide")
                    : t("progression.journal.lcuShow")
                }}
              </button>
            </div>
          </div>
          <p v-if="copyFeedback" class="copy-feedback">{{ copyFeedback }}</p>
          <p class="lcu-raw-note">{{ t("progression.journal.lcuRawNote") }}</p>
          <pre v-if="showLcuRaw" class="lcu-raw-json">{{ lcuRawJson }}</pre>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.journal-page {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 1rem 1.25rem 2rem;
  background: #0f1419;
  color: #e8eaed;
}
.journal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}
.journal-header h2 {
  margin: 0 0 0.35rem;
  font-size: 1.25rem;
}
.journal-sub {
  margin: 0;
  color: #9aa0a6;
  font-size: 0.9rem;
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
.journal-empty {
  padding: 2rem;
  text-align: center;
  color: #9aa0a6;
  border: 1px dashed #2d3748;
  border-radius: 10px;
}
.journal-layout {
  display: grid;
  grid-template-columns: minmax(220px, 280px) 1fr;
  gap: 1rem;
  min-height: 400px;
}
.journal-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-height: 70vh;
  overflow: auto;
}
.journal-row {
  text-align: left;
  padding: 0.6rem 0.75rem;
  background: #151b24;
  border: 1px solid #2d3748;
  border-radius: 8px;
  color: #e8eaed;
  cursor: pointer;
}
.journal-row.active {
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
.journal-detail {
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
.metrics-section h4 {
  margin: 0 0 0.35rem;
  font-size: 0.9rem;
}
.metrics-note {
  margin: 0 0 0.75rem;
  font-size: 0.8rem;
  color: #9aa0a6;
}
.metric-group {
  margin-bottom: 0.85rem;
}
.metric-group h5 {
  margin: 0 0 0.35rem;
  font-size: 0.82rem;
  color: #8ab4f8;
}
.metrics-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}
.metrics-table th,
.metrics-table td {
  border: 1px solid #2d3748;
  padding: 0.3rem 0.5rem;
  text-align: left;
}
.metrics-table th {
  color: #9aa0a6;
  font-weight: 500;
  width: 55%;
}
.lcu-raw-section {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #0f1419;
  border: 1px dashed #5c4a1a;
  border-radius: 8px;
}
.lcu-raw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}
.lcu-raw-header h4 {
  margin: 0;
  font-size: 0.85rem;
  color: #fdd663;
}
.lcu-raw-actions {
  display: flex;
  gap: 0.5rem;
}
.btn-copy-lcu,
.btn-toggle-lcu {
  padding: 0.3rem 0.6rem;
  background: #2a2a1a;
  border: 1px solid #5c4a1a;
  border-radius: 6px;
  color: #fdd663;
  cursor: pointer;
  font-size: 0.78rem;
}
.lcu-raw-note {
  margin: 0 0 0.5rem;
  font-size: 0.78rem;
  color: #9aa0a6;
}
.copy-feedback {
  margin: 0 0 0.35rem;
  font-size: 0.78rem;
  color: #7ee787;
}
.lcu-raw-json {
  margin: 0;
  max-height: 320px;
  overflow: auto;
  padding: 0.65rem;
  background: #151b24;
  border: 1px solid #2d3748;
  border-radius: 6px;
  font-size: 0.72rem;
  line-height: 1.4;
  color: #c9d1d9;
  white-space: pre-wrap;
  word-break: break-word;
}
@media (max-width: 900px) {
  .journal-layout {
    grid-template-columns: 1fr;
  }
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
