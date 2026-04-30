<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CompanionBuildsPanelView, useBuildsFilter } from "@lelanation/builds-ui";
import type { ImageResolvers, RuneLookup, FilterRole } from "@lelanation/builds-ui";
import type { Build, Champion, Item, Role, SubBuild } from "@lelanation/shared-types";
import { apiBase } from "../config";
import { getFavoriteIds, toggleFavorite } from "../favorites";
import { getSettings, setSettings } from "../settings";
import { translate } from "../i18n";
import BuildDetailView from "./BuildDetailView.vue";
import type { CompanionConfig } from "../companionConfig";
import { pollRankedSoloDuoAndSubmit } from "../rankedMatchSubmit";
import { importBuildToLcu } from "../lcuBuildImport";

const builds = ref<Build[]>([]);
const loading = ref(true);
const activeTab = ref<"builds" | "mes-builds" | "favoris" | "settings">("builds");
const favoriteIds = ref<string[]>([]);
const detailBuild = ref<Build | null>(null);
const selectedSubIdxMap = ref<Record<string, number | null>>({});
const lcuOk = ref<boolean | null>(null);

const searchQuery = ref("");
const selectedRole = ref<FilterRole>(null);
const sortBy = ref<"recent" | "name">("recent");
const onlyUpToDate = ref(false);

const settings = ref(getSettings());
const showSettings = ref(false);

const currentGameVersion = ref("");
const runeMap = ref<Record<number, { name: string; icon: string }>>({});
const runePathMap = ref<Record<number, { name: string; icon: string }>>({});
const championMap = ref<Record<string, Champion>>({});
const itemMap = ref<Record<string, Item>>({});

const updateAvailable = ref(false);
const updateDismissed = ref(false);
const latestVersion = ref("");
const currentAppVersion = ref("");
const pendingUpdate = shallowRef<Update | null>(null);
const updateInstalling = ref(false);
const updateRestarting = ref(false);
const updateProgress = ref(0);
const updateError = ref("");

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const RANKED_SUBMIT_INTERVAL_MS = 3 * 60 * 1000;
let updateCheckTimer: ReturnType<typeof setInterval> | null = null;
let lcuPollTimer: ReturnType<typeof setInterval> | null = null;
let rankedSubmitTimer: ReturnType<typeof setInterval> | null = null;

const shareRankedDuoStats = ref(false);
const importInProgress = ref(false);
const importFeedback = ref("");
const importOk = ref(true);

function t(key: string, params?: Record<string, string | number>): string {
  return translate(settings.value.language, key, params);
}

const allRoles: Role[] = ["top", "jungle", "mid", "adc", "support"];
const roleOptions = computed(() =>
  allRoles.map((role) => ({
    value: role,
    label: role === "adc" ? "ADC" : role.charAt(0).toUpperCase() + role.slice(1),
    icon: `/icons/roles/${role === "adc" ? "bot" : role}.png`,
  }))
);
const sortOptions = computed(() => [
  { value: "recent", label: t("sort.recent") },
  { value: "name", label: t("sort.name") },
]);

const currentMajorMinor = computed(() => {
  const v = currentGameVersion.value;
  if (!v) return "";
  const parts = v.split(".");
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : v;
});

const baseBuildsFilter = useBuildsFilter(builds, {
  currentVersion: currentMajorMinor,
});

watch([searchQuery, selectedRole, sortBy, onlyUpToDate], ([q, role, sort, up]) => {
  baseBuildsFilter.searchQuery.value = q;
  baseBuildsFilter.selectedRole.value = role;
  baseBuildsFilter.sortBy.value = sort;
  baseBuildsFilter.onlyUpToDate.value = up;
}, { immediate: true });

const sortedBuilds = computed(() => baseBuildsFilter.filteredBuilds.value);

const favoriteBuilds = computed(() => {
  const ids = new Set(favoriteIds.value);
  return sortedBuilds.value.filter((b) => ids.has(b.id));
});

const displayedBuilds = computed(() => {
  if (activeTab.value === "favoris") return favoriteBuilds.value;
  return sortedBuilds.value;
});

