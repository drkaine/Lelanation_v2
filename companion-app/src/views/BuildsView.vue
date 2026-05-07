<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { openUrl } from "@tauri-apps/plugin-opener";
import { open } from "@tauri-apps/plugin-dialog";
import type { Build } from "@lelanation/shared-types";
import { apiBase } from "../config";
import { getSettings, setSettings } from "../settings";
import { translate } from "../i18n";
import type { CompanionConfig } from "../companionConfig";
import { importBuildToLcu } from "../lcuBuildImport";

const settings = ref(getSettings());
const lcuOk = ref<boolean | null>(null);
const iframeError = ref(false);
const importInProgress = ref(false);
const importFeedback = ref("");
const importOk = ref(true);
const iframeRef = ref<HTMLIFrameElement | null>(null);
const importNotificationVisible = ref(false);
const importLogs = ref<string[]>([]);
const configLeaguePath = ref("");
const configShareRanked = ref(false);
const configLanguage = ref<"fr" | "en">(settings.value.language);
const configSaving = ref(false);
const configError = ref("");
const configSaved = ref(false);

const updateAvailable = ref(false);
const latestVersion = ref("");
const currentAppVersion = ref("");
const pendingUpdate = shallowRef<Update | null>(null);
const updateInstalling = ref(false);
const updateRestarting = ref(false);
const updateProgress = ref(0);
const updateError = ref("");
const updateNoticeOpen = ref(false);
const updateNoticeVersion = ref("");
const updateChecking = ref(false);
const updateCheckMessage = ref("");
const UPDATER_INVALID_RELEASE_JSON = "Could not fetch a valid release JSON from the remote";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
let updateCheckTimer: ReturnType<typeof setInterval> | null = null;
let lcuPollTimer: ReturnType<typeof setInterval> | null = null;
let importNotificationTimer: ReturnType<typeof setTimeout> | null = null;

type AppPage = "builds" | "videos" | "statistics" | "tier-list" | "settings";
const currentPage = ref<AppPage>("builds");

const navEntries = computed(() =>
  settings.value.language === "en"
    ? [
        { id: "builds" as const, label: "My Builds" },
        { id: "videos" as const, label: "Videos" },
        { id: "statistics" as const, label: "Statistics" },
        { id: "tier-list" as const, label: "Tier List" },
      ]
    : [
        { id: "builds" as const, label: "Les Builds" },
        { id: "videos" as const, label: "Videos" },
        { id: "statistics" as const, label: "Statistiques" },
        { id: "tier-list" as const, label: "Tier list" },
      ]
);

const embeddedPageUrl = computed(() => {
  if (currentPage.value === "settings") {
    return "";
  }
  const locale = settings.value.language === "en" ? "/en" : "";
  const pathMap: Record<Exclude<AppPage, "settings">, string> = {
    builds: `${locale}/builds?tab=discover`,
    videos: `${locale}/videos`,
    statistics: `${locale}/statistics`,
    "tier-list": `${locale}/statistics/tier-list`,
  };
  const url = new URL(pathMap[currentPage.value], apiBase);
  url.searchParams.set("app", "on");
  return url.toString();
});
const isEmbeddedPage = computed(() => currentPage.value !== "settings");

watch(currentPage, () => {
  iframeError.value = false;
});

function t(key: string, params?: Record<string, string | number>): string {
  return translate(settings.value.language, key, params);
}

function pushImportLog(message: string, details?: unknown) {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  importLogs.value = [line, ...importLogs.value].slice(0, 30);
  if (details !== undefined) console.info("[companion-import]", line, details);
  else console.info("[companion-import]", line);
}

