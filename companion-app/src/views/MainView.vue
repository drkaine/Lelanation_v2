<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { apiBase } from "../config";
import { getFavoriteIds, toggleFavorite, isFavorite } from "../favorites";
import { getSettings, setSettings } from "../settings";
import { hasConsent } from "../consent";

type Build = {
  id: string;
  name?: string;
  author?: string;
  description?: string;
  createdAt?: string;
  gameVersion?: string;
  champion?: {
    id?: string;
    name?: string;
    image?: { full?: string };
  } | null;
  roles?: string[];
  items?: Array<{ id?: string; name?: string; image?: { full?: string } }>;
  summonerSpells?: Array<{ id?: string; name?: string; image?: { full?: string } } | null>;
  runes?: {
    primary?: { pathId?: number; keystone?: number; slot1?: number; slot2?: number; slot3?: number };
    secondary?: { pathId?: number; slot1?: number; slot2?: number };
  } | null;
  shards?: { slot1?: number; slot2?: number; slot3?: number } | null;
  skillOrder?: { firstThreeUps?: string[]; skillUpOrder?: string[] } | null;
};

const builds = ref<Build[]>([]);
const loading = ref(true);
const activeTab = ref<"builds" | "favoris" | "settings">("builds");
const lcuConnected = ref(false);
const submitMessage = ref("");
const submitError = ref(false);
const favoriteIds = ref<string[]>([]);
const shortcutMessage = ref("");
const shortcutError = ref(false);
const currentGameVersion = ref("");
const championImageFallbackIndex = ref<Record<string, number>>({});
const runeMap = ref<Record<number, { name: string; icon: string }>>({});
const runePathMap = ref<Record<number, { name: string; icon: string }>>({});
const lastSubmittedMatchId = ref("");
let autoSubmitTimer: ReturnType<typeof setInterval> | null = null;

const settings = ref(getSettings());
function saveSetting<K extends keyof typeof settings.value>(key: K, value: (typeof settings.value)[K]) {
  settings.value = { ...settings.value, [key]: value };
  setSettings({ [key]: value });
}

const canAutoSubmitMatch = computed(
  () => hasConsent() && settings.value.disableMatchSubmission !== true
);

const sortedBuilds = computed(() =>
  [...builds.value].sort((a, b) => {
    const aDate = new Date(a.createdAt ?? 0).getTime();
    const bDate = new Date(b.createdAt ?? 0).getTime();
    return bDate - aDate;
  })
);

const favoriteBuilds = computed(() => {
  const ids = new Set(favoriteIds.value);
  return sortedBuilds.value.filter((b) => ids.has(b.id));
});

const displayedBuilds = computed(() =>
  activeTab.value === "favoris" ? favoriteBuilds.value : sortedBuilds.value
);

async function loadBuilds() {
  loading.value = true;
  try {
    const r = await fetch(`${apiBase}/api/builds`);
    if (r.ok) {
      builds.value = (await r.json()) as Build[];
      championImageFallbackIndex.value = {};
      return;
    }
    builds.value = [];
  } catch {
    builds.value = [];
  } finally {
    loading.value = false;
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

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    top: "Top",
    jungle: "Jungle",
    mid: "Mid",
    adc: "ADC",
    support: "Support",
  };
  return map[role] ?? role;
}

function formatDate(date?: string): string {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";
  const locale = settings.value.language === "en" ? "en-US" : "fr-FR";
  return parsed.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
}

function saveLanguage(lang: string) {
  const normalized = lang === "en" ? "en" : "fr";
  saveSetting("language", normalized);
}

function buildVersion(build: Build): string {
  const own = build.gameVersion?.trim();
  if (own) return own;
  return currentGameVersion.value;
}

const latestImageBase = computed(() => `${apiBase}/images/game/latest`);

function championImageCandidates(build: Build): string[] {
  const candidates: string[] = [];
  const imageFull = build.champion?.image?.full?.trim();
  const championId = build.champion?.id?.trim();
  if (imageFull) candidates.push(`${latestImageBase.value}/champion/${imageFull}`);
  if (championId) candidates.push(`${latestImageBase.value}/champion/${championId}.png`);
  return [...new Set(candidates)];
}

function championImageUrl(build: Build): string | null {
  const candidates = championImageCandidates(build);
  if (candidates.length === 0) return null;
  const fallbackIndex = championImageFallbackIndex.value[build.id] ?? 0;
  return candidates[Math.min(fallbackIndex, candidates.length - 1)] ?? null;
}