const importedBuildIds = computed(() => new Set<string>());

const latestImageBase = computed(() => `${apiBase}/images/game/latest`);

function makeImageResolvers(): ImageResolvers {
  return {
    champion: (imageFull: string) => `${latestImageBase.value}/champion/${imageFull}`,
    item: (imageFull: string) => `${latestImageBase.value}/item/${imageFull}`,
    spell: (imageFull: string) => `${latestImageBase.value}/spell/${imageFull}`,
    championSpell: (championId: string, imageFull: string) =>
      `${latestImageBase.value}/champion-spell/${championId}/${imageFull}`,
    runePath: (icon: string) => {
      const filename = icon.split("/").pop() || icon;
      return `${latestImageBase.value}/rune/paths/${filename}`;
    },
    rune: (icon: string) => {
      const filename = icon.split("/").pop() || icon;
      return `${latestImageBase.value}/rune/runes/${filename}`;
    },
    shard: (shardId: number) => {
      const map: Record<number, string> = {
        5008: "adaptative.png",
        5005: "speed.png",
        5006: "move.png",
        5010: "move.png",
        5007: "cdr.png",
        5001: "growth.png",
        5002: "growth.png",
        5011: "hp.png",
        5003: "tenacity.png",
        5013: "tenacity.png",
      };
      const file = map[shardId];
      return file ? `/icons/shards/${file}` : "";
    },
    role: (role: string) => `/icons/roles/${role === "adc" ? "bot" : role}.png`,
  };
}

function makeRuneLookup(): RuneLookup {
  return {
    getRuneIcon: (runeId: number) => {
      const rune = runeMap.value[runeId];
      if (!rune?.icon) return "";
      const filename = rune.icon.split("/").pop() || rune.icon;
      return `${latestImageBase.value}/rune/runes/${filename}`;
    },
    getRuneName: (runeId: number) => runeMap.value[runeId]?.name || "",
    getPathIcon: (pathId: number) => {
      const path = runePathMap.value[pathId];
      if (!path?.icon) return "";
      const filename = path.icon.split("/").pop() || path.icon;
      return `${latestImageBase.value}/rune/paths/${filename}`;
    },
    getShardIcon: (shardId: number) => makeImageResolvers().shard(shardId),
  };
}

const imageResolvers = computed(() => makeImageResolvers());
const runeLookup = computed(() => makeRuneLookup());

function enrichBuild(build: Build): Build {
  const champs = championMap.value;
  const items = itemMap.value;
  let champion = build.champion;
  let buildItems = build.items ?? [];

  if (champion?.id && Object.keys(champs).length > 0) {
    const full = champs[champion.id];
    if (full) champion = full;
  }

  if (buildItems.length > 0 && Object.keys(items).length > 0) {
    buildItems = buildItems.map((item) => {
      const full = items[item.id];
      if (full && full.stats != null && full.gold?.total != null) return full;
      return item;
    });
  }

  return { ...build, champion: champion ?? build.champion, items: buildItems };
}

function enrichBuilds(raw: Build[]): Build[] {
  return raw.map(enrichBuild);
}