function showImportNotification(message: string, ok: boolean) {
  importFeedback.value = message;
  importOk.value = ok;
  importNotificationVisible.value = true;
  if (importNotificationTimer) clearTimeout(importNotificationTimer);
  importNotificationTimer = setTimeout(() => {
    importNotificationVisible.value = false;
  }, 7000);
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
  updateChecking.value = true;
  updateCheckMessage.value = "";
  updateError.value = "";
  try {
    const update = await check();
    if (update) {
      latestVersion.value = update.version;
      pendingUpdate.value = update;
      updateAvailable.value = true;
      if (settings.value.autoUpdate) {
        if (!updateInstalling.value && !updateRestarting.value) {
          await installUpdate();
        }
      } else if (updateNoticeVersion.value !== update.version) {
        updateNoticeVersion.value = update.version;
        updateNoticeOpen.value = true;
      }
      updateCheckMessage.value =
        settings.value.language === "en"
          ? `Update found (v${update.version}).`
          : `Mise a jour trouvee (v${update.version}).`;
    } else {
      updateAvailable.value = false;
      pendingUpdate.value = null;
      latestVersion.value = "";
      updateCheckMessage.value =
        settings.value.language === "en"
          ? `App is up to date (v${currentAppVersion.value}).`
          : `Application a jour (v${currentAppVersion.value}).`;
    }
  } catch (e) {
    const rawError = e instanceof Error ? e.message : String(e);
    if (rawError.includes(UPDATER_INVALID_RELEASE_JSON)) {
      updateError.value = "";
      updateCheckMessage.value =
        settings.value.language === "en"
          ? "Update metadata is not published yet (latest.json missing in release assets)."
          : "Les metadonnees de mise a jour ne sont pas encore publiees (latest.json manquant dans les assets).";
    } else {
      updateError.value = rawError;
      updateCheckMessage.value =
        settings.value.language === "en"
          ? "Update check failed."
          : "Echec de verification des mises a jour.";
    }
  } finally {
    updateChecking.value = false;
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
}

function onConfigLanguageChange(lang: "fr" | "en") {
  configLanguage.value = lang;
  saveLang(lang);
}

function onAutoUpdateToggle(value: boolean) {
  settings.value = { ...settings.value, autoUpdate: value };
  setSettings({ autoUpdate: value });
  if (value) {
    if (pendingUpdate.value && !updateInstalling.value && !updateRestarting.value) {
      void installUpdate();
      return;
    }
    void checkForUpdates();
  }
}

async function checkForUpdatesManually() {
  await checkForUpdates();
}

function onImportPreferenceToggle(
  key: "importRunes" | "importItems" | "importSummonerSpells",
  value: boolean
) {
  settings.value = { ...settings.value, [key]: value };
  setSettings({ [key]: value });
}

async function browseLeagueFolder() {
  const picked = await open({
    directory: true,
    multiple: false,
    title: settings.value.language === "en" ? "League install folder" : "Dossier d'installation League",
  });
  if (typeof picked === "string" && picked) {
    configLeaguePath.value = picked;
  }
}

async function saveCompanionConfig() {
  configSaving.value = true;
  configError.value = "";
  configSaved.value = false;
  try {
    const cfg: CompanionConfig = {
      leagueInstallPath: configLeaguePath.value.trim() || "",
      onboardingComplete: true,
      shareRankedDuoStats: configShareRanked.value,
    };
    await invoke("companion_save_config", { cfg });
    configSaved.value = true;
  } catch (e) {
    configError.value = e instanceof Error ? e.message : String(e);
  } finally {
    configSaving.value = false;
  }
}

function sourceOrigin(): string | null {
  try {
    return new URL(apiBase).origin;
  } catch {
    return null;
  }
}

function allowedIframeOrigins(): string[] {
  const origins = new Set<string>();
  const baseOrigin = sourceOrigin();
  if (baseOrigin) {
    origins.add(baseOrigin);
    try {
      const parsed = new URL(baseOrigin);
      const { protocol, hostname } = parsed;
      if (hostname.startsWith("www.")) {
        origins.add(`${protocol}//${hostname.slice(4)}`);
      } else {
        origins.add(`${protocol}//www.${hostname}`);
      }
    } catch {
      // ignore malformed origin
    }
  }
  if (embeddedPageUrl.value) {
    try {
      origins.add(new URL(embeddedPageUrl.value).origin);
    } catch {
      // ignore malformed URL
    }
  }
  return [...origins];
}

async function runImportFromIframe(build: Build) {
  if (importInProgress.value) {
    pushImportLog("Import ignored: another import is already running.");
    return;
  }
  pushImportLog("Import requested from iframe.", { buildId: build.id, buildName: build.name });
  importInProgress.value = true;
  try {
    await importBuildToLcu(build);
    pushImportLog("Import success.");
    showImportNotification(t("importSuccess"), true);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    pushImportLog("Import failed.", { error: msg });
    if (msg === "LCU_OFFLINE") showImportNotification(t("importNeedClient"), false);
    else if (msg === "NO_CHAMPION") showImportNotification(t("importNeedChampion"), false);
    else if (msg === "NOTHING_TO_IMPORT") showImportNotification(t("importNothingToImport"), false);
    else if (msg.startsWith("RUNES:")) showImportNotification(t("importRunesFailed") + msg.slice(6), false);
    else if (msg.startsWith("ITEMS:")) showImportNotification(t("importItemsFailed") + msg.slice(6), false);
    else showImportNotification(msg, false);
  } finally {
    importInProgress.value = false;
  }
}

function onIframeMessage(event: MessageEvent) {
  const iframeWindow = iframeRef.value?.contentWindow;
  if (!iframeWindow || event.source !== iframeWindow) {
    pushImportLog("Message ignored: source window mismatch.");
    return;
  }
  if (!allowedIframeOrigins().includes(event.origin)) {
    pushImportLog("Message ignored: origin not allowed.", { origin: event.origin });
    return;
  }

  const data = event.data as
    | { type?: string; payload?: { build?: Build } }
    | undefined;
  if (data?.type !== "lelanation:companion-import-build") {
    pushImportLog("Message ignored: unexpected message type.", { type: data?.type });
    return;
  }
  if (!data.payload?.build) {
    pushImportLog("Message ignored: missing build payload.");
    showImportNotification(
      settings.value.language === "en"
        ? "Import failed: missing build payload."
        : "Echec import: payload build manquant.",
      false
    );
    return;
  }

  pushImportLog("Valid import message received.", { origin: event.origin, buildId: data.payload.build.id });
  void runImportFromIframe(data.payload.build);
}

onMounted(async () => {
  pushImportLog("Companion import bridge ready.");
  try {
    currentAppVersion.value = await getVersion();
  } catch {
    currentAppVersion.value = "dev";
  }
  void pollLcu();
  lcuPollTimer = setInterval(pollLcu, 15_000);

  void checkForUpdates();
  updateCheckTimer = setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);

  try {
    const cfg = await invoke<CompanionConfig>("companion_get_config");
    configLeaguePath.value = cfg.leagueInstallPath?.trim() ?? "";
    configShareRanked.value = cfg.shareRankedDuoStats === true;
  } catch {
    configLeaguePath.value = "";
    configShareRanked.value = false;
  }

  window.addEventListener("message", onIframeMessage);
});
onUnmounted(() => {
  if (updateCheckTimer) clearInterval(updateCheckTimer);
  if (lcuPollTimer) clearInterval(lcuPollTimer);
  if (importNotificationTimer) clearTimeout(importNotificationTimer);
  window.removeEventListener("message", onIframeMessage);
});
</script>

