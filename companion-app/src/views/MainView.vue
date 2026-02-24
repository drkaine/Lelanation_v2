<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { apiBase } from "../config";
import { getFavoriteIds, toggleFavorite, isFavorite } from "../favorites";
import { getSettings, setSettings } from "../settings";

type Build = { id: string; name?: string; author?: string; champion?: { name?: string } };

const builds = ref<Build[]>([]);
const loading = ref(true);
const activeTab = ref<"builds" | "favoris" | "settings">("builds");
const lcuConnected = ref(false);
const submitMessage = ref("");
const submitError = ref(false);
const favoriteIds = ref<string[]>([]);

const settings = ref(getSettings());
function saveSetting<K extends keyof typeof settings.value>(key: K, value: boolean) {
  settings.value = { ...settings.value, [key]: value };
  setSettings({ [key]: value });
}

const favoriteBuilds = computed(() => {
  const ids = new Set(favoriteIds.value);
  return builds.value.filter((b) => ids.has(b.id));
});

async function loadBuilds() {
  loading.value = true;
  try {
    const r = await fetch(`${apiBase}/api/builds`);
    if (r.ok) {
      builds.value = (await r.json()) as Build[];
    }
  } catch {
    builds.value = [];
  } finally {
    loading.value = false;
  }
}

function refreshFavorites() {
  favoriteIds.value = getFavoriteIds();
}

function toggleFav(id: string) {
  toggleFavorite(id);
  refreshFavorites();
}

async function checkLcu() {
  try {
    const res = await invoke<{ ok: boolean }>("get_lcu_connection");
    lcuConnected.value = res.ok;
  } catch {
    lcuConnected.value = false;
  }
}

async function submitLastMatch() {
  submitMessage.value = "";
  submitError.value = false;
  try {
    const gamesJson = await invoke<string>("lcu_request", {
      method: "GET",
      path: "/lol-match-history/v1/games",
      body: null,
    });
    const list = JSON.parse(gamesJson) as { games?: Array<{ gameId?: number; platformId?: string }> } | Array<{ gameId?: number; platformId?: string }>;
    const games = Array.isArray(list) ? list : list?.games ?? [];
    const last = games[0];
    if (!last?.gameId) {
      submitMessage.value = "Aucun match récent.";
      submitError.value = true;
      return;
    }
    const region = (last.platformId || "euw1").toLowerCase();
    const matchId = last.platformId ? `${last.platformId}_${last.gameId}` : String(last.gameId);
    const r = await fetch(`${apiBase}/api/app/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, region }),
    });
    const data = (await r.json()) as { error?: string; inserted?: boolean };
    if (r.ok) {
      submitMessage.value = data.inserted ? "Match envoyé." : "Match déjà connu.";
    } else {
      submitMessage.value = data.error || "Erreur";
      submitError.value = true;
    }
  } catch (e) {
    submitMessage.value = e instanceof Error ? e.message : "Erreur";
    submitError.value = true;
  }
}

onMounted(() => {
  loadBuilds();
  refreshFavorites();
  checkLcu();
});
</script>

<template>
  <div class="main">
    <div class="tabs">
      <button :class="{ active: activeTab === 'builds' }" @click="activeTab = 'builds'">Builds</button>
      <button v-if="favoriteIds.length > 0" :class="{ active: activeTab === 'favoris' }" @click="activeTab = 'favoris'">
        Mes favoris
      </button>
      <button :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'">Paramètres</button>
    </div>

    <div v-show="activeTab === 'builds'" class="panel">
      <p v-if="loading">Chargement…</p>
      <ul v-else class="build-list">
        <li v-for="b in builds" :key="b.id" class="build-row">
          <button type="button" class="star" :class="{ on: isFavorite(b.id) }" @click="toggleFav(b.id)" title="Favori">
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
          <span class="name">{{ b.name || b.id }}</span>
          <span class="author">{{ b.author || "—" }}</span>
          <button
            type="button"
            class="import-btn"
            :disabled="!lcuConnected"
            title="Importer le build (runes/items/sorts)"
          >
            Importer
          </button>
        </li>
      </ul>
      <p v-if="!lcuConnected" class="hint">Ouvre le client LoL pour activer l'import.</p>
    </div>

    <div v-show="activeTab === 'favoris'" class="panel">
      <ul class="build-list">
        <li v-for="b in favoriteBuilds" :key="b.id" class="build-row">
          <button type="button" class="star on" @click="toggleFav(b.id)">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
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
          <span class="name">{{ b.name || b.id }}</span>
          <span class="author">{{ b.author || "—" }}</span>
          <button type="button" class="import-btn" :disabled="!lcuConnected">Importer</button>
        </li>
      </ul>
    </div>

    <div v-show="activeTab === 'settings'" class="panel">
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
      <button type="button" class="submit-btn" @click="submitLastMatch">Envoyer le dernier match au site</button>
      <p v-if="submitMessage" :class="{ error: submitError }" class="msg">{{ submitMessage }}</p>
    </div>
  </div>
</template>

<style scoped>
.main {
  max-width: 640px;
  margin: 0 auto;
  padding: 1rem;
}
.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.tabs button {
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
}
.tabs button.active {
  background: #396cd8;
  color: #fff;
  border-color: #396cd8;
}
.panel {
  min-height: 200px;
}
.build-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.build-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
}
.star {
  width: 1.9rem;
  height: 1.9rem;
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
.star.on {
  color: #e6b800;
  background: #fff6cc;
}
.star:hover {
  background: #fff2b3;
}
.bookmark-icon {
  width: 0.95rem;
  height: 0.95rem;
}
.name {
  flex: 1;
  font-weight: 500;
}
.author {
  color: #666;
  font-size: 0.9rem;
}
.import-btn {
  padding: 0.25rem 0.5rem;
  font-size: 0.85rem;
  border-radius: 4px;
  border: 1px solid #396cd8;
  background: #fff;
  cursor: pointer;
}
.import-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.hint {
  color: #666;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}
.row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0;
  cursor: pointer;
}
.mt {
  margin-top: 1.5rem;
}
.submit-btn {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  background: #396cd8;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.msg {
  margin-top: 0.5rem;
  font-size: 0.9rem;
}
.msg.error {
  color: #c00;
}
</style>