async function loadBuilds() {
  loading.value = true;
  try {
    const r = await fetch(`${apiBase}/api/builds`);
    if (r.ok) {
      builds.value = enrichBuilds((await r.json()) as Build[]);
    } else {
      builds.value = [];
    }
  } catch {
    builds.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadChampionCatalog() {
  try {
    const gameDataLang = settings.value.language === "en" ? "en_US" : "fr_FR";
    const r = await fetch(`${apiBase}/api/game-data/champions?lang=${gameDataLang}&full=true`);
    if (!r.ok) return;
    const payload = (await r.json()) as { data?: Record<string, Champion> };
    const data = payload.data ?? payload;
    const map: Record<string, Champion> = {};
    for (const [, champ] of Object.entries(data as Record<string, Champion>)) {
      if (champ?.id) map[champ.id] = champ;
    }
    championMap.value = map;
    if (builds.value.length > 0) builds.value = enrichBuilds(builds.value);
  } catch {
    championMap.value = {};
  }
}

async function loadCurrentGameVersion() {
  try {
    const r = await fetch(`${apiBase}/api/game-data/version`);
    if (!r.ok) return;
    const payload = (await r.json()) as { version?: string };
    currentGameVersion.value = typeof payload.version === "string" ? payload.version : "";
  } catch {
    currentGameVersion.value = "";
  }
}

async function loadItemCatalog() {
  try {
    const gameDataLang = settings.value.language === "en" ? "en_US" : "fr_FR";
    const r = await fetch(`${apiBase}/api/game-data/items?lang=${gameDataLang}`);
    if (!r.ok) return;
    const payload = (await r.json()) as { data?: Record<string, Item & { id?: string }> };
    const data = payload.data ?? payload;
    const map: Record<string, Item> = {};
    for (const [id, item] of Object.entries(data as Record<string, Item & { id?: string }>)) {
      if (item && id) map[id] = { ...item, id };
    }
    itemMap.value = map;
    if (builds.value.length > 0) builds.value = enrichBuilds(builds.value);
  } catch {
    itemMap.value = {};
  }
}

async function loadRuneCatalog() {
  try {
    const gameDataLang = settings.value.language === "en" ? "en_US" : "fr_FR";
    const r = await fetch(`${apiBase}/api/game-data/runes?lang=${gameDataLang}`);
    if (!r.ok) return;
    const paths = (await r.json()) as Array<{
      id: number;
      name: string;
      icon: string;
      slots: Array<{ runes: Array<{ id: number; name: string; icon: string }> }>;
    }>;
    const nextRunes: Record<number, { name: string; icon: string }> = {};
    const nextPaths: Record<number, { name: string; icon: string }> = {};
    for (const path of paths) {
      nextPaths[path.id] = { name: path.name, icon: path.icon };
      for (const slot of path.slots ?? []) {
        for (const rune of slot.runes ?? []) {
          nextRunes[rune.id] = { name: rune.name, icon: rune.icon };
        }
      }
    }
    runeMap.value = nextRunes;
    runePathMap.value = nextPaths;
  } catch {
    runeMap.value = {};
    runePathMap.value = {};
  }
}

function refreshFavorites() {
  favoriteIds.value = getFavoriteIds();
}

function onToggleFavorite(buildId: string) {
  toggleFavorite(buildId);
  refreshFavorites();
}

function isFavorite(buildId: string): boolean {
  return favoriteIds.value.includes(buildId);
}

function buildVersion(b: Build): string {
  return b.gameVersion || currentGameVersion.value || "";
}

function displayedBuildFor(b: Build): Build {
  const subIdx = selectedSubIdxMap.value[b.id] ?? null;
  if (subIdx === null) return b;
  const sub = b.subBuilds?.[subIdx] as SubBuild | undefined;
  if (!sub) return b;
  return {
    ...b,
    name: sub.title || b.name,
    items: sub.items,
    runes: sub.runes,
    shards: sub.shards,
    summonerSpells: sub.summonerSpells,
    skillOrder: sub.skillOrder,
    roles: sub.roles,
    tags: sub.tags !== undefined ? sub.tags : (b.tags ?? []),
    description: sub.description ?? b.description,
    gameVersion: sub.gameVersion || b.gameVersion,
  } as Build;
}

function onVariantChange(payload: { buildId: string; idx: number | null }) {
  selectedSubIdxMap.value = {
    ...selectedSubIdxMap.value,
    [payload.buildId]: payload.idx,
  };
}

async function pollLcu() {
  try {
    const res = await invoke<{ ok: boolean }>("get_lcu_connection");
    lcuOk.value = res.ok === true;
  } catch {
    lcuOk.value = false;
  }
}

async function checkForUpdates() {
  if (!settings.value.autoUpdate) return;
  try {
    const update = await check();
    if (update) {
      latestVersion.value = update.version;
      pendingUpdate.value = update;
      updateAvailable.value = true;
    }
  } catch {
    /* ignore */
  }
}

async function installUpdate() {
  const update = pendingUpdate.value;
  if (!update) return;
  updateInstalling.value = true;
  updateError.value = "";
  updateProgress.value = 0;
  try {
    await update.downloadAndInstall((event) => {
      if (event.event === "Progress" && event.data.chunkLength > 0) {
        updateProgress.value = Math.min(99, updateProgress.value + 1);
      }
    });
    updateProgress.value = 100;
    updateRestarting.value = true;
    await relaunch();
  } catch (e) {
    updateInstalling.value = false;
    updateRestarting.value = false;
    updateError.value = e instanceof Error ? e.message : String(e);
  }
}

function saveLang(lang: "fr" | "en") {
  settings.value = { ...settings.value, language: lang };
  setSettings({ language: lang });
  void loadChampionCatalog();
  void loadItemCatalog();
  void loadRuneCatalog();
  if (builds.value.length) builds.value = enrichBuilds(builds.value);
}

async function tryRankedMatchSubmit() {
  if (!shareRankedDuoStats.value || lcuOk.value !== true) return;
  await pollRankedSoloDuoAndSubmit(apiBase);
}

onMounted(async () => {
  await invoke("set_image_api_base", { base: apiBase }).catch(() => {});
  currentAppVersion.value = await getVersion();
  refreshFavorites();

  await Promise.all([
    loadCurrentGameVersion(),
    loadChampionCatalog(),
    loadItemCatalog(),
    loadRuneCatalog(),
    loadBuilds(),
  ]);

  try {
    const cfg = await invoke<CompanionConfig>("companion_get_config");
    shareRankedDuoStats.value = cfg.shareRankedDuoStats === true;
  } catch {
    shareRankedDuoStats.value = false;
  }

  void pollLcu();
  lcuPollTimer = setInterval(pollLcu, 15_000);

  void checkForUpdates();
  updateCheckTimer = setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);

  rankedSubmitTimer = setInterval(() => void tryRankedMatchSubmit(), RANKED_SUBMIT_INTERVAL_MS);
  void tryRankedMatchSubmit();
});

onUnmounted(() => {
  if (updateCheckTimer) clearInterval(updateCheckTimer);
  if (lcuPollTimer) clearInterval(lcuPollTimer);
  if (rankedSubmitTimer) clearInterval(rankedSubmitTimer);
});

const hasActiveFilters = computed(
  () =>
    !!searchQuery.value.trim() ||
    selectedRole.value !== null ||
    onlyUpToDate.value ||
    sortBy.value !== "recent"
);

function clearFilters() {
  searchQuery.value = "";
  selectedRole.value = null;
  onlyUpToDate.value = false;
  sortBy.value = "recent";
}

async function runImportToLcu(b: Build) {
  if (importInProgress.value) return;
  importFeedback.value = "";
  importOk.value = true;
  importInProgress.value = true;
  try {
    await importBuildToLcu(b);
    importOk.value = true;
    importFeedback.value = t("importSuccess");
  } catch (e) {
    importOk.value = false;
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "LCU_OFFLINE") importFeedback.value = t("importNeedClient");
    else if (msg === "NO_CHAMPION") importFeedback.value = t("importNeedChampion");
    else if (msg === "NOTHING_TO_IMPORT") importFeedback.value = t("importNothingToImport");
    else if (msg.startsWith("RUNES:")) importFeedback.value = t("importRunesFailed") + msg.slice(6);
    else if (msg.startsWith("ITEMS:")) importFeedback.value = t("importItemsFailed") + msg.slice(6);
    else importFeedback.value = msg;
  } finally {
    importInProgress.value = false;
  }
}