function onChampionImageError(build: Build) {
  const candidates = championImageCandidates(build);
  if (candidates.length <= 1) return;
  const currentIdx = championImageFallbackIndex.value[build.id] ?? 0;
  if (currentIdx < candidates.length - 1) {
    championImageFallbackIndex.value = {
      ...championImageFallbackIndex.value,
      [build.id]: currentIdx + 1,
    };
  }
}

function championFallback(build: Build): string {
  const name = (build.champion?.name ?? "").trim();
  return name ? name.slice(0, 2).toUpperCase() : "?";
}

function spellImageUrl(build: Build, imageFull?: string): string {
  void build
  if (!imageFull) return "";
  return `${latestImageBase.value}/spell/${imageFull}`;
}

function itemImageUrl(build: Build, imageFull?: string, itemId?: string): string {
  void build
  const full = imageFull?.trim() || (itemId ? `${itemId}.png` : "");
  if (!full) return "";
  return `${latestImageBase.value}/item/${full}`;
}

function runeImageUrl(build: Build, runeId?: number): string {
  if (!runeId) return "";
  void build
  const rune = runeMap.value[runeId];
  if (!rune?.icon) return "";
  const filename = rune.icon.split("/").pop() || rune.icon;
  return `${latestImageBase.value}/rune/runes/${filename}`;
}

function runePathImageUrl(build: Build, pathId?: number): string {
  if (!pathId) return "";
  void build
  const path = runePathMap.value[pathId];
  if (!path?.icon) return "";
  const filename = path.icon.split("/").pop() || path.icon;
  return `${latestImageBase.value}/rune/paths/${filename}`;
}

function shardIconUrl(shardId?: number): string {
  const map: Record<number, string> = {
    5008: "adaptative.png",
    5005: "speed.png",
    5007: "cdr.png",
    5001: "hp.png",
    5002: "growth.png",
    5003: "tenacity.png",
  };
  const file = shardId ? map[shardId] : null;
  return file ? `${apiBase}/icons/shards/${file}` : "";
}

function normalizedSummonerSpells(build: Build) {
  const spells = Array.isArray(build.summonerSpells) ? build.summonerSpells : [];
  return spells.filter(Boolean).slice(0, 2) as Array<{ id?: string; name?: string; image?: { full?: string } }>;
}

function normalizedItems(build: Build) {
  return Array.isArray(build.items) ? build.items : [];
}

function primaryRuneIds(build: Build): number[] {
  const p = build.runes?.primary;
  const ids = [p?.keystone, p?.slot1, p?.slot2, p?.slot3].map((x) => Number(x || 0)).filter((x) => x > 0);
  return ids;
}

function secondaryRuneIds(build: Build): number[] {
  const s = build.runes?.secondary;
  const ids = [s?.slot1, s?.slot2].map((x) => Number(x || 0)).filter((x) => x > 0);
  return ids;
}

function shardIds(build: Build): number[] {
  const s = build.shards;
  return [s?.slot1, s?.slot2, s?.slot3].map((x) => Number(x || 0)).filter((x) => x > 0);
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
    submitMessage.value = data.inserted ? "Match envoye automatiquement." : "Match deja connu.";
  } catch {
    // Silent auto mode: keep UI usable even if LCU/server unavailable.
  }
}

function startAutoSubmitLoop() {
  if (autoSubmitTimer) return;
  autoSubmitTimer = setInterval(() => {
    autoSubmitMatchIfAllowed();
  }, 60000);
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
    shortcutMessage.value = res?.message || "Raccourci cree.";
    shortcutError.value = !res?.ok;
  } catch (e) {
    shortcutMessage.value = e instanceof Error ? e.message : "Impossible de creer le raccourci.";
    shortcutError.value = true;
  }
}

onMounted(() => {
  loadBuilds();
  loadCurrentGameVersion();
  loadRuneCatalog();
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
      submitMessage.value = "Envoi auto desactive.";
      submitError.value = false;
      return;
    }
    if (hasConsent()) {
      submitMessage.value = "Envoi auto active.";
      submitError.value = false;
      autoSubmitMatchIfAllowed();
    }
  }
);

watch(
  () => settings.value.language,
  () => {
    loadRuneCatalog();
  }
);
</script>

