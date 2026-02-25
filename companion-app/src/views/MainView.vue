<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { apiBase } from "../config";
import { getFavoriteIds, toggleFavorite, isFavorite } from "../favorites";
import { getSettings, setSettings } from "../settings";
import { hasConsent } from "../consent";
import { getImportedBuilds, mergeImportedBuilds, clearImportedBuilds } from "../importedBuilds";
import { translate } from "../i18n";
import type { Build, Role, Champion, StoredBuild } from "@lelanation/shared-types";
import { BuildSheet } from "@lelanation/builds-ui";
import type { ImageResolvers, RuneLookup } from "@lelanation/builds-ui";

const builds = ref<Build[]>([]);
const loading = ref(true);
const activeTab = ref<"builds" | "mes-builds" | "favoris" | "settings">("builds");
const lcuConnected = ref(false);
const submitMessage = ref("");
const submitError = ref(false);
const favoriteIds = ref<string[]>([]);
const shortcutMessage = ref("");
const shortcutError = ref(false);
const currentGameVersion = ref("");
const runeMap = ref<Record<number, { name: string; icon: string }>>({});
const runePathMap = ref<Record<number, { name: string; icon: string }>>({});
const championMap = ref<Record<string, Champion>>({});
const lastSubmittedMatchId = ref("");
let autoSubmitTimer: ReturnType<typeof setInterval> | null = null;

const searchQuery = ref("");
const selectedRole = ref<Role | null>(null);
const sortBy = ref<"recent" | "name">("recent");
const onlyUpToDate = ref(false);

const linkCode = ref("");
const linkLoading = ref(false);
const linkMessage = ref("");
const linkError = ref(false);
const importedBuilds = ref<Build[]>([]);

const settings = ref(getSettings());

function t(key: string, params?: Record<string, string | number>): string {
  return translate(settings.value.language, key, params);
}

function saveSetting<K extends keyof typeof settings.value>(key: K, value: (typeof settings.value)[K]) {
  settings.value = { ...settings.value, [key]: value };
  setSettings({ [key]: value });
}

const canAutoSubmitMatch = computed(
  () => hasConsent() && settings.value.disableMatchSubmission !== true
);

const allRoles: Role[] = ["top", "jungle", "mid", "adc", "support"];

const currentMajorMinor = computed(() => {
  const v = currentGameVersion.value;
  if (!v) return "";
  const parts = v.split(".");
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : v;
});

const sortedBuilds = computed(() => {
  let list = [...builds.value];
  if (onlyUpToDate.value && currentMajorMinor.value) {
    const prefix = currentMajorMinor.value;
    list = list.filter((b) => (b.gameVersion ?? "").startsWith(prefix));
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase();
    list = list.filter(
      (b) =>
        (b.name || "").toLowerCase().includes(q) ||
        (b.author || "").toLowerCase().includes(q) ||
        (b.champion?.name || "").toLowerCase().includes(q)
    );
  }
  if (selectedRole.value) {
    const r = selectedRole.value;
    list = list.filter((b) => Array.isArray(b.roles) && b.roles.includes(r));
  }
  if (sortBy.value === "name") {
    list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } else {
    list.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  }
  return list;
});

const favoriteBuilds = computed(() => {
  const ids = new Set(favoriteIds.value);
  return sortedBuilds.value.filter((b) => ids.has(b.id));
});

const myImportedBuilds = computed(() => {
  let list = [...importedBuilds.value] as Build[];
  if (onlyUpToDate.value && currentMajorMinor.value) {
    const prefix = currentMajorMinor.value;
    list = list.filter((b) => (b.gameVersion ?? "").startsWith(prefix));
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase();
    list = list.filter(
      (b) =>
        (b.name || "").toLowerCase().includes(q) ||
        (b.author || "").toLowerCase().includes(q) ||
        (b.champion?.name || "").toLowerCase().includes(q)
    );
  }
  if (selectedRole.value) {
    const r = selectedRole.value;
    list = list.filter((b) => Array.isArray(b.roles) && b.roles.includes(r));
  }
  if (sortBy.value === "name") {
    list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } else {
    list.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  }
  return list;
});

const displayedBuilds = computed(() => {
  if (activeTab.value === "favoris") return favoriteBuilds.value;
  if (activeTab.value === "mes-builds") return myImportedBuilds.value;
  return sortedBuilds.value;
});

