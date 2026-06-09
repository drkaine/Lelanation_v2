<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { Build } from "@lelanation/shared-types";
import { apiBase } from "../config";

const props = defineProps<{
  language: "fr" | "en";
  lcuReady: boolean;
  importInProgress: boolean;
}>();

const emit = defineEmits<{
  import: [build: Build];
}>();

const builds = ref<Build[]>([]);
const loading = ref(true);
const loadError = ref("");
const searchQuery = ref("");

const labels = computed(() =>
  props.language === "en"
    ? {
        title: "Discover builds",
        subtitle: "Loaded from Lelanation API — import goes directly to the LoL client.",
        search: "Search champion or build…",
        import: "Import to client",
        importing: "Importing…",
        refresh: "Refresh",
        empty: "No public builds found.",
        needClient: "Open the League client to import.",
        loadFailed: "Failed to load builds.",
        count: (n: number) => `${n} build${n === 1 ? "" : "s"}`,
      }
    : {
        title: "Découvrir les builds",
        subtitle: "Chargés depuis l'API Lelanation — l'import va directement dans le client LoL.",
        search: "Rechercher champion ou build…",
        import: "Importer dans le client",
        importing: "Import…",
        refresh: "Actualiser",
        empty: "Aucun build public trouvé.",
        needClient: "Ouvre le client League pour importer.",
        loadFailed: "Échec du chargement des builds.",
        count: (n: number) => `${n} build${n > 1 ? "s" : ""}`,
      }
);

const filteredBuilds = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return builds.value;
  return builds.value.filter((b) => {
    const champ = b.champion?.name?.toLowerCase() ?? b.champion?.id?.toLowerCase() ?? "";
    const name = b.name?.toLowerCase() ?? "";
    const author = b.author?.toLowerCase() ?? "";
    return champ.includes(q) || name.includes(q) || author.includes(q);
  });
});

async function loadBuilds() {
  loading.value = true;
  loadError.value = "";
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/builds`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = (await res.json()) as Build[];
    builds.value = Array.isArray(data) ? data.filter((b) => b?.id) : [];
  } catch (e) {
    builds.value = [];
    loadError.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function onImport(build: Build) {
  emit("import", build);
}

onMounted(() => {
  void loadBuilds();
});
</script>

<template>
  <section class="native-builds">
    <header class="native-builds-header">
      <div>
        <h2 class="native-builds-title">{{ labels.title }}</h2>
        <p class="native-builds-subtitle">{{ labels.subtitle }}</p>
      </div>
      <button type="button" class="btn-sm" :disabled="loading" @click="loadBuilds">
        {{ labels.refresh }}
      </button>
    </header>

    <div class="native-builds-toolbar">
      <input
        v-model="searchQuery"
        type="search"
        class="search-input"
        :placeholder="labels.search"
      />
      <span v-if="!loading" class="build-count">{{ labels.count(filteredBuilds.length) }}</span>
    </div>

    <p v-if="loading" class="native-builds-status">…</p>
    <p v-else-if="loadError" class="native-builds-error">
      {{ labels.loadFailed }} {{ loadError }}
    </p>
    <p v-else-if="filteredBuilds.length === 0" class="native-builds-status">{{ labels.empty }}</p>

    <ul v-else class="build-list">
      <li v-for="build in filteredBuilds" :key="build.id" class="build-row">
        <div class="build-info">
          <span class="build-champion">{{ build.champion?.name ?? build.champion?.id ?? "?" }}</span>
          <span class="build-name">{{ build.name || build.id }}</span>
          <span v-if="build.author" class="build-author">— {{ build.author }}</span>
        </div>
        <button
          type="button"
          class="btn-import"
          :disabled="!lcuReady || importInProgress"
          :title="lcuReady ? labels.import : labels.needClient"
          @click="onImport(build)"
        >
          {{ importInProgress ? labels.importing : labels.import }}
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.native-builds {
  flex: 1;
  margin: 0 1rem;
  padding: 1rem;
  border: 1px solid rgba(200, 155, 60, 0.35);
  border-radius: 12px;
  background: rgba(10, 20, 40, 0.72);
  box-shadow: 0 14px 35px rgba(0, 0, 0, 0.25);
  overflow: auto;
  min-height: calc(100vh - 165px);
}
.native-builds-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
}
.native-builds-title {
  margin: 0;
  color: #c8aa6e;
  font-size: 1.05rem;
}
.native-builds-subtitle {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  opacity: 0.88;
}
.native-builds-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}
.search-input {
  flex: 1;
  padding: 0.45rem 0.6rem;
  border-radius: 8px;
  border: 1px solid rgba(200, 155, 60, 0.45);
  background: rgba(5, 15, 35, 0.9);
  color: #f0e6d2;
  font-size: 0.86rem;
}
.build-count {
  font-size: 0.8rem;
  opacity: 0.85;
  white-space: nowrap;
}
.native-builds-status {
  font-size: 0.86rem;
  opacity: 0.9;
}
.native-builds-error {
  color: #ffb4b4;
  font-size: 0.86rem;
}
.build-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.build-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  border: 1px solid rgba(200, 155, 60, 0.22);
  background: rgba(10, 30, 50, 0.45);
}
.build-info {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem;
  min-width: 0;
}
.build-champion {
  font-weight: 700;
  color: #cdfafa;
  font-size: 0.88rem;
}
.build-name {
  color: #f0e6d2;
  font-size: 0.86rem;
}
.build-author {
  font-size: 0.78rem;
  opacity: 0.75;
}
.btn-sm {
  padding: 0.35rem 0.65rem;
  border-radius: 6px;
  border: 1px solid rgba(200, 155, 60, 0.55);
  background: rgba(10, 40, 60, 0.7);
  color: #cdfafa;
  cursor: pointer;
  font-size: 0.82rem;
  white-space: nowrap;
}
.btn-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-import {
  padding: 0.38rem 0.7rem;
  border-radius: 6px;
  border: 1px solid rgba(3, 151, 171, 0.65);
  background: rgba(3, 151, 171, 0.2);
  color: #cdfafa;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}
.btn-import:hover:not(:disabled) {
  background: rgba(3, 151, 171, 0.35);
}
.btn-import:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  border-color: rgba(200, 155, 60, 0.35);
  background: rgba(10, 20, 40, 0.5);
  color: #a0a8b8;
}
</style>