<template>
  <div class="main-shell">
    <header class="header-card">
      <div>
        <h1 class="title">Lelanation Companion</h1>
        <p class="subtitle">Les memes builds que sur la page Builds, avec import local et favoris.</p>
      </div>
      <span class="status-pill" :class="{ on: lcuConnected, off: !lcuConnected }">
        {{ lcuConnected ? "Client LoL connecte" : "Client LoL non detecte" }}
      </span>
    </header>

    <nav class="tabs">
      <button class="tab-btn" :class="{ active: activeTab === 'builds' }" @click="activeTab = 'builds'">
        Decouvrir
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'favoris' }"
        :disabled="favoriteIds.length === 0"
        @click="activeTab = 'favoris'"
      >
        Favoris ({{ favoriteIds.length }})
      </button>
      <button class="tab-btn" :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'">
        Parametres
      </button>
    </nav>

    <section v-if="activeTab !== 'settings'" class="panel">
      <p v-if="loading" class="empty">Chargement des builds...</p>
      <p v-else-if="displayedBuilds.length === 0" class="empty">
        {{ activeTab === "favoris" ? "Aucun favori pour le moment." : "Aucun build disponible." }}
      </p>

      <div v-else class="build-grid">
        <article v-for="b in displayedBuilds" :key="b.id" class="build-card">
          <header class="build-head">
            <div class="head-text">
              <h3 class="author">{{ b.author || "Auteur inconnu" }}</h3>
              <p class="name">{{ b.name || b.id }}</p>
            </div>
            <button
              type="button"
              class="bookmark-btn"
              :class="{ on: isFavorite(b.id) }"
              :title="isFavorite(b.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'"
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
          </header>

          <div class="champion-row">
            <div class="champion-avatar">
              <img
                v-if="championImageUrl(b)"
                :src="championImageUrl(b) || undefined"
                :alt="b.champion?.name || 'Champion'"
                @error="onChampionImageError(b)"
              />
              <span v-else>{{ championFallback(b) }}</span>
            </div>
            <div>
              <p class="champion-name">{{ b.champion?.name || "Champion inconnu" }}</p>
              <p class="meta">{{ formatDate(b.createdAt) }} · {{ buildVersion(b) || "Version inconnue" }}</p>
            </div>
          </div>

          <div v-if="Array.isArray(b.roles) && b.roles.length > 0" class="roles">
            <span v-for="role in b.roles" :key="`${b.id}-${role}`" class="role-chip">{{ roleLabel(role) }}</span>
          </div>

          <p class="desc">{{ b.description || "Aucune description pour ce build." }}</p>

          <div class="sheet-full">
            <div class="sheet-row">
              <p class="sheet-label">Sorts d'invocateur</p>
              <div class="icon-row">
                <img
                  v-for="spell in normalizedSummonerSpells(b)"
                  :key="`${b.id}-${spell.id || spell.name}`"
                  class="sheet-icon"
                  :src="spellImageUrl(b, spell.image?.full)"
                  :alt="spell.name || 'Spell'"
                />
              </div>
            </div>

            <div class="sheet-row">
              <p class="sheet-label">Runes principales</p>
              <div class="icon-row">
                <img
                  v-if="b.runes?.primary?.pathId"
                  class="sheet-icon sheet-path"
                  :src="runePathImageUrl(b, b.runes?.primary?.pathId)"
                  alt="Primary path"
                />
                <img
                  v-for="runeId in primaryRuneIds(b)"
                  :key="`${b.id}-primary-${runeId}`"
                  class="sheet-icon"
                  :src="runeImageUrl(b, runeId)"
                  :alt="`Rune ${runeId}`"
                />
              </div>
            </div>

            <div class="sheet-row">
              <p class="sheet-label">Runes secondaires / shards</p>
              <div class="icon-row">
                <img
                  v-if="b.runes?.secondary?.pathId"
                  class="sheet-icon sheet-path"
                  :src="runePathImageUrl(b, b.runes?.secondary?.pathId)"
                  alt="Secondary path"
                />
                <img
                  v-for="runeId in secondaryRuneIds(b)"
                  :key="`${b.id}-secondary-${runeId}`"
                  class="sheet-icon"
                  :src="runeImageUrl(b, runeId)"
                  :alt="`Rune ${runeId}`"
                />
                <img
                  v-for="shardId in shardIds(b)"
                  :key="`${b.id}-shard-${shardId}`"
                  class="sheet-icon sheet-shard"
                  :src="shardIconUrl(shardId)"
                  :alt="`Shard ${shardId}`"
                />
              </div>
            </div>

            <div class="sheet-row">
              <p class="sheet-label">Items</p>
              <div class="items-grid">
                <img
                  v-for="item in normalizedItems(b)"
                  :key="`${b.id}-${item.id || item.name}`"
                  class="item-icon"
                  :src="itemImageUrl(b, item.image?.full, item.id)"
                  :alt="item.name || item.id || 'Item'"
                />
              </div>
            </div>
          </div>

          <footer class="card-actions">
            <button type="button" class="import-btn" :disabled="!lcuConnected" title="Importer runes, items et sorts">
              Importer
            </button>
          </footer>
        </article>
      </div>
    </section>

    <section v-else class="panel settings-panel">
      <h3>Langue</h3>
      <label class="row row-inline">
        <span>Choix de la langue</span>
        <select
          class="language-select"
          :value="settings.language"
          @change="saveLanguage(($event.target as HTMLSelectElement).value)"
        >
          <option value="fr">Francais</option>
          <option value="en">English</option>
        </select>
      </label>

      <h3>Import dans le client</h3>
      <label class="row">
        <input
          type="checkbox"
          :checked="settings.importRunes"
          @change="saveSetting('importRunes', ($event.target as HTMLInputElement).checked)"
        />
        Importer les runes
      </label>
      <label class="row">
        <input
          type="checkbox"
          :checked="settings.importItems"
          @change="saveSetting('importItems', ($event.target as HTMLInputElement).checked)"
        />
        Importer les items
      </label>
      <label class="row">
        <input
          type="checkbox"
          :checked="settings.importSummonerSpells"
          @change="saveSetting('importSummonerSpells', ($event.target as HTMLInputElement).checked)"
        />
        Importer les sorts d'invocateur
      </label>

      <h3 class="mt">Envoi du match</h3>
      <label class="row">
        <input
          type="checkbox"
          :checked="settings.disableMatchSubmission"
          @change="saveSetting('disableMatchSubmission', ($event.target as HTMLInputElement).checked)"
        />
        Ne pas envoyer automatiquement mes matchs au site
      </label>
      <p class="hint-line">
        {{ canAutoSubmitMatch ? "Envoi auto actif si un nouveau match est detecte." : "Envoi auto inactif." }}
      </p>
      <p v-if="submitMessage" :class="{ error: submitError }" class="msg">{{ submitMessage }}</p>

      <h3 class="mt">Raccourci bureau</h3>
      <button type="button" class="submit-btn" @click="createDesktopShortcut">
        Creer un raccourci sur le bureau
      </button>
      <p v-if="shortcutMessage" :class="{ error: shortcutError }" class="msg">{{ shortcutMessage }}</p>
    </section>
  </div>