const importedBuildIds = computed(() => new Set(importedBuilds.value.map(b => b.id)));

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
        5007: "cdr.png",
        5001: "hp.png",
        5002: "growth.png",
        5003: "tenacity.png",
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
    getShardIcon: (shardId: number) => {
      const map: Record<number, string> = {
        5008: "adaptative.png",
        5005: "speed.png",
        5007: "cdr.png",
        5001: "hp.png",
        5002: "growth.png",
        5003: "tenacity.png",
      };
      const file = map[shardId];
      return file ? `/icons/shards/${file}` : "";
    },
  };
}

const imageResolvers = computed(() => makeImageResolvers());
const runeLookup = computed(() => makeRuneLookup());

function enrichBuilds(rawBuilds: Build[]): Build[] {
  const champs = championMap.value;
  if (Object.keys(champs).length === 0) return rawBuilds;
  return rawBuilds.map((b) => {
    if (!b.champion?.id || b.champion.spells?.length) return b;
    const full = champs[b.champion.id];
    if (!full) return b;
    return { ...b, champion: full };
  });
}

async function loadBuilds() {
  loading.value = true;
  try {
    const r = await fetch(`${apiBase}/api/builds`);
    if (r.ok) {
      builds.value = enrichBuilds((await r.json()) as Build[]);
      return;
    }
    builds.value = [];
  } catch {
    builds.value = [];
  } finally {
    loading.value = false;
  }
}

function loadImportedBuilds() {
  const stored = getImportedBuilds();
  importedBuilds.value = stored.map(s => s as unknown as Build);
}