function onImportFromGrid(b: Build) {
  void runImportToLcu(displayedBuildFor(b));
}
</script>

<template>
  <div class="app-frame">
    <header class="top-bar">
      <div class="brand">
        <span class="brand-title">{{ t("onboarding.title") }}</span>
        <span class="subtitle">{{ t("subtitle") }}</span>
      </div>
      <div class="top-actions">
        <span class="lcu-pill" :data-ok="lcuOk === true ? '1' : '0'">
          {{
            lcuOk === null
              ? t("status.untested")
              : lcuOk
                ? t("status.connected")
                : t("status.disconnected")
          }}
        </span>
        <button type="button" class="icon-btn" :title="t('settings.more')" @click="showSettings = true">
          ⚙
        </button>
      </div>
    </header>

    <div v-if="updateAvailable && !updateDismissed" class="update-banner">
      <span v-if="updateRestarting">{{ t("update.restarting") }}</span>
      <span v-else-if="updateInstalling">{{ t("update.installing", { progress: updateProgress }) }}</span>
      <span v-else>{{ t("update.available", { version: latestVersion }) }}</span>
      <div class="update-actions">
        <button v-if="!updateInstalling" type="button" class="btn-sm" @click="installUpdate">
          {{ t("update.install") }}
        </button>
        <button type="button" class="btn-sm ghost" @click="updateDismissed = true">{{ t("update.dismiss") }}</button>
      </div>
      <p v-if="updateError" class="update-err">{{ t("update.error") }}: {{ updateError }}</p>
    </div>

    <CompanionBuildsPanelView
      :t="t"
      :active-tab="activeTab"
      companion-mode="public"
      :imported-builds-count="0"
      :favorite-count="favoriteIds.length"
      :loading="loading"
      :displayed-builds="displayedBuilds"
      :imported-build-ids="importedBuildIds"
      :search-query="searchQuery"
      :selected-role="selectedRole"
      :only-up-to-date="onlyUpToDate"
      :sort-by="sortBy"
      :has-active-filters="hasActiveFilters"
      :role-options="roleOptions"
      :sort-options="sortOptions"
      :image-resolvers="imageResolvers"
      :rune-lookup="runeLookup"
      :is-favorite="isFavorite"
      :build-version="buildVersion"
      @update:active-tab="activeTab = $event"
      @update:search-query="searchQuery = $event"
      @update:selected-role="selectedRole = $event"
      @update:only-up-to-date="onlyUpToDate = $event"
      @update:sort-by="sortBy = $event"
      @clear-filters="clearFilters"
      @toggle-favorite="onToggleFavorite"
      @open-detail="detailBuild = $event"
      @variant-change="onVariantChange"
      :lcu-ready="lcuOk === true"
      :import-in-progress="importInProgress"
      @import-to-lcu="onImportFromGrid"
    />

    <div
      v-if="detailBuild"
      class="overlay"
      @click.self="
        detailBuild = null;
        importFeedback = '';
      "
    >
      <div class="overlay-inner">
        <BuildDetailView
          :build="displayedBuildFor(detailBuild)"
          :image-resolvers="imageResolvers"
          :rune-lookup="runeLookup"
          :build-version="buildVersion"
          :t="t"
          :lcu-connected="lcuOk === true"
          :import-in-progress="importInProgress"
          @back="
            detailBuild = null;
            importFeedback = '';
          "
          @import-to-lcu="runImportToLcu"
        />
        <p v-if="importFeedback" class="import-feedback" :class="{ err: !importOk }">{{ importFeedback }}</p>
        <button type="button" class="site-link" @click="openUrl(`${apiBase}/builds`)">
          {{ t("detailViewOnSite") }}
        </button>
      </div>
    </div>

    <div v-if="showSettings" class="overlay" @click.self="showSettings = false">
      <div class="settings-panel">
        <h2>{{ t("settings.more") }}</h2>
        <label class="row check">
          <input
            type="checkbox"
            :checked="settings.importRunes"
            @change="
              settings.importRunes = ($event.target as HTMLInputElement).checked;
              setSettings({ importRunes: settings.importRunes });
            "
          />
          {{ t("settings.importRunes") }}
        </label>
        <label class="row check">
          <input
            type="checkbox"
            :checked="settings.importItems"
            @change="
              settings.importItems = ($event.target as HTMLInputElement).checked;
              setSettings({ importItems: settings.importItems });
            "
          />
          {{ t("settings.importItems") }}
        </label>
        <label class="row check">
          <input
            type="checkbox"
            :checked="settings.importSummonerSpells"
            @change="
              settings.importSummonerSpells = ($event.target as HTMLInputElement).checked;
              setSettings({ importSummonerSpells: settings.importSummonerSpells });
            "
          />
          {{ t("settings.importSpells") }}
        </label>
        <p class="hint-small">{{ t("settings.importBeforeLobby") }}</p>
        <label class="row">
          {{ t("settings.language") }}
          <select :value="settings.language" @change="saveLang(($event.target as HTMLSelectElement).value as 'fr' | 'en')">
            <option value="fr">FR</option>
            <option value="en">EN</option>
          </select>
        </label>
        <label class="row check">
          <input
            type="checkbox"
            :checked="settings.autoUpdate"
            @change="
              settings.autoUpdate = ($event.target as HTMLInputElement).checked;
              setSettings({ autoUpdate: settings.autoUpdate });
            "
          />
          {{ t("settings.autoUpdate") }}
        </label>
        <p class="ver">{{ t("settings.version") }}: v{{ currentAppVersion }}</p>
        <button type="button" class="btn-sm" @click="showSettings = false">{{ t("detailClose") }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-frame {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0.75rem 1rem 1.5rem;
}
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}
.brand-title {
  font-weight: 700;
  color: #c8aa6e;
  display: block;
}
.subtitle {
  font-size: 0.82rem;
  opacity: 0.88;
}
.top-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.lcu-pill {
  font-size: 0.78rem;
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  border: 1px solid rgba(200, 155, 60, 0.45);
  background: rgba(10, 30, 50, 0.6);
}
.lcu-pill[data-ok="1"] {
  border-color: rgba(80, 200, 120, 0.6);
  color: #b8f0c8;
}
.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid rgba(200, 155, 60, 0.5);
  background: rgba(10, 20, 40, 0.5);
  color: #f0e6d2;
  cursor: pointer;
}
.update-banner {
  margin-bottom: 0.75rem;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  border: 1px solid rgba(3, 151, 171, 0.5);
  background: rgba(3, 151, 171, 0.12);
  font-size: 0.88rem;
}
.update-actions {
  margin-top: 0.4rem;
  display: flex;
  gap: 0.5rem;
}
.btn-sm {
  padding: 0.35rem 0.65rem;
  border-radius: 6px;
  border: 1px solid rgba(200, 155, 60, 0.55);
  background: rgba(10, 40, 60, 0.7);
  color: #cdfafa;
  cursor: pointer;
  font-size: 0.82rem;
}
.btn-sm.ghost {
  background: transparent;
}
.update-err {
  color: #ff8a8a;
  font-size: 0.8rem;
  margin: 0.35rem 0 0;
}
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 1rem;
  overflow: auto;
}
.overlay-inner {
  margin-top: 1rem;
  max-width: 900px;
  width: 100%;
}
.site-link {
  display: block;
  margin: 0.5rem auto 0;
  text-align: center;
  color: #c89b3c;
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  font-size: 0.88rem;
}
.import-feedback {
  text-align: center;
  margin: 0.65rem 0 0;
  font-size: 0.86rem;
  color: #b8f0c8;
  padding: 0 0.5rem;
}
.import-feedback.err {
  color: #ffb4b4;
}
.settings-panel {
  margin-top: 3rem;
  background: rgba(15, 25, 45, 0.96);
  border: 1px solid rgba(200, 155, 60, 0.45);
  border-radius: 12px;
  padding: 1.25rem;
  max-width: 400px;
  width: 100%;
  color: #f0e6d2;
}
.settings-panel h2 {
  margin-top: 0;
}
.row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0.75rem 0;
  font-size: 0.88rem;
}
.row select {
  padding: 0.35rem;
  border-radius: 6px;
}
.row.check {
  flex-direction: row;
  align-items: center;
}
.ver {
  font-size: 0.82rem;
  opacity: 0.85;
}
.hint-small {
  font-size: 0.78rem;
  opacity: 0.82;
  margin: 0 0 0.5rem;
  line-height: 1.35;
}
</style>
