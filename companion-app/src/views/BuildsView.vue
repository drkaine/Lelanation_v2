<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { openUrl } from "@tauri-apps/plugin-opener";
import { open } from "@tauri-apps/plugin-dialog";
import type { Build } from "@lelanation/shared-types";
import { apiBase } from "../config";
import { IMPORT_BRIDGE_ORIGIN, wrapWithEmbedProxy } from "../embedProxy";
import { getSettings, setSettings } from "../settings";
import { translate, translateLcuPhase } from "../i18n";
import type { CompanionConfig } from "../companionConfig";
import { importBuildToLcu, describeApplyResult } from "../lcuBuildImport";
import { useLcuExport } from "../composables/useLcuExport";
import KeyboardShortcutsView from "./KeyboardShortcutsView.vue";
import ChecklistView from "./ChecklistView.vue";

const settings = ref(getSettings());
const { lcuStatus, refreshStatus } = useLcuExport();
const lcuOk = computed(() => lcuStatus.value.connected);

const lcuStatusTitle = computed(() => {
  const base = lcuOk.value ? t("status.connected") : t("status.disconnected");
  if (lcuOk.value && lcuStatus.value.phase) {
    return `${base} · ${translateLcuPhase(settings.value.language, lcuStatus.value.phase)}`;
  }
  return base;
});
const iframeError = ref(false);
const iframeLoadedOrigin = ref<string | null>(null);
const importInProgress = ref(false);
const importFeedback = ref("");
const importOk = ref(true);
const iframeRef = ref<HTMLIFrameElement | null>(null);
const importNotificationVisible = ref(false);
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
let importNotificationTimer: ReturnType<typeof setTimeout> | null = null;
let bridgeUnlisten: UnlistenFn | null = null;
let postgameUnlisten: UnlistenFn | null = null;

type QueuedImportMessage = {
  origin?: string;
  data?: { type?: string; payload?: { build?: Build } };
};

type AppPage =
  | "builds"
  | "videos"
  | "statistics"
  | "tier-list"
  | "patch-notes"
  | "checklist"
  | "shortcuts"
  | "settings";
const currentPage = ref<AppPage>("builds");

const navEntries = computed(() =>
  settings.value.language === "en"
    ? [
        { id: "builds" as const, label: "My Builds" },
        { id: "videos" as const, label: "Videos" },
        { id: "statistics" as const, label: "Statistics" },
        { id: "tier-list" as const, label: "Tier List" },
        { id: "patch-notes" as const, label: "Patch Notes" },
        { id: "shortcuts" as const, label: t("nav.shortcuts") },
      ]
    : [
        { id: "builds" as const, label: "Les Builds" },
        { id: "videos" as const, label: "Videos" },
        { id: "statistics" as const, label: "Statistiques" },
        { id: "tier-list" as const, label: "Tier list" },
        { id: "patch-notes" as const, label: "Notes de patch" },
        { id: "shortcuts" as const, label: t("nav.shortcuts") },
      ]
);

const embeddedPageUrl = computed(() => {
  if (
    currentPage.value === "settings" ||
    currentPage.value === "shortcuts" ||
    currentPage.value === "checklist"
  ) {
    return "";
  }
  const locale = settings.value.language === "en" ? "/en" : "";
  const pathMap: Record<Exclude<AppPage, "settings" | "shortcuts" | "checklist">, string> = {
    builds: `${locale}/builds?tab=discover`,
    videos: `${locale}/videos`,
    statistics: `${locale}/statistics`,
    "tier-list": `${locale}/statistics/tier-list`,
    "patch-notes": `${locale}/patch-notes`,
  };
  const url = new URL(pathMap[currentPage.value], apiBase);
  url.searchParams.set("app", "on");
  const target = url.toString();
  const wrapped = wrapWithEmbedProxy(target);
  if (wrapped !== target) {
    return wrapped;
  }
  return target;
});
const isEmbeddedPage = computed(
  () =>
    currentPage.value !== "settings" &&
    currentPage.value !== "shortcuts" &&
    currentPage.value !== "checklist"
);

watch(currentPage, () => {
  iframeError.value = false;
});

function t(key: string, params?: Record<string, string | number>): string {
  return translate(settings.value.language, key, params);
}

function showImportNotification(message: string, ok: boolean) {
  importFeedback.value = message;
  importOk.value = ok;
  importNotificationVisible.value = true;
  if (importNotificationTimer) clearTimeout(importNotificationTimer);
  importNotificationTimer = setTimeout(() => {
    importNotificationVisible.value = false;
  }, 12000);
}

const isDev = import.meta.env.DEV;