async function linkBuildsFromCode() {
  const code = linkCode.value.trim().toUpperCase();
  if (!code) return;
  linkLoading.value = true;
  linkMessage.value = "";
  linkError.value = false;
  try {
    const r = await fetch(`${apiBase}/api/share-builds/${encodeURIComponent(code)}`);
    if (!r.ok) {
      linkMessage.value = r.status === 404 ? t('settings.linkNotFound') : t('settings.linkServerError');
      linkError.value = true;
      return;
    }
    const payload = (await r.json()) as { builds: StoredBuild[] };
    const count = mergeImportedBuilds(payload.builds);
    loadImportedBuilds();
    linkCode.value = "";
    linkMessage.value = count > 0
      ? t(count > 1 ? 'settings.linkSuccessPlural' : 'settings.linkSuccess', { count })
      : t('settings.linkUpToDate');
    linkError.value = false;
  } catch {
    linkMessage.value = t('settings.linkNetworkError');
    linkError.value = true;
  } finally {
    linkLoading.value = false;
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
    if (builds.value.length > 0) {
      builds.value = enrichBuilds(builds.value);
    }
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

function toggleFav(id: string) {
  toggleFavorite(id);
  refreshFavorites();
}

function toggleRole(role: Role) {
  selectedRole.value = selectedRole.value === role ? null : role;
}

function clearFilters() {
  searchQuery.value = "";
  selectedRole.value = null;
  sortBy.value = "recent";
  onlyUpToDate.value = false;
}

const hasActiveFilters = computed(
  () => searchQuery.value.trim() !== "" || selectedRole.value !== null || sortBy.value !== "recent" || onlyUpToDate.value
);

function buildVersion(build: Build): string {
  return build.gameVersion?.trim() || currentGameVersion.value;
}

function saveLanguage(lang: string) {
  saveSetting("language", lang === "en" ? "en" : "fr");
}

async function checkLcu() {
  try {
    const res = await invoke<{ ok: boolean }>("get_lcu_connection");
    lcuConnected.value = res.ok;
  } catch {
    lcuConnected.value = false;
  }
}

async function autoSubmitMatchIfAllowed() {
  if (!canAutoSubmitMatch.value) return;
  try {
    const gamesJson = await invoke<string>("lcu_request", {
      method: "GET",
      path: "/lol-match-history/v1/games",
      body: null,
    });
    const list = JSON.parse(gamesJson) as
      | { games?: Array<{ gameId?: number; platformId?: string }> }
      | Array<{ gameId?: number; platformId?: string }>;
    const games = Array.isArray(list) ? list : list?.games ?? [];
    const last = games[0];
    if (!last?.gameId) return;

    const region = (last.platformId || "euw1").toLowerCase();
    const matchId = last.platformId ? `${last.platformId}_${last.gameId}` : String(last.gameId);
    if (lastSubmittedMatchId.value === matchId) return;

    const r = await fetch(`${apiBase}/api/app/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, region }),
    });

    if (!r.ok) return;
    const data = (await r.json()) as { inserted?: boolean };
    lastSubmittedMatchId.value = matchId;
    submitError.value = false;
    submitMessage.value = data.inserted ? t('match.autoSent') : t('match.alreadyKnown');
  } catch {
    /* silent */
  }
}

function startAutoSubmitLoop() {
  if (autoSubmitTimer) return;
  autoSubmitTimer = setInterval(() => autoSubmitMatchIfAllowed(), 60000);
}

function stopAutoSubmitLoop() {
  if (!autoSubmitTimer) return;
  clearInterval(autoSubmitTimer);
  autoSubmitTimer = null;
}

async function createDesktopShortcut() {
  shortcutMessage.value = "";
  shortcutError.value = false;
  try {
    const res = await invoke<{ ok: boolean; message: string }>("create_desktop_shortcut");
    shortcutMessage.value = res?.message || t('shortcut.created');
    shortcutError.value = !res?.ok;
  } catch (e) {
    shortcutMessage.value = e instanceof Error ? e.message : t('shortcut.error');
    shortcutError.value = true;
  }
}

onMounted(async () => {
  loadCurrentGameVersion();
  loadRuneCatalog();
  loadImportedBuilds();
  await loadChampionCatalog();
  loadBuilds();
  refreshFavorites();
  checkLcu();
  autoSubmitMatchIfAllowed();
  startAutoSubmitLoop();
});

onUnmounted(() => {
  stopAutoSubmitLoop();
});

watch(
  () => settings.value.disableMatchSubmission,
  (disabled) => {
    if (disabled) {
      submitMessage.value = t('settings.autoOff');
      submitError.value = false;
      return;
    }
    if (hasConsent()) {
      submitMessage.value = t('settings.autoOn');
      submitError.value = false;
      autoSubmitMatchIfAllowed();
    }
  }
);

watch(
  () => settings.value.language,
  async () => {
    loadRuneCatalog();
    await loadChampionCatalog();
  }
);
</script>

<template>
  <div class="main-shell">
    <header class="header-card">
      <div>
        <h1 class="title">Lelanation Companion</h1>
        <p class="subtitle">{{ t('subtitle') }}</p>
      </div>
      <span class="status-pill" :class="{ on: lcuConnected, off: !lcuConnected }">
        {{ lcuConnected ? t('status.connected') : t('status.disconnected') }}
      </span>
    </header>

    <nav class="tabs">
      <button class="tab-btn" :class="{ active: activeTab === 'builds' }" @click="activeTab = 'builds'">
        {{ t('tabs.discover') }}
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'mes-builds' }"
        :disabled="importedBuilds.length === 0"
        @click="activeTab = 'mes-builds'"
      >
        {{ t('tabs.myBuilds') }} ({{ importedBuilds.length }})
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'favoris' }"
        :disabled="favoriteIds.length === 0"
        @click="activeTab = 'favoris'"
      >
        {{ t('tabs.favorites') }} ({{ favoriteIds.length }})
      </button>
      <button class="tab-btn" :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'">
        {{ t('tabs.settings') }}
      </button>
    </nav>

    <!-- Filters -->
    <div v-if="activeTab !== 'settings'" class="filters-bar">
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        :placeholder="t('search')"
      />
      <div class="role-filters">
        <button
          v-for="role in allRoles"
          :key="role"
          type="button"
          :class="['role-chip', { active: selectedRole === role }]"
          @click="toggleRole(role)"
        >
          <img :src="`/icons/roles/${role === 'adc' ? 'bot' : role}.png`" :alt="role" class="role-chip-img" />
          <span>{{ role === 'adc' ? 'ADC' : role.charAt(0).toUpperCase() + role.slice(1) }}</span>
        </button>
      </div>
      <label class="uptodate-label">
        <input v-model="onlyUpToDate" type="checkbox" class="uptodate-check" />
        <span>{{ t('upToDate') }}</span>
      </label>
      <div class="sort-row">
        <label class="sort-label">{{ t('sort.label') }}</label>
        <select v-model="sortBy" class="sort-select">
          <option value="recent">{{ t('sort.recent') }}</option>
          <option value="name">{{ t('sort.name') }}</option>
        </select>
        <button v-if="hasActiveFilters" class="clear-btn" @click="clearFilters">{{ t('clearFilters') }}</button>
      </div>
    </div>

    <section v-if="activeTab !== 'settings'" class="panel">
      <p v-if="activeTab === 'builds' && loading" class="empty">{{ t('loading') }}</p>
      <p v-else-if="activeTab === 'mes-builds' && importedBuilds.length === 0" class="empty">
        {{ t('noImported') }}
      </p>
      <p v-else-if="displayedBuilds.length === 0" class="empty">
        {{ activeTab === "favoris" ? t('noFavorites') : t('noBuilds') }}
      </p>

      <div v-else class="build-grid">
        <div v-for="b in displayedBuilds" :key="b.id" class="build-entry">
          <div class="build-meta">
            <h3 class="author">
              {{ b.author || t('authorUnknown') }}
              <span v-if="importedBuildIds.has(b.id)" class="perso-badge">{{ t('badge.personal') }}</span>
            </h3>
            <span class="build-name">{{ b.name || b.id }}</span>
          </div>
          <BuildSheet :build="b" :images="imageResolvers" :rune-lookup="runeLookup" :version="buildVersion(b)" />
          <div class="card-actions">
            <button
              type="button"
              class="bookmark-btn"
              :class="{ on: isFavorite(b.id) }"
              :title="isFavorite(b.id) ? t('favorite.remove') : t('favorite.add')"
              @click="toggleFav(b.id)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                :fill="isFavorite(b.id) ? 'currentColor' : 'none'"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="bookmark-icon"
                aria-hidden="true"
              >
                <path d="M6 3.75A1.75 1.75 0 0 1 7.75 2h8.5A1.75 1.75 0 0 1 18 3.75V22l-6-3.5L6 22V3.75Z" />
              </svg>
            </button>
            <button type="button" class="import-btn" :disabled="!lcuConnected" :title="t('import')">
              {{ t('import') }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <section v-else class="panel settings-panel">
      <h3>{{ t('settings.language') }}</h3>
      <label class="row row-inline">
        <span>{{ t('settings.language') }}</span>
        <select
          class="language-select"
          :value="settings.language"
          @change="saveLanguage(($event.target as HTMLSelectElement).value)"
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </label>

      <h3>{{ t('settings.clientImport') }}</h3>
      <label class="row">
        <input
          type="checkbox"
          :checked="settings.importRunes"
          @change="saveSetting('importRunes', ($event.target as HTMLInputElement).checked)"
        />
        {{ t('settings.importRunes') }}
      </label>
      <label class="row">
        <input
          type="checkbox"
          :checked="settings.importItems"
          @change="saveSetting('importItems', ($event.target as HTMLInputElement).checked)"
        />
        {{ t('settings.importItems') }}
      </label>
      <label class="row">
        <input
          type="checkbox"
          :checked="settings.importSummonerSpells"
          @change="saveSetting('importSummonerSpells', ($event.target as HTMLInputElement).checked)"
        />
        {{ t('settings.importSpells') }}
      </label>

      <h3 class="mt">{{ t('settings.matchSubmit') }}</h3>
      <label class="row">
        <input
          type="checkbox"
          :checked="settings.disableMatchSubmission"
          @change="saveSetting('disableMatchSubmission', ($event.target as HTMLInputElement).checked)"
        />
        {{ t('settings.disableMatch') }}
      </label>
      <p class="hint-line">
        {{ canAutoSubmitMatch ? t('settings.autoOn') : t('settings.autoOff') }}
      </p>
      <p v-if="submitMessage" :class="{ error: submitError }" class="msg">{{ submitMessage }}</p>

      <h3 class="mt">{{ t('settings.linkTitle') }}</h3>
      <p class="hint-line">{{ t('settings.linkHint') }}</p>
      <div class="link-row">
        <input
          v-model="linkCode"
          type="text"
          class="link-input"
          :placeholder="t('settings.linkPlaceholder')"
          maxlength="10"
          @keyup.enter="linkBuildsFromCode"
        />
        <button
          type="button"
          class="submit-btn"
          :disabled="linkLoading || !linkCode.trim()"
          @click="linkBuildsFromCode"
        >
          {{ linkLoading ? t('settings.linkLoading') : t('settings.linkImport') }}
        </button>
      </div>
      <p v-if="linkMessage" :class="{ error: linkError }" class="msg">{{ linkMessage }}</p>
      <button
        v-if="importedBuilds.length > 0"
        type="button"
        class="clear-link-btn"
        @click="clearImportedBuilds(); loadImportedBuilds();"
      >
        {{ t('settings.clearImported', { count: importedBuilds.length }) }}
      </button>

      <h3 class="mt">{{ t('settings.shortcut') }}</h3>
      <button type="button" class="submit-btn" @click="createDesktopShortcut">
        {{ t('settings.createShortcut') }}
      </button>
      <p v-if="shortcutMessage" :class="{ error: shortcutError }" class="msg">{{ shortcutMessage }}</p>
    </section>
  </div>
</template>

<style scoped>
.main-shell {
  max-width: 1320px;
  margin: 0 auto;
  padding: 1rem;
  color: #f0e6d2;
}

.header-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid rgba(200, 155, 60, 0.35);
  border-radius: 10px;
  background: rgba(10, 20, 40, 0.58);
  margin-bottom: 0.9rem;
}

.title { margin: 0; font-size: 1.15rem; line-height: 1.35; }
.subtitle { margin: 0.2rem 0 0; color: rgba(240, 230, 210, 0.8); font-size: 0.88rem; }

.status-pill { border-radius: 999px; padding: 0.35rem 0.65rem; font-size: 0.76rem; font-weight: 600; white-space: nowrap; }
.status-pill.on { background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.6); color: #93f2ce; }
.status-pill.off { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.6); color: #fecaca; }

.tabs { display: flex; gap: 0.5rem; margin-bottom: 0.9rem; }
.tab-btn {
  border: 1px solid rgba(200, 155, 60, 0.5); border-radius: 8px;
  background: rgba(30, 40, 45, 0.75); color: #f0e6d2; padding: 0.45rem 0.75rem;
  font-size: 0.84rem; cursor: pointer; transition: background-color 0.15s ease;
}
.tab-btn:hover:not(:disabled) { background: rgba(0, 90, 130, 0.55); }
.tab-btn.active { background: rgba(200, 155, 60, 0.18); border-color: #c89b3c; }
.tab-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Filters */
.filters-bar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;
  margin-bottom: 1rem; padding: 0.75rem; border-radius: 10px;
  border: 1px solid rgba(200, 155, 60, 0.2); background: rgba(10, 20, 40, 0.35);
}
.search-input {
  flex: 1 1 200px; min-width: 180px; background: rgba(9, 20, 40, 0.95);
  color: #f0e6d2; border: 1px solid rgba(200, 155, 60, 0.45); border-radius: 8px;
  padding: 0.4rem 0.65rem; font-size: 0.82rem;
}
.search-input::placeholder { color: rgba(240, 230, 210, 0.45); }
.role-filters { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.role-chip {
  display: inline-flex; align-items: center; gap: 0.3rem;
  border: 1px solid rgba(200, 155, 60, 0.4); border-radius: 999px;
  padding: 0.2rem 0.55rem; font-size: 0.72rem; cursor: pointer;
  background: rgba(30, 40, 45, 0.6); color: #c8aa6e; transition: all 0.15s;
}
.role-chip.active { border-color: #c89b3c; background: rgba(200, 155, 60, 0.2); color: #f0e6d2; }
.role-chip:hover { border-color: #c89b3c; background: rgba(200, 155, 60, 0.1); }
.role-chip-img { width: 14px; height: 14px; object-fit: contain; }
.uptodate-label {
  display: inline-flex; align-items: center; gap: 0.35rem;
  font-size: 0.78rem; color: #f0e6d2; cursor: pointer; white-space: nowrap;
}
.uptodate-check {
  accent-color: #c89b3c; width: 14px; height: 14px; cursor: pointer;
}
.sort-row { display: flex; align-items: center; gap: 0.5rem; }
.sort-label { font-size: 0.78rem; color: rgba(240, 230, 210, 0.7); }
.sort-select {
  background: rgba(9, 20, 40, 0.95); color: #f0e6d2;
  border: 1px solid rgba(200, 155, 60, 0.45); border-radius: 6px;
  padding: 0.25rem 0.4rem; font-size: 0.78rem;
}
.clear-btn {
  font-size: 0.72rem; padding: 0.25rem 0.5rem; border-radius: 6px;
  border: 1px solid rgba(200, 155, 60, 0.35); background: rgba(30, 40, 45, 0.5);
  color: #c8aa6e; cursor: pointer;
}
.clear-btn:hover { background: rgba(200, 155, 60, 0.15); }

.panel { min-height: 260px; }
.empty { color: rgba(240, 230, 210, 0.85); }

.build-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
  justify-items: center;
}

.build-entry {
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
}

.build-meta {
  width: 300px; text-align: center;
}

.author { margin: 0; color: #f0e6d2; font-size: 0.94rem; font-weight: 600; display: flex; align-items: center; gap: 0.4rem; }
.perso-badge {
  font-size: 0.6rem; font-weight: 700; text-transform: uppercase;
  background: rgba(200, 155, 60, 0.25); color: #c89b3c;
  border: 1px solid rgba(200, 155, 60, 0.5); border-radius: 4px;
  padding: 0.05rem 0.35rem; letter-spacing: 0.04em;
}
.build-name { color: rgba(200, 170, 110, 0.95); font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.bookmark-btn {
  width: 1.5rem; height: 1.5rem; flex: 0 0 1.5rem;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 4px; cursor: pointer; transition: all 0.15s;
  border: 1px solid rgba(200, 155, 60, 0.5); background: transparent; color: #b38b00;
}
.bookmark-btn.on { color: #e6b800; background: rgba(200, 155, 60, 0.15); border-color: #e6b800; }
.bookmark-btn:hover { background: rgba(200, 155, 60, 0.1); }
.bookmark-icon { width: 0.75rem; height: 0.75rem; }

.card-actions {
  display: flex; justify-content: flex-end; align-items: center; gap: 0.5rem; width: 300px;
}

.import-btn, .submit-btn {
  border: 1px solid rgba(3, 151, 171, 0.8); border-radius: 7px;
  background: rgba(10, 50, 60, 0.8); color: #cdfafa; cursor: pointer;
  padding: 0.38rem 0.7rem; font-size: 0.8rem;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.import-btn:hover:not(:disabled), .submit-btn:hover {
  background: rgba(3, 151, 171, 0.35); border-color: rgba(10, 200, 185, 0.9);
}
.import-btn:disabled { opacity: 0.45; cursor: not-allowed; }

/* Settings */
.settings-panel {
  border: 1px solid rgba(200, 155, 60, 0.35); border-radius: 10px;
  padding: 1rem; background: rgba(10, 20, 40, 0.58);
}
.settings-panel h3 { margin: 0; font-size: 0.98rem; color: #f0e6d2; }
.row { display: flex; align-items: center; gap: 0.5rem; margin: 0.6rem 0; cursor: pointer; color: rgba(240, 230, 210, 0.92); font-size: 0.86rem; }
.row-inline { justify-content: space-between; }
.language-select { background: rgba(9, 20, 40, 0.95); color: #f0e6d2; border: 1px solid rgba(200, 155, 60, 0.55); border-radius: 6px; padding: 0.2rem 0.45rem; }
.mt { margin-top: 1.3rem; }
.msg { margin-top: 0.5rem; font-size: 0.85rem; color: #93f2ce; }
.msg.error { color: #fecaca; }
.hint-line { margin-top: 0.3rem; font-size: 0.78rem; color: rgba(240, 230, 210, 0.6); }

.link-row {
  display: flex; align-items: center; gap: 0.5rem; margin-top: 0.6rem;
}
.link-input {
  flex: 1; max-width: 180px;
  background: rgba(9, 20, 40, 0.95); color: #f0e6d2;
  border: 1px solid rgba(200, 155, 60, 0.55); border-radius: 6px;
  padding: 0.35rem 0.55rem; font-size: 0.86rem;
  font-family: monospace; letter-spacing: 0.12em; text-transform: uppercase;
}
.link-input::placeholder { text-transform: none; letter-spacing: normal; color: rgba(240, 230, 210, 0.35); }
.clear-link-btn {
  margin-top: 0.5rem; border: none; background: transparent;
  color: rgba(254, 202, 202, 0.8); cursor: pointer; font-size: 0.78rem;
  text-decoration: underline; padding: 0;
}
.clear-link-btn:hover { color: #fecaca; }

@media (max-width: 660px) {
  .header-card { flex-direction: column; align-items: flex-start; }
  .build-grid { grid-template-columns: 1fr; }
}
</style>