<template>
  <div class="app-frame">
    <header class="top-bar">
      <div class="brand">
        <span class="brand-title">Lelanation Companion</span>
      </div>
      <nav class="app-nav">
        <button
          v-for="entry in navEntries"
          :key="entry.id"
          type="button"
          class="nav-btn"
          :class="{ active: currentPage === entry.id }"
          @click="currentPage = entry.id"
        >
          {{ entry.label }}
        </button>
      </nav>
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
        <button type="button" class="icon-btn" :title="t('settings.more')" @click="currentPage = 'settings'">
          ⚙
        </button>
      </div>
    </header>

    <div v-if="updateAvailable && settings.autoUpdate" class="update-banner">
      <span v-if="updateRestarting">{{ t("update.restarting") }}</span>
      <span v-else-if="updateInstalling">{{ t("update.installing", { progress: updateProgress }) }}</span>
      <span v-else>{{ t("update.available", { version: latestVersion }) }}</span>
      <p v-if="updateError" class="update-err">{{ t("update.error") }}: {{ updateError }}</p>
    </div>

    <section v-if="isEmbeddedPage" class="presentation-shell">
      <iframe
        ref="iframeRef"
        :key="embeddedPageUrl"
        v-show="!iframeError"
        class="presentation-iframe"
        :src="embeddedPageUrl"
        title="Lelanation builds presentation"
        loading="eager"
        @error="iframeError = true"
      />
      <div v-if="iframeError" class="iframe-fallback">
        <p>La page n'a pas pu etre chargee dans l'application.</p>
        <button type="button" class="btn-sm" @click="openUrl(embeddedPageUrl)">Ouvrir dans le navigateur</button>
      </div>
    </section>
    <section v-else class="settings-page">
      <div class="settings-card">
        <h2 class="settings-title">{{ t("settings.more") }}</h2>
        <p class="settings-subtitle">
          {{
            settings.language === "en"
              ? "Configure companion preferences and game connection."
              : "Configure les preferences de l'application et la connexion au jeu."
          }}
        </p>

        <label class="settings-field">
          <span>{{ settings.language === "en" ? "League install folder" : "Dossier d'installation League" }}</span>
          <div class="path-row">
            <input v-model="configLeaguePath" type="text" class="path-input" />
            <button type="button" class="btn-sm" @click="browseLeagueFolder">
              {{ settings.language === "en" ? "Browse" : "Parcourir" }}
            </button>
          </div>
        </label>

        <label class="settings-field">
          <span>{{ t("settings.language") }}</span>
          <select :value="configLanguage" @change="onConfigLanguageChange(($event.target as HTMLSelectElement).value as 'fr' | 'en')">
            <option value="fr">FR</option>
            <option value="en">EN</option>
          </select>
        </label>

        <label class="settings-check">
          <input v-model="configShareRanked" type="checkbox" />
          <span>
            {{
              settings.language === "en"
                ? "Allow ranked duo match data submission"
                : "Autoriser l'envoi des matchs classés duo"
            }}
          </span>
        </label>

        <h3 class="settings-subsection">
          {{ settings.language === "en" ? "Import into LoL client" : "Import dans le client LoL" }}
        </h3>
        <label class="settings-check">
          <input
            type="checkbox"
            :checked="settings.importRunes"
            @change="onImportPreferenceToggle('importRunes', ($event.target as HTMLInputElement).checked)"
          />
          <span>{{ settings.language === "en" ? "Import runes" : "Importer les runes" }}</span>
        </label>
        <label class="settings-check">
          <input
            type="checkbox"
            :checked="settings.importItems"
            @change="onImportPreferenceToggle('importItems', ($event.target as HTMLInputElement).checked)"
          />
          <span>{{ settings.language === "en" ? "Import item sets" : "Importer les sets d'objets" }}</span>
        </label>
        <label class="settings-check">
          <input
            type="checkbox"
            :checked="settings.importSummonerSpells"
            @change="onImportPreferenceToggle('importSummonerSpells', ($event.target as HTMLInputElement).checked)"
          />
          <span>
            {{ settings.language === "en" ? "Import summoner spells" : "Importer les sorts d'invocateur" }}
          </span>
        </label>

        <label class="settings-check">
          <input
            type="checkbox"
            :checked="settings.autoUpdate"
            @change="onAutoUpdateToggle(($event.target as HTMLInputElement).checked)"
          />
          <span>
            {{ settings.language === "en" ? "Enable automatic updates" : "Activer les mises a jour automatiques" }}
          </span>
        </label>

        <p class="settings-meta">{{ settings.language === "en" ? "Version" : "Version" }}: v{{ currentAppVersion }}</p>
        <p class="settings-meta">
          {{
            settings.language === "en"
              ? "Update checks run on startup and every hour."
              : "La verification des mises a jour se fait au demarrage puis toutes les heures."
          }}
        </p>
        <div class="settings-actions">
          <button
            type="button"
            class="btn-sm"
            :disabled="updateChecking || updateInstalling || updateRestarting"
            @click="checkForUpdatesManually"
          >
            {{
              updateChecking
                ? (settings.language === "en" ? "Checking..." : "Verification...")
                : (settings.language === "en" ? "Check for updates now" : "Rechercher une mise a jour")
            }}
          </button>
        </div>
        <p v-if="updateCheckMessage" class="settings-meta">{{ updateCheckMessage }}</p>
        <p v-if="updateError" class="settings-error">
          {{ settings.language === "en" ? "Update error:" : "Erreur mise a jour:" }} {{ updateError }}
        </p>

        <div class="settings-actions">
          <button type="button" class="btn-sm" :disabled="configSaving" @click="saveCompanionConfig">
            {{
              configSaving
                ? (settings.language === "en" ? "Saving..." : "Sauvegarde...")
                : (settings.language === "en" ? "Save settings" : "Enregistrer")
            }}
          </button>
        </div>

        <p v-if="configSaved" class="settings-success">
          {{ settings.language === "en" ? "Settings saved." : "Parametres enregistres." }}
        </p>
        <p v-if="configError" class="settings-error">{{ configError }}</p>

        <h3 class="settings-subsection">
          {{ settings.language === "en" ? "Import debug logs" : "Logs debug import" }}
        </h3>
        <p class="settings-meta">
          {{
            settings.language === "en"
              ? "Recent events for iframe bridge and LoL import."
              : "Evenements recents du bridge iframe et de l'import LoL."
          }}
        </p>
        <div class="import-log-list">
          <p v-for="(line, idx) in importLogs" :key="`${idx}-${line}`" class="import-log-line">{{ line }}</p>
          <p v-if="importLogs.length === 0" class="import-log-line muted">
            {{ settings.language === "en" ? "No logs yet." : "Aucun log pour le moment." }}
          </p>
        </div>
      </div>
    </section>
    <p v-if="importNotificationVisible && importFeedback" class="import-feedback" :class="{ err: !importOk }">
      {{ importFeedback }}
    </p>
    <div v-if="updateNoticeOpen" class="overlay" @click.self="updateNoticeOpen = false">
      <div class="update-modal">
        <h3>{{ settings.language === "en" ? "Update available" : "Mise a jour disponible" }}</h3>
        <p>
          {{
            settings.language === "en"
              ? `A new version (${updateNoticeVersion || latestVersion}) is available.`
              : `Une nouvelle version (${updateNoticeVersion || latestVersion}) est disponible.`
          }}
        </p>
        <p>
          {{
            settings.language === "en"
              ? "Auto-update is disabled. Enable it in settings to apply updates automatically."
              : "La mise a jour auto est desactivee. Active-la dans les parametres pour appliquer les mises a jour automatiquement."
          }}
        </p>
        <button type="button" class="btn-sm" @click="updateNoticeOpen = false">
          {{ settings.language === "en" ? "OK" : "D'accord" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-frame {
  width: 100%;
  min-height: 100vh;
  margin: 0;
  padding: 0.75rem 0 0;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at 20% 0%, rgba(3, 151, 171, 0.18), transparent 38%),
    radial-gradient(circle at 80% 0%, rgba(200, 155, 60, 0.1), transparent 40%);
}
.top-bar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 1rem;
  margin: 0 1rem 0.65rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid rgba(200, 155, 60, 0.35);
  border-radius: 12px;
  background: linear-gradient(145deg, rgba(10, 20, 40, 0.92), rgba(10, 20, 40, 0.72));
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
.app-nav {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.nav-btn {
  padding: 0.42rem 0.7rem;
  border-radius: 999px;
  border: 1px solid rgba(200, 155, 60, 0.4);
  background: rgba(10, 20, 40, 0.55);
  color: #f0e6d2;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  transition: all 0.2s ease;
}
.nav-btn:hover {
  border-color: rgba(200, 155, 60, 0.8);
  background: rgba(200, 155, 60, 0.14);
}
.nav-btn.active {
  border-color: rgba(3, 151, 171, 0.85);
  background: rgba(3, 151, 171, 0.2);
  color: #cdfafa;
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
.settings-page {
  flex: 1;
  margin: 0 1rem;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}
.settings-card {
  width: min(720px, 100%);
  border: 1px solid rgba(200, 155, 60, 0.35);
  border-radius: 12px;
  background: rgba(10, 20, 40, 0.72);
  box-shadow: 0 14px 35px rgba(0, 0, 0, 0.25);
  padding: 1rem;
}
.settings-title {
  margin: 0;
  color: #c8aa6e;
}
.settings-subtitle {
  margin: 0.4rem 0 1rem;
  font-size: 0.86rem;
  opacity: 0.9;
}
.settings-subsection {
  margin: 1rem 0 0.55rem;
  font-size: 0.9rem;
  color: #c8aa6e;
}
.settings-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-bottom: 0.85rem;
  font-size: 0.88rem;
}
.settings-field select,
.path-input {
  padding: 0.45rem 0.55rem;
  border-radius: 8px;
  border: 1px solid rgba(200, 155, 60, 0.45);
  background: rgba(5, 15, 35, 0.9);
  color: #f0e6d2;
}
.path-row {
  display: flex;
  gap: 0.45rem;
}
.path-input {
  flex: 1;
}
.settings-check {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.88rem;
}
.settings-actions {
  margin-top: 0.9rem;
}
.settings-meta {
  margin-top: 0.6rem;
  font-size: 0.83rem;
  opacity: 0.88;
}
.settings-success {
  margin-top: 0.75rem;
  color: #b8f0c8;
  font-size: 0.84rem;
}
.settings-error {
  margin-top: 0.75rem;
  color: #ffb4b4;
  font-size: 0.84rem;
}
.update-banner {
  margin: 0 1rem 0.75rem;
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
.presentation-shell {
  flex: 1;
  margin: 0 1rem;
  border: 1px solid rgba(200, 155, 60, 0.35);
  border-radius: 12px;
  overflow: hidden;
  background: rgba(10, 20, 40, 0.72);
  box-shadow: 0 14px 35px rgba(0, 0, 0, 0.25);
}
.presentation-iframe {
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 165px);
  border: none;
  display: block;
}
.iframe-fallback {
  padding: 1.25rem;
  text-align: center;
}
.import-feedback {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 1100;
  margin: 0;
  max-width: min(620px, calc(100vw - 2rem));
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(80, 200, 120, 0.45);
  background: rgba(80, 200, 120, 0.12);
  color: #b8f0c8;
  font-size: 0.86rem;
}
.import-feedback.err {
  border-color: rgba(255, 138, 138, 0.45);
  background: rgba(255, 138, 138, 0.12);
  color: #ffb4b4;
}
.import-log-list {
  margin-top: 0.4rem;
  max-height: 220px;
  overflow: auto;
  border: 1px solid rgba(200, 155, 60, 0.25);
  border-radius: 8px;
  padding: 0.5rem;
  background: rgba(4, 10, 22, 0.72);
}
.import-log-line {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.35;
  color: #d8ccb4;
}
.import-log-line + .import-log-line {
  margin-top: 0.25rem;
}
.import-log-line.muted {
  opacity: 0.72;
}
.overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.update-modal {
  width: min(460px, 100%);
  border: 1px solid rgba(200, 155, 60, 0.45);
  border-radius: 12px;
  background: rgba(12, 22, 42, 0.96);
  color: #f0e6d2;
  padding: 1rem;
}
.update-modal h3 {
  margin: 0 0 0.5rem;
  color: #c8aa6e;
}
.update-modal p {
  margin: 0.4rem 0;
  font-size: 0.88rem;
}
</style>