async function checkForUpdates() {
  if (isDev) {
    updateCheckMessage.value =
      settings.value.language === "en"
        ? "Auto-update disabled in dev mode."
        : "Mises a jour desactivees en mode dev.";
    return;
  }
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
  if (isDev) return;
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
      const { protocol, hostname, port } = parsed;
      if (hostname.startsWith("www.")) {
        origins.add(`${protocol}//${hostname.slice(4)}${port ? `:${port}` : ""}`);
      } else {
        origins.add(`${protocol}//www.${hostname}${port ? `:${port}` : ""}`);
      }
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        origins.add(`${protocol}//localhost${port ? `:${port}` : ""}`);
        origins.add(`${protocol}//127.0.0.1${port ? `:${port}` : ""}`);
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
  if (iframeLoadedOrigin.value) {
    origins.add(iframeLoadedOrigin.value);
  }
  origins.add(IMPORT_BRIDGE_ORIGIN);
  return [...origins];
}

function onIframeLoad() {
  const src = iframeRef.value?.src;
  if (!src) return;
  try {
    iframeLoadedOrigin.value = new URL(src).origin;
  } catch {
    iframeLoadedOrigin.value = null;
  }
}

function importErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return String(error);
}

async function runImportFromIframe(build: Build) {
  if (importInProgress.value) {
    showImportNotification(
      settings.value.language === "en"
        ? "An import is already running."
        : "Un import est déjà en cours.",
      false
    );
    return;
  }
  importInProgress.value = true;
  showImportNotification(t("importInProgress"), true);
  try {
    const result = await importBuildToLcu(build);
    const summary = describeApplyResult(result, settings.value.language) || t("importSuccess");
    showImportNotification(summary, true);
    await refreshStatus();
  } catch (e) {
    const msg = importErrorMessage(e);
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

const recentImportKeys = new Set<string>();

function handleCompanionImportBuild(build: Build) {
  const dedupeKey = `${build.id}:${build.name ?? ""}`;
  if (recentImportKeys.has(dedupeKey)) {
    return;
  }
  recentImportKeys.add(dedupeKey);
  setTimeout(() => recentImportKeys.delete(dedupeKey), 3000);

  void runImportFromIframe(build);
}

function drainQueuedImportMessages() {
  const win = window as Window & { __LELANATION_IMPORT_QUEUE__?: QueuedImportMessage[] };
  const queue = win.__LELANATION_IMPORT_QUEUE__;
  if (!queue?.length) return;
  for (const item of queue.splice(0, queue.length)) {
    const build = item.data?.payload?.build;
    if (build) {
      handleCompanionImportBuild(build);
    }
  }
}

function onIframeMessage(event: MessageEvent) {
  const data = event.data as
    | { type?: string; payload?: { build?: Build } }
    | undefined;

  if (data?.type !== "lelanation:companion-import-build") {
    return;
  }

  if (!allowedIframeOrigins().includes(event.origin)) {
    showImportNotification(
      settings.value.language === "en"
        ? `Import blocked (origin: ${event.origin}). Check VITE_API_BASE / site URL.`
        : `Import bloqué (origine : ${event.origin}). Vérifie VITE_API_BASE / l'URL du site.`,
      false
    );
    return;
  }
  if (!data.payload?.build) {
    showImportNotification(
      settings.value.language === "en"
        ? "Import failed: missing build payload."
        : "Echec import: payload build manquant.",
      false
    );
    return;
  }

  handleCompanionImportBuild(data.payload.build);
}

onMounted(async () => {
  importInProgress.value = false;
  try {
    currentAppVersion.value = await getVersion();
  } catch {
    currentAppVersion.value = "dev";
  }
  void refreshStatus();

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

  drainQueuedImportMessages();

  bridgeUnlisten = await listen<{ build?: Build; via?: string }>(
    "companion-import-build",
    (event) => {
      if (event.payload?.build) {
        handleCompanionImportBuild(event.payload.build);
      }
    }
  );

  try {
    postgameUnlisten = await listen("lcu:checklist-saved", () => {
      currentPage.value = "checklist";
      showImportNotification(t("checklist.notifySaved"), true);
    });
  } catch {
    /* browser preview */
  }

  window.addEventListener("message", onIframeMessage, true);
  document.addEventListener("message", onIframeMessage as EventListener, true);
});
onUnmounted(() => {
  if (updateCheckTimer) clearInterval(updateCheckTimer);
  if (importNotificationTimer) clearTimeout(importNotificationTimer);
  if (bridgeUnlisten) void bridgeUnlisten();
  if (postgameUnlisten) void postgameUnlisten();
  window.removeEventListener("message", onIframeMessage, true);
  document.removeEventListener("message", onIframeMessage as EventListener, true);
});
</script>

<template>
  <div class="app-frame">
    <header class="top-bar">
      <div class="top-bar-row">
        <div class="brand">
          <span class="brand-title">Lelanation Companion</span>
        </div>
        <div class="top-actions">
          <button
            type="button"
            class="checklist-header-btn"
            :class="{ active: currentPage === 'checklist' }"
            :title="t('nav.checklist')"
            @click="currentPage = 'checklist'"
          >
            {{ t("nav.checklist") }}
          </button>
          <button type="button" class="icon-btn" :title="t('settings.more')" @click="currentPage = 'settings'">
            ⚙
          </button>
          <span
            class="lcu-pill"
            :data-ok="lcuOk ? '1' : '0'"
            :title="lcuStatusTitle"
            :aria-label="lcuStatusTitle"
            role="status"
          >
            <span class="lcu-status-icon" aria-hidden="true">{{ lcuOk ? "✓" : "✕" }}</span>
          </span>
        </div>
      </div>
      <nav class="app-nav" aria-label="Navigation">
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
    </header>

    <div
      v-if="importNotificationVisible && importFeedback"
      class="import-banner"
      :class="{ err: !importOk }"
      role="status"
    >
      {{ importFeedback }}
    </div>

    <div v-if="updateAvailable && settings.autoUpdate" class="update-banner">
      <span v-if="updateRestarting">{{ t("update.restarting") }}</span>
      <span v-else-if="updateInstalling">{{ t("update.installing", { progress: updateProgress }) }}</span>
      <span v-else>{{ t("update.available", { version: latestVersion }) }}</span>
      <p v-if="updateError" class="update-err">{{ t("update.error") }}: {{ updateError }}</p>
    </div>

    <ChecklistView
      v-if="currentPage === 'checklist'"
      :language="settings.language"
    />

    <KeyboardShortcutsView
      v-if="currentPage === 'shortcuts'"
      :language="settings.language"
    />

    <section v-else-if="isEmbeddedPage" class="presentation-shell">
      <iframe
        ref="iframeRef"
        :key="embeddedPageUrl"
        v-show="!iframeError"
        class="presentation-iframe"
        :src="embeddedPageUrl"
        title="Lelanation builds presentation"
        loading="eager"
        @load="onIframeLoad"
        @error="iframeError = true"
      />
      <div v-if="iframeError" class="iframe-fallback">
        <p>La page n'a pas pu etre chargee dans l'application.</p>
        <button type="button" class="btn-sm" @click="openUrl(embeddedPageUrl)">Ouvrir dans le navigateur</button>
      </div>
    </section>
    <section v-else-if="currentPage === 'settings'" class="settings-page">
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
      </div>
    </section>
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
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 0.5rem 0 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at 20% 0%, rgba(3, 151, 171, 0.18), transparent 38%),
    radial-gradient(circle at 80% 0%, rgba(200, 155, 60, 0.1), transparent 40%);
}
.top-bar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.45rem;
  margin: 0 1rem 0.5rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid rgba(200, 155, 60, 0.35);
  border-radius: 12px;
  background: linear-gradient(145deg, rgba(10, 20, 40, 0.92), rgba(10, 20, 40, 0.72));
}
.top-bar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 0;
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
  gap: 0.45rem;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  padding-bottom: 0.1rem;
}
.checklist-header-btn {
  padding: 0.38rem 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(126, 231, 135, 0.65);
  background: rgba(126, 231, 135, 0.14);
  color: #b8f0c8;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.checklist-header-btn:hover,
.checklist-header-btn.active {
  background: rgba(126, 231, 135, 0.28);
  border-color: rgba(126, 231, 135, 0.95);
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
  flex-shrink: 0;
}
.lcu-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid rgba(200, 155, 60, 0.45);
  background: rgba(10, 30, 50, 0.6);
  cursor: default;
}
.lcu-pill[data-ok="1"] {
  border-color: rgba(80, 200, 120, 0.65);
  background: rgba(40, 90, 55, 0.35);
}
.lcu-pill[data-ok="0"] {
  border-color: rgba(220, 90, 90, 0.55);
  background: rgba(90, 30, 30, 0.35);
}
.lcu-status-icon {
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1;
}
.lcu-pill[data-ok="1"] .lcu-status-icon {
  color: #7ee787;
}
.lcu-pill[data-ok="0"] .lcu-status-icon {
  color: #f28b82;
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
  min-height: 0;
  margin: 0 1rem 0.5rem;
  overflow: auto;
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
  flex-shrink: 0;
  margin: 0 1rem 0.5rem;
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
  min-height: 0;
  margin: 0 1rem 0.5rem;
  border: 1px solid rgba(200, 155, 60, 0.35);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: rgba(10, 20, 40, 0.72);
  box-shadow: 0 14px 35px rgba(0, 0, 0, 0.25);
}
.presentation-iframe {
  flex: 1;
  width: 100%;
  min-height: 0;
  border: none;
  display: block;
}
.iframe-fallback {
  padding: 1.25rem;
  text-align: center;
}
.import-banner {
  flex-shrink: 0;
  margin: 0 1rem 0.5rem;
  padding: 0.6rem 0.85rem;
  border-radius: 8px;
  border: 1px solid rgba(80, 200, 120, 0.45);
  background: rgba(80, 200, 120, 0.12);
  color: #b8f0c8;
  font-size: 0.88rem;
}
.import-banner.err {
  border-color: rgba(255, 138, 138, 0.45);
  background: rgba(255, 138, 138, 0.12);
  color: #ffb4b4;
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