</template>

<style scoped>
.main-shell {
  max-width: 1040px;
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

.title {
  margin: 0;
  font-size: 1.15rem;
  line-height: 1.35;
}

.subtitle {
  margin: 0.2rem 0 0;
  color: rgba(240, 230, 210, 0.8);
  font-size: 0.88rem;
}

.status-pill {
  border-radius: 999px;
  padding: 0.35rem 0.65rem;
  font-size: 0.76rem;
  font-weight: 600;
  white-space: nowrap;
}

.status-pill.on {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.6);
  color: #93f2ce;
}

.status-pill.off {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.6);
  color: #fecaca;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.9rem;
}

.tab-btn {
  border: 1px solid rgba(200, 155, 60, 0.5);
  border-radius: 8px;
  background: rgba(30, 40, 45, 0.75);
  color: #f0e6d2;
  padding: 0.45rem 0.75rem;
  font-size: 0.84rem;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.tab-btn:hover:not(:disabled) {
  background: rgba(0, 90, 130, 0.55);
}

.tab-btn.active {
  background: rgba(200, 155, 60, 0.18);
  border-color: #c89b3c;
  color: #f0e6d2;
}

.tab-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.panel {
  min-height: 260px;
}

.empty {
  color: rgba(240, 230, 210, 0.85);
}

.build-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.9rem;
}

.build-card {
  border: 1px solid rgba(120, 90, 40, 0.62);
  border-radius: 10px;
  padding: 0.75rem;
  background: linear-gradient(160deg, rgba(30, 40, 45, 0.82), rgba(10, 20, 40, 0.92));
}

.build-head {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.head-text {
  min-width: 0;
}

.author {
  margin: 0;
  color: #f0e6d2;
  font-size: 0.94rem;
}

.name {
  margin: 0.1rem 0 0;
  color: rgba(200, 170, 110, 0.95);
  font-size: 0.8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bookmark-btn {
  width: 1.6rem;
  height: 1.6rem;
  flex: 0 0 1.6rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fffdf5;
  border: 1px solid #e6b800;
  border-radius: 6px;
  cursor: pointer;
  color: #b38b00;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.bookmark-btn.on {
  color: #e6b800;
  background: #fff6cc;
}

.bookmark-btn:hover {
  background: #fff2b3;
}

.bookmark-icon {
  width: 0.78rem;
  height: 0.78rem;
}

.champion-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-top: 0.65rem;
}

.champion-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 6px;
  border: 1px solid rgba(200, 155, 60, 0.7);
  overflow: hidden;
  background: rgba(9, 20, 40, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c8aa6e;
  font-weight: 700;
  font-size: 0.75rem;
}

.champion-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.champion-name {
  margin: 0;
  font-size: 0.87rem;
  color: #f0e6d2;
}

.meta {
  margin: 0.1rem 0 0;
  font-size: 0.72rem;
  color: rgba(200, 170, 110, 0.85);
}

.roles {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.58rem;
}

.role-chip {
  border-radius: 999px;
  border: 1px solid rgba(200, 155, 60, 0.45);
  padding: 0.12rem 0.5rem;
  font-size: 0.68rem;
  color: #f0e6d2;
  background: rgba(0, 90, 130, 0.36);
}

.desc {
  margin: 0.6rem 0 0;
  color: rgba(240, 230, 210, 0.9);
  font-size: 0.78rem;
  line-height: 1.32;
  min-height: 3.2em;
  line-clamp: 3;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.sheet-full {
  margin-top: 0.65rem;
  border-top: 1px solid rgba(200, 155, 60, 0.25);
  padding-top: 0.55rem;
}

.sheet-row {
  margin-bottom: 0.45rem;
}

.sheet-label {
  margin: 0 0 0.24rem;
  color: rgba(200, 170, 110, 0.95);
  font-size: 0.7rem;
}

.icon-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.32rem;
  align-items: center;
}

.sheet-icon {
  width: 1.2rem;
  height: 1.2rem;
  border-radius: 4px;
  border: 1px solid rgba(200, 155, 60, 0.4);
  background: rgba(9, 20, 40, 0.9);
  object-fit: cover;
}

.sheet-path {
  border-color: rgba(3, 151, 171, 0.65);
}

.sheet-shard {
  border-color: rgba(200, 170, 110, 0.65);
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.28rem;
}

.item-icon {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 4px;
  border: 1px solid rgba(200, 155, 60, 0.42);
  background: rgba(9, 20, 40, 0.9);
  object-fit: cover;
}

.card-actions {
  margin-top: 0.7rem;
  display: flex;
  justify-content: flex-end;
}

.import-btn,
.submit-btn {
  border: 1px solid rgba(3, 151, 171, 0.8);
  border-radius: 7px;
  background: rgba(10, 50, 60, 0.8);
  color: #cdfafa;
  cursor: pointer;
  padding: 0.38rem 0.7rem;
  font-size: 0.8rem;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.import-btn:hover:not(:disabled),
.submit-btn:hover {
  background: rgba(3, 151, 171, 0.35);
  border-color: rgba(10, 200, 185, 0.9);
}

.import-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.settings-panel {
  border: 1px solid rgba(200, 155, 60, 0.35);
  border-radius: 10px;
  padding: 1rem;
  background: rgba(10, 20, 40, 0.58);
}

.settings-panel h3 {
  margin: 0;
  font-size: 0.98rem;
  color: #f0e6d2;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.6rem 0;
  cursor: pointer;
  color: rgba(240, 230, 210, 0.92);
  font-size: 0.86rem;
}

.row-inline {
  justify-content: space-between;
}

.language-select {
  background: rgba(9, 20, 40, 0.95);
  color: #f0e6d2;
  border: 1px solid rgba(200, 155, 60, 0.55);
  border-radius: 6px;
  padding: 0.2rem 0.45rem;
}

.mt {
  margin-top: 1.3rem;
}

.msg {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #93f2ce;
}

.msg.error {
  color: #fecaca;
}

@media (max-width: 660px) {
  .header-card {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
