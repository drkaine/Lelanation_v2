<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onUnmounted, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { apiBase } from "../config";
import { getFavoriteIds, setFavoriteIds, toggleFavorite, isFavorite } from "../favorites";
import { getSettings, setSettings } from "../settings";
import { hasConsent } from "../consent";
import { getImportedBuilds, mergeImportedBuilds, clearImportedBuilds } from "../importedBuilds";
import { translate } from "../i18n";
import type { Build, SubBuild, Role, Champion, StoredBuild, Item, YouTubeVideo } from "@lelanation/shared-types";
import {
  BuildCardFlip,
  BuildDiscoveryCardShell,
  BuildDiscoveryFiltersShell,
  BuildDiscoveryListShell,
  serializeBuild,
} from "@lelanation/builds-ui";
import type { ImageResolvers, RuneLookup } from "@lelanation/builds-ui";
import { applyVideoFilters, dedupeAndSortVideos, filterAndSortBuilds } from "@lelanation/front-core";
import BuildDetailView from "./BuildDetailView.vue";

const builds = ref<Build[]>([]);
const loading = ref(true);
const activeTab = ref<"builds" | "mes-builds" | "favoris" | "create" | "videos" | "settings">("builds");
const lcuConnected = ref(false);
const connectionTested = ref(false);
const submitMessage = ref("");
const submitError = ref(false);
const favoriteIds = ref<string[]>([]);
const shortcutMessage = ref("");
const shortcutError = ref(false);
const currentGameVersion = ref("");
const runeMap = ref<Record<number, { name: string; icon: string }>>({});
const runePathMap = ref<Record<number, { name: string; icon: string }>>({});
const championMap = ref<Record<string, Champion>>({});
const itemMap = ref<Record<string, Item>>({});
const lastSubmittedMatchId = ref("");
let autoSubmitTimer: ReturnType<typeof setInterval> | null = null;
let buildsRefreshTimer: ReturnType<typeof setInterval> | null = null;
let connectionCheckTimer: ReturnType<typeof setInterval> | null = null;
let updateCheckTimer: ReturnType<typeof setInterval> | null = null;

const searchQuery = ref("");
const selectedRole = ref<Role | null>(null);
const sortBy = ref<"recent" | "name">("recent");
const onlyUpToDate = ref(false);

const linkCode = ref("");
const linkLoading = ref(false);
const linkMessage = ref("");
const linkError = ref(false);
const importedBuilds = ref<Build[]>([]);
const createBuildName = ref("");
const createBuildChampionId = ref("");
const createBuildRole = ref<Role>("top");
const createBuildDescription = ref("");
const createBuildMessage = ref("");
const createBuildError = ref(false);

const videosLoading = ref(false);
const videosError = ref("");
const videos = ref<YouTubeVideo[]>([]);
const videoQuery = ref("");
const videoChannelFilter = ref<"all" | string>("all");
const videoTypeFilter = ref<"all" | "builds" | "lobby" | "other">("all");
const videoFormatFilter = ref<"all" | "videos" | "shorts">("all");
const voteByBuildId = ref<Record<string, "up" | "down" | null>>({});
const buildCardFlipRefs = ref<Record<string, { toggleFlipped: () => void } | null>>({});

const clientTestLoading = ref(false);
const clientTestMessage = ref("");
const clientTestError = ref(false);
const connectionDebugInfo = ref("");

const updateAvailable = ref(false);
const updateDismissed = ref(false);
const detailBuild = ref<Build | null>(null);

/** Variante affichée par build (null = principale, number = index dans subBuilds) */
const selectedSubIdxMap = ref<Record<string, number | null>>({});

/** Retourne le build ou la variante fusionnée à afficher pour un build donné (utilisé par importBuild).
 *  Si une variante est sélectionnée, son titre remplace le nom (pour les pages de runes / sets d'items). */
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
    description: sub.description ?? b.description,
    gameVersion: sub.gameVersion || b.gameVersion,
  } as Build;
}

const latestVersion = ref("");
const currentAppVersion = ref("");
const pendingUpdate = shallowRef<Update | null>(null);
const updateInstalling = ref(false);
const updateRestarting = ref(false);
const updateProgress = ref(0);
const updateError = ref("");

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

function applySharedBuildFilters(input: Build[]): Build[] {
  let list = [...input];
  if (onlyUpToDate.value && currentMajorMinor.value) {
    const prefix = currentMajorMinor.value;
    list = list.filter((b) => (b.gameVersion ?? "").startsWith(prefix));
  }

  return filterAndSortBuilds(list, {
    searchQuery: searchQuery.value,
    selectedChampion: null,
    selectedRole: selectedRole.value,
    selectedVersion: null,
    sortBy: sortBy.value,
  });
}

const sortedBuilds = computed(() => {
  return applySharedBuildFilters(builds.value);
});

const favoriteBuilds = computed(() => {
  const ids = new Set(favoriteIds.value);
  return sortedBuilds.value.filter((b) => ids.has(b.id));
});

const myImportedBuilds = computed(() => {
  return applySharedBuildFilters(importedBuilds.value);
});

const displayedBuilds = computed(() => {
  if (activeTab.value === "favoris") return favoriteBuilds.value;
  if (activeTab.value === "mes-builds") return myImportedBuilds.value;
  const ids = importedBuildIds.value;
  return sortedBuilds.value.filter((b) => !ids.has(b.id));
});

const importedBuildIds = computed(() => new Set(importedBuilds.value.map(b => b.id)));
const championOptions = computed(() =>
  Object.values(championMap.value).sort((a, b) => a.name.localeCompare(b.name, settings.value.language))
);
const videoChannels = computed(() => {
  const byId = new Map<string, string>();
  for (const v of videos.value) {
    if (!byId.has(v.channelId)) byId.set(v.channelId, v.channelTitle || v.channelId);
  }
  return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
});
const filteredVideos = computed(() =>
  applyVideoFilters(dedupeAndSortVideos(videos.value), {
    query: videoQuery.value,
    channelId: videoChannelFilter.value,
    category: videoTypeFilter.value,
    format: videoFormatFilter.value,
  })
);

function loadVotes() {
  try {
    const raw = localStorage.getItem("companion.buildVotes");
    voteByBuildId.value = raw ? (JSON.parse(raw) as Record<string, "up" | "down" | null>) : {};
  } catch {
    voteByBuildId.value = {};
  }
}

function persistVotes() {
  try {
    localStorage.setItem("companion.buildVotes", JSON.stringify(voteByBuildId.value));
  } catch {
    // no-op
  }
}

function getUserVote(buildId: string): "up" | "down" | null {
  return voteByBuildId.value[buildId] ?? null;
}

function getUpvoteCount(build: Build): number {
  const base = Number(build.upvote) || 0;
  const vote = getUserVote(build.id);
  return vote === "up" ? base + 1 : base;
}

function getDownvoteCount(build: Build): number {
  const base = Number(build.downvote) || 0;
  const vote = getUserVote(build.id);
  return vote === "down" ? base + 1 : base;
}

function handleUpvote(buildId: string) {
  const current = getUserVote(buildId);
  voteByBuildId.value[buildId] = current === "up" ? null : "up";
  persistVotes();
}

function handleDownvote(buildId: string) {
  const current = getUserVote(buildId);
  voteByBuildId.value[buildId] = current === "down" ? null : "down";
  persistVotes();
}

async function copyBuildLink(buildId: string) {
  const url = `${apiBase}/builds/${buildId}`;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    // ignore
  }
}

function setBuildCardFlipRef(buildId: string, instance: unknown) {
  if (
    instance &&
    typeof instance === "object" &&
    "toggleFlipped" in instance &&
    typeof (instance as { toggleFlipped?: unknown }).toggleFlipped === "function"
  ) {
    buildCardFlipRefs.value[buildId] = instance as { toggleFlipped: () => void };
    return;
  }
  buildCardFlipRefs.value[buildId] = null;
}

function toggleBuildVariants(buildId: string) {
  buildCardFlipRefs.value[buildId]?.toggleFlipped();
}

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
        5006: "move.png",
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

function enrichBuilds(rawBuilds: Build[]): Build[] {
  return rawBuilds.map(enrichBuild);
}

async function loadBuilds(options?: { silent?: boolean }) {
  if (!options?.silent) loading.value = true;
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
    if (!options?.silent) loading.value = false;
  }
}

async function loadVideos(options?: { silent?: boolean }) {
  if (!options?.silent) videosLoading.value = true;
  videosError.value = "";
  try {
    const statusRes = await fetch(`${apiBase}/api/youtube/status`);
    if (!statusRes.ok) throw new Error(`status ${statusRes.status}`);
    const statusPayload = (await statusRes.json()) as { channels?: Array<{ channelId: string }> };
    const channels = Array.isArray(statusPayload.channels) ? statusPayload.channels : [];
    const all: YouTubeVideo[] = [];

    await Promise.all(
      channels.map(async (entry) => {
        const channelId = entry.channelId;
        if (!channelId) return;
        try {
          const channelRes = await fetch(`${apiBase}/api/youtube/channels/${encodeURIComponent(channelId)}`);
          if (!channelRes.ok) return;
          const payload = (await channelRes.json()) as { videos?: YouTubeVideo[] };
          if (Array.isArray(payload.videos)) {
            all.push(...payload.videos);
          }
        } catch {
          // ignore individual channel errors
        }
      })
    );

    videos.value = dedupeAndSortVideos(all);
  } catch {
    videosError.value = "Impossible de charger les vidéos.";
    videos.value = [];
  } finally {
    if (!options?.silent) videosLoading.value = false;
  }
}

function loadImportedBuilds() {
  const stored = getImportedBuilds();
  importedBuilds.value = stored.map((s) => enrichBuild(s as unknown as Build));
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
    const payload = (await r.json()) as { builds: StoredBuild[]; favoriteIds?: string[] };
    const count = mergeImportedBuilds(payload.builds);
    if (Array.isArray(payload.favoriteIds) && payload.favoriteIds.length > 0) {
      const buildIds = new Set(payload.builds.map((b) => b.id));
      const validFavIds = payload.favoriteIds.filter((id) => typeof id === "string" && buildIds.has(id));
      const current = getFavoriteIds();
      const merged = [...new Set([...current, ...validFavIds])];
      setFavoriteIds(merged);
      refreshFavorites();
    }
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
    if (importedBuilds.value.length > 0) {
      importedBuilds.value = importedBuilds.value.map(enrichBuild);
    }
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

async function importBuild(rawBuild: Build) {
  if (!lcuConnected.value) return;

  // Utiliser la variante affichée (sous-build sélectionné ou build principal)
  const build = displayedBuildFor(rawBuild);

  const errors: string[] = [];

  if (settings.value.importRunes && build.runes) {
    try {
      const selectedPerkIds = [
        build.runes.primary.keystone,
        build.runes.primary.slot1,
        build.runes.primary.slot2,
        build.runes.primary.slot3,
        build.runes.secondary.slot1,
        build.runes.secondary.slot2,
      ];
      const shards = build.shards;
      if (shards) {
        selectedPerkIds.push(shards.slot1, shards.slot2, shards.slot3);
      }

      const pageTitle = build.name || "Lelanation";
      const runePage = {
        name: pageTitle,
        primaryStyleId: build.runes.primary.pathId,
        subStyleId: build.runes.secondary.pathId,
        selectedPerkIds,
        current: true,
      };

      const pagesJson = await invoke<string>("lcu_request", {
        method: "GET",
        path: "/lol-perks/v1/pages",
        body: null,
      });
      const pages = JSON.parse(pagesJson) as Array<{ id: number; name: string; isDeletable: boolean }>;
      // Priorité : page existante avec le même titre, sinon première page supprimable
      const pageToDelete = pages.find(p => p.isDeletable && p.name === pageTitle)
        ?? pages.find(p => p.isDeletable);
      if (pageToDelete) {
        await invoke<string>("lcu_request", {
          method: "DELETE",
          path: `/lol-perks/v1/pages/${pageToDelete.id}`,
          body: null,
        });
      }
      await invoke<string>("lcu_request", {
        method: "POST",
        path: "/lol-perks/v1/pages",
        body: JSON.stringify(runePage),
      });
    } catch (e) {
      errors.push(t("import") + " runes: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  if (settings.value.importSummonerSpells && build.summonerSpells) {
    try {
      const spell1 = build.summonerSpells[0];
      const spell2 = build.summonerSpells[1];
      if (spell1 && spell2) {
        const body = {
          spell1Id: Number(spell1.key ?? spell1.id),
          spell2Id: Number(spell2.key ?? spell2.id),
        };
        await invoke<string>("lcu_request", {
          method: "PATCH",
          path: "/lol-champ-select/v1/session/my-selection",
          body: JSON.stringify(body),
        });
      }
    } catch {
      // Summoner spell import requires active champ select
    }
  }

  if (settings.value.importItems && build.items?.length) {
    try {
      const summonerJson = await invoke<string>("lcu_request", {
        method: "GET",
        path: "/lol-summoner/v1/current-summoner",
        body: null,
      });
      const summoner = JSON.parse(summonerJson) as { summonerId: number };

      const setTitle = build.name || "Lelanation";
      const champId = build.champion?.key ?? build.champion?.id ?? "0";
      const champIdNum = Number(champId);

      const itemBlock = {
        hideIfSummonerSpell: "",
        items: build.items.map(item => ({
          id: String(item.id),
          count: 1,
        })),
        type: setTitle,
      };

      const itemSet = {
        title: setTitle,
        associatedChampions: [champIdNum],
        associatedMaps: [],
        blocks: [itemBlock],
        map: "any",
        mode: "any",
        preferredItemSlots: [],
        sortrank: 0,
        startedFrom: "custom",
        type: "custom",
      };

      const setsJson = await invoke<string>("lcu_request", {
        method: "GET",
        path: `/lol-item-sets/v1/item-sets/${summoner.summonerId}/sets`,
        body: null,
      });
      const setsData = JSON.parse(setsJson) as {
        accountId: number;
        itemSets: Array<{ title: string; associatedChampions?: number[] }>;
        timestamp: number;
      };

      // Remplace le set existant avec le même titre (et le même champion) si trouvé
      const existingIdx = setsData.itemSets.findIndex(
        s => s.title === setTitle && s.associatedChampions?.includes(champIdNum)
      );
      const newItemSets = [...setsData.itemSets];
      if (existingIdx >= 0) {
        newItemSets[existingIdx] = itemSet;
      } else {
        newItemSets.push(itemSet);
      }

      await invoke<string>("lcu_request", {
        method: "PUT",
        path: `/lol-item-sets/v1/item-sets/${summoner.summonerId}/sets`,
        body: JSON.stringify({ ...setsData, itemSets: newItemSets }),
      });
    } catch {
      // Item import requires active client
    }
  }

  if (errors.length > 0) {
    submitMessage.value = errors.join("; ");
    submitError.value = true;
  } else {
    submitMessage.value = t("importSuccess");
    submitError.value = false;
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

async function createBuildFromCompanion() {
  createBuildMessage.value = "";
  createBuildError.value = false;

  const name = createBuildName.value.trim();
  const championId = createBuildChampionId.value.trim();
  if (!name || !championId) {
    createBuildError.value = true;
    createBuildMessage.value = "Nom du build et champion requis.";
    return;
  }

  const champion = championMap.value[championId];
  if (!champion) {
    createBuildError.value = true;
    createBuildMessage.value = "Champion introuvable.";
    return;
  }

  const now = new Date().toISOString();
  const newBuild: Build = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `cmp-${Date.now()}`,
    name,
    author: "Companion",
    description: createBuildDescription.value.trim() || undefined,
    visibility: "private",
    champion,
    items: [],
    runes: null,
    shards: null,
    summonerSpells: [null, null],
    skillOrder: null,
    roles: [createBuildRole.value],
    upvote: 0,
    downvote: 0,
    gameVersion: currentGameVersion.value || "unknown",
    createdAt: now,
    updatedAt: now,
    subBuilds: [],
    descriptionMode: "single",
  };

  mergeImportedBuilds([serializeBuild(newBuild)]);
  loadImportedBuilds();
  activeTab.value = "mes-builds";
  createBuildMessage.value = "Build créé dans Mes builds.";
  createBuildName.value = "";
  createBuildDescription.value = "";
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

async function checkConnection(silent = false) {
  try {
    await invoke<string>("lcu_request", {
      method: "GET",
      path: "/lol-summoner/v1/current-summoner",
      body: null,
    });
    lcuConnected.value = true;
    if (!silent) {
      connectionTested.value = true;
      clientTestMessage.value = t("settings.testConnectionSuccess");
      clientTestError.value = false;
    }
  } catch (e) {
    lcuConnected.value = false;
    if (!silent) {
      connectionTested.value = true;
      clientTestError.value = true;
      const errMsg = e instanceof Error ? e.message : String(e);
      clientTestMessage.value =
        errMsg && !errMsg.includes("League Client not found")
          ? `${t("settings.testConnectionFail")} (${errMsg})`
          : t("settings.testConnectionFail");
    }
  }
}

async function testClientConnection() {
  clientTestMessage.value = "";
  clientTestError.value = false;
  connectionDebugInfo.value = "";
  clientTestLoading.value = true;
  try {
    await checkConnection(false);
  } finally {
    clientTestLoading.value = false;
  }
}

async function showConnectionDebug() {
  try {
    connectionDebugInfo.value = await invoke<string>("lcu_debug");
  } catch (e) {
    connectionDebugInfo.value = e instanceof Error ? e.message : String(e);
  }
}

const CONNECTION_CHECK_INTERVAL_MS = 30 * 1000; // 30 s

function startConnectionCheckLoop() {
  if (connectionCheckTimer) return;
  connectionCheckTimer = setInterval(() => checkConnection(true), CONNECTION_CHECK_INTERVAL_MS);
}

function stopConnectionCheckLoop() {
  if (!connectionCheckTimer) return;
  clearInterval(connectionCheckTimer);
  connectionCheckTimer = null;
}

/** Last match from LCU - supports both /games and /products/lol/{puuid}/matches formats */
type LcuGame = { gameId?: number; platformId?: string; gameId64?: string };

async function getLastMatchFromLcu(): Promise<LcuGame | null> {
  try {
    // Primary: /lol-match-history/v1/games
    const gamesJson = await invoke<string>("lcu_request", {
      method: "GET",
      path: "/lol-match-history/v1/games",
      body: null,
    });
    const list = JSON.parse(gamesJson) as
      | { games?: LcuGame[] }
      | LcuGame[];
    const games = Array.isArray(list) ? list : list?.games ?? [];
    const last = games[0];
    if (last?.gameId || last?.gameId64) return last;
  } catch {
    /* fallback below */
  }
  try {
    // Fallback: /lol-match-history/v1/products/lol/{puuid}/matches (LCU API ref: swagger.dysolix.dev)
    const summonerJson = await invoke<string>("lcu_request", {
      method: "GET",
      path: "/lol-summoner/v1/current-summoner",
      body: null,
    });
    const summoner = JSON.parse(summonerJson) as { puuid?: string };
    if (!summoner?.puuid) return null;
    const matchesJson = await invoke<string>("lcu_request", {
      method: "GET",
      path: `/lol-match-history/v1/products/lol/${summoner.puuid}/matches`,
      body: null,
    });
    const matchesData = JSON.parse(matchesJson) as
      | { games?: LcuGame[]; matchHistory?: LcuGame[] }
      | LcuGame[];
    const matches = Array.isArray(matchesData)
      ? matchesData
      : matchesData?.games ?? matchesData?.matchHistory ?? [];
    return matches[0] ?? null;
  } catch {
    return null;
  }
}

async function autoSubmitMatchIfAllowed() {
  if (!canAutoSubmitMatch.value) return;
  try {
    const last = await getLastMatchFromLcu();
    if (!last?.gameId && !last?.gameId64) return;

    const gameId = last.gameId ?? (last.gameId64 ? parseInt(last.gameId64, 10) : 0);
    if (!gameId) return;
    const region = (last.platformId || "euw1").toLowerCase();
    const matchId = last.platformId ? `${last.platformId}_${gameId}` : String(gameId);
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

const BUILDS_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 min

function startBuildsRefreshLoop() {
  if (buildsRefreshTimer) return;
  buildsRefreshTimer = setInterval(() => loadBuilds({ silent: true }), BUILDS_REFRESH_INTERVAL_MS);
}

function stopBuildsRefreshLoop() {
  if (!buildsRefreshTimer) return;
  clearInterval(buildsRefreshTimer);
  buildsRefreshTimer = null;
}

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 heure

function startUpdateCheckLoop() {
  if (updateCheckTimer) return;
  updateCheckTimer = setInterval(() => checkForUpdates(), UPDATE_CHECK_INTERVAL_MS);
}

function stopUpdateCheckLoop() {
  if (!updateCheckTimer) return;
  clearInterval(updateCheckTimer);
  updateCheckTimer = null;
}

async function checkForUpdates() {
  try {
    currentAppVersion.value = await getVersion().catch(() => "");
    const update = await check();
    if (update) {
      latestVersion.value = update.version;
      pendingUpdate.value = update;
      updateAvailable.value = true;
    }
  } catch {
    // Silent: network errors shouldn't block the app
  }
}

async function installUpdate() {
  const update = pendingUpdate.value;
  if (!update) return;
  updateInstalling.value = true;
  updateError.value = "";
  updateProgress.value = 0;
  let downloaded = 0;
  try {
    await update.downloadAndInstall((event) => {
      if (event.event === "Started" && event.data.contentLength) {
        downloaded = 0;
      } else if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
        const total = (update as unknown as { contentLength?: number }).contentLength;
        if (total && total > 0) {
          updateProgress.value = Math.round((downloaded / total) * 100);
        }
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

const uninstallError = ref("");

async function uninstallApp() {
  uninstallError.value = "";
  try {
    await invoke("uninstall_app");
  } catch (e) {
    uninstallError.value = e instanceof Error ? e.message : t("settings.uninstallError");
  }
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
  loadVotes();
  loadCurrentGameVersion();
  loadRuneCatalog();
  loadItemCatalog();
  loadImportedBuilds();
  checkForUpdates();
  startUpdateCheckLoop();
  checkConnection(true);
  startConnectionCheckLoop();
  await loadChampionCatalog();
  loadBuilds();
  loadVideos({ silent: true });
  refreshFavorites();
  autoSubmitMatchIfAllowed();
  startAutoSubmitLoop();
  startBuildsRefreshLoop();
});

watch(activeTab, (tab) => {
  if (tab === "videos" && videos.value.length === 0 && !videosLoading.value) {
    loadVideos();
  }
});

onUnmounted(() => {
  stopAutoSubmitLoop();
  stopBuildsRefreshLoop();
  stopConnectionCheckLoop();
  stopUpdateCheckLoop();
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
    loadItemCatalog();
    await loadChampionCatalog();
  }
);
</script>

<template>
  <div class="main-shell">
    <!-- Build detail full page -->
    <BuildDetailView
      v-if="detailBuild"
      :build="detailBuild"
      :image-resolvers="imageResolvers"
      :rune-lookup="runeLookup"
      :build-version="buildVersion"
      :t="t"
      @back="detailBuild = null"
    />

    <template v-else>
    <header class="header-card">
      <div>
        <h1 class="title">Lelanation Companion</h1>
        <p class="subtitle">{{ t('subtitle') }}</p>
      </div>
      <span class="status-pill" :class="{ on: lcuConnected && connectionTested, off: connectionTested && !lcuConnected, untested: !connectionTested }">
        {{ !connectionTested ? t('status.untested') : (lcuConnected ? t('status.connected') : t('status.disconnected')) }}
      </span>
    </header>

    <div v-if="updateAvailable && !updateDismissed" class="update-banner">
      <span v-if="updateRestarting">{{ t('update.restarting') }}</span>
      <span v-else-if="updateInstalling">{{ t('update.installing', { progress: updateProgress }) }}</span>
      <span v-else>{{ t('update.available', { version: latestVersion }) }}</span>
      <div class="update-actions">
        <button
          v-if="!updateInstalling"
          type="button"
          class="update-download-btn"
          @click="installUpdate"
        >
          {{ t('update.install') }}
        </button>
        <button
          v-if="!updateInstalling"
          type="button"
          class="update-dismiss-btn"
          @click="updateDismissed = true"
        >
          {{ t('update.dismiss') }}
        </button>
      </div>
      <p v-if="updateError" class="update-error">{{ t('update.installError', { error: updateError }) }}</p>
    </div>

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
      <button class="tab-btn" :class="{ active: activeTab === 'create' }" @click="activeTab = 'create'">
        Créer
      </button>
      <button class="tab-btn" :class="{ active: activeTab === 'videos' }" @click="activeTab = 'videos'">
        Vidéos
      </button>
      <button class="tab-btn" :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'">
        {{ t('tabs.settings') }}
      </button>
    </nav>

    <!-- Filters -->
    <BuildDiscoveryFiltersShell
      v-if="['builds', 'mes-builds', 'favoris'].includes(activeTab)"
      :has-active-filters="hasActiveFilters"
      class="filters-bar"
      @clear="clearFilters"
    >
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
      </div>
      <template #clear-label>{{ t('clearFilters') }}</template>
    </BuildDiscoveryFiltersShell>

    <section v-if="['builds', 'mes-builds', 'favoris'].includes(activeTab)" class="panel">
      <p v-if="activeTab === 'builds' && loading" class="empty">{{ t('loading') }}</p>
      <p v-else-if="activeTab === 'mes-builds' && importedBuilds.length === 0" class="empty">
        {{ t('noImported') }}
      </p>
      <p v-else-if="displayedBuilds.length === 0" class="empty">
        {{ activeTab === "favoris" ? t('noFavorites') : t('noBuilds') }}
      </p>

      <BuildDiscoveryListShell v-else :empty="displayedBuilds.length === 0" class="build-grid">
        <BuildDiscoveryCardShell
          v-for="b in displayedBuilds"
          :key="b.id"
          :author="b.author || t('authorUnknown')"
          :show-badge="importedBuildIds.has(b.id)"
          :badge-label="t('badge.personal')"
        >
          <div class="card-top-actions">
            <button
              type="button"
              class="card-top-icon-btn"
              title="Variantes"
              @click="toggleBuildVariants(b.id)"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
            </button>
            <div class="card-top-spacer"></div>
            <button type="button" class="card-top-icon-btn" :title="t('detail')" @click="detailBuild = b">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            <button type="button" class="card-top-icon-btn" title="Partager" @click="copyBuildLink(b.id)">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5" />
              </svg>
            </button>
          </div>

          <BuildCardFlip
            :ref="instance => setBuildCardFlipRef(b.id, instance)"
            :build="b"
            :images="imageResolvers"
            :rune-lookup="runeLookup"
            :version="buildVersion(b)"
            :main-build-label="t('mainBuild')"
            :variant-label-fn="i => `${t('variant')} ${i + 1}`"
            @variant-change="idx => { selectedSubIdxMap[b.id] = idx }"
          />

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
            <button
              type="button"
              class="vote-btn up"
              :class="{ active: getUserVote(b.id) === 'up' }"
              @click="handleUpvote(b.id)"
            >
              <span>👍</span>
              <span>{{ getUpvoteCount(b) }}</span>
            </button>
            <button
              type="button"
              class="vote-btn down"
              :class="{ active: getUserVote(b.id) === 'down' }"
              @click="handleDownvote(b.id)"
            >
              <span>👎</span>
              <span>{{ getDownvoteCount(b) }}</span>
            </button>
            <button type="button" class="import-btn" :disabled="!lcuConnected" :title="t('import')" @click="importBuild(b)">
              {{ t('import') }}
            </button>
          </div>
        </BuildDiscoveryCardShell>
      </BuildDiscoveryListShell>
    </section>

    <section v-else-if="activeTab === 'create'" class="panel settings-panel">
      <h3>Créer un build</h3>
      <p class="hint-line">Création rapide locale dans le companion (build privé).</p>
      <div class="create-grid">
        <label class="create-field">
          <span>Nom du build</span>
          <input v-model="createBuildName" type="text" class="search-input" placeholder="Ex: Ahri Mid Safe" />
        </label>
        <label class="create-field">
          <span>Champion</span>
          <select v-model="createBuildChampionId" class="sort-select create-select">
            <option value="">Sélectionner un champion</option>
            <option v-for="champ in championOptions" :key="champ.id" :value="champ.id">
              {{ champ.name }}
            </option>
          </select>
        </label>
        <label class="create-field">
          <span>Rôle</span>
          <select v-model="createBuildRole" class="sort-select create-select">
            <option v-for="role in allRoles" :key="role" :value="role">{{ role }}</option>
          </select>
        </label>
        <label class="create-field create-field-full">
          <span>Description</span>
          <textarea v-model="createBuildDescription" class="create-textarea" rows="4" placeholder="Plan de jeu, powerspikes, matchup..." />
        </label>
      </div>
      <div class="create-actions">
        <button type="button" class="submit-btn" @click="createBuildFromCompanion">Créer le build</button>
      </div>
      <p v-if="createBuildMessage" :class="{ error: createBuildError }" class="msg">{{ createBuildMessage }}</p>
    </section>

    <section v-else-if="activeTab === 'videos'" class="panel">
      <div class="filters-bar">
        <input v-model="videoQuery" type="text" class="search-input" placeholder="Rechercher une vidéo..." />
        <select v-model="videoChannelFilter" class="sort-select create-select">
          <option value="all">Toutes les chaînes</option>
          <option v-for="channel in videoChannels" :key="channel.id" :value="channel.id">
            {{ channel.name }}
          </option>
        </select>
        <select v-model="videoTypeFilter" class="sort-select create-select">
          <option value="all">Tous types</option>
          <option value="builds">Build</option>
          <option value="lobby">Lobby</option>
          <option value="other">Autres</option>
        </select>
        <select v-model="videoFormatFilter" class="sort-select create-select">
          <option value="all">Tous formats</option>
          <option value="videos">Vidéos</option>
          <option value="shorts">Shorts</option>
        </select>
        <button type="button" class="submit-btn secondary" @click="loadVideos()">Actualiser</button>
      </div>
      <p v-if="videosLoading" class="empty">Chargement des vidéos...</p>
      <p v-else-if="videosError" class="msg error">{{ videosError }}</p>
      <p v-else-if="filteredVideos.length === 0" class="empty">Aucune vidéo disponible.</p>
      <div v-else class="video-grid">
        <article v-for="video in filteredVideos" :key="video.id" class="video-card">
          <img :src="video.thumbnailUrl" :alt="video.title" class="video-thumb" loading="lazy" />
          <div class="video-content">
            <h4 class="video-title">{{ video.title }}</h4>
            <p class="video-meta">{{ video.channelTitle }} • {{ new Date(video.publishedAt).toLocaleDateString() }}</p>
            <a :href="video.url" target="_blank" rel="noreferrer" class="detail-btn video-link">Voir sur YouTube</a>
          </div>
        </article>
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
      <p class="hint-line">{{ t("settings.importBeforeLobby") }}</p>
      <button
        type="button"
        class="submit-btn"
        :disabled="clientTestLoading"
        @click="testClientConnection"
      >
        {{ clientTestLoading ? "…" : t("settings.testConnection") }}
      </button>
      <p v-if="clientTestMessage" :class="{ error: clientTestError }" class="msg">
        {{ clientTestMessage }}
      </p>
      <button type="button" class="submit-btn secondary" @click="showConnectionDebug">
        {{ t('settings.connectionDebug') }}
      </button>
      <pre v-if="connectionDebugInfo" class="debug-output">{{ connectionDebugInfo }}</pre>
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

      <h3 class="mt">{{ t('settings.updateTitle') }}</h3>
      <p class="version-line">
        {{ t('settings.version') }} : v{{ currentAppVersion }}
      </p>
      <label class="row">
        <input
          type="checkbox"
          :checked="settings.autoUpdate"
          @change="saveSetting('autoUpdate', ($event.target as HTMLInputElement).checked)"
        />
        {{ t('settings.autoUpdate') }}
      </label>
      <p class="hint-line">
        {{ t('update.upToDate', { version: currentAppVersion }) }}
      </p>

      <h3 class="mt">{{ t('settings.shortcut') }}</h3>
      <button type="button" class="submit-btn" @click="createDesktopShortcut">
        {{ t('settings.createShortcut') }}
      </button>
      <p v-if="shortcutMessage" :class="{ error: shortcutError }" class="msg">{{ shortcutMessage }}</p>

      <h3 class="mt">{{ t('settings.uninstallTitle') }}</h3>
      <p class="hint-line">{{ t('settings.uninstallHint') }}</p>
      <button type="button" class="uninstall-btn" @click="uninstallApp">
        {{ t('settings.uninstallBtn') }}
      </button>
      <p v-if="uninstallError" class="msg error">{{ uninstallError }}</p>
    </section>
    </template>
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
.status-pill.untested { background: rgba(200, 155, 60, 0.12); border: 1px solid rgba(200, 155, 60, 0.4); color: rgba(240, 230, 210, 0.75); }

.tabs {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  margin-bottom: 0.9rem;
  border: 1px solid rgb(var(--rgb-accent) / 0.2);
  border-radius: 9999px;
  background: rgb(var(--rgb-background) / 0.22);
  padding: 0.2rem;
  max-width: 100%;
}
.tab-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: none;
  border-radius: 9999px;
  background: transparent;
  min-height: 36px;
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.1;
  color: rgb(var(--rgb-text) / 0.75);
  text-decoration: none;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}
.tab-btn:hover:not(:disabled) { background: rgb(var(--rgb-accent) / 0.14); color: var(--color-accent); }
.tab-btn.active { background: rgb(var(--rgb-accent) / 0.2); color: var(--color-accent); }
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
.create-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(220px, 1fr));
  gap: 0.75rem;
}
.create-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.82rem;
  color: rgba(240, 230, 210, 0.9);
}
.create-field-full {
  grid-column: 1 / -1;
}
.create-select {
  min-width: 220px;
}
.create-textarea {
  background: rgba(9, 20, 40, 0.95);
  color: #f0e6d2;
  border: 1px solid rgba(200, 155, 60, 0.45);
  border-radius: 8px;
  padding: 0.5rem 0.65rem;
  font-size: 0.82rem;
}
.create-actions {
  margin-top: 0.9rem;
}

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

.author { margin: 0; color: #c8aa6e; font-size: 0.94rem; font-weight: 600; display: flex; align-items: center; gap: 0.4rem; }
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
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
  width: 300px;
}

.build-entry .card-actions {
  margin-top: calc(0.75rem + 10px);
}

.card-top-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  width: 300px;
  margin-bottom: 0.35rem;
}

.card-top-spacer {
  flex: 1;
}

.card-top-icon-btn {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(var(--rgb-accent) / 0.55);
  border-radius: 8px;
  background: rgb(var(--rgb-background) / 0.22);
  color: rgb(var(--rgb-text));
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.card-top-icon-btn:hover {
  background: rgb(var(--rgb-accent) / 0.14);
  border-color: rgb(var(--rgb-accent) / 0.8);
  color: var(--color-accent);
}

.import-btn, .submit-btn {
  border: 1px solid rgba(3, 151, 171, 0.8); border-radius: 7px;
  background: rgba(10, 50, 60, 0.8); color: #cdfafa; cursor: pointer;
  padding: 0.38rem 0.7rem; font-size: 0.8rem;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.vote-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 8px;
  background: rgb(var(--rgb-background) / 0.22);
  padding: 0.35rem 0.45rem;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}
.vote-btn.up {
  border: 1px solid rgb(22 163 74 / 0.8);
  color: rgb(34 197 94);
}
.vote-btn.down {
  border: 1px solid rgb(220 38 38 / 0.8);
  color: rgb(239 68 68);
}
.vote-btn.up.active {
  background: rgb(22 163 74);
  color: white;
  border-color: rgb(21 128 61);
}
.vote-btn.down.active {
  background: rgb(220 38 38);
  color: white;
  border-color: rgb(185 28 28);
}
.vote-btn.up:hover:not(.active) {
  background: rgb(240 253 244);
}
.vote-btn.down:hover:not(.active) {
  background: rgb(254 242 242);
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
.submit-btn.secondary { margin-left: 0.5rem; opacity: 0.9; }
.debug-output { margin-top: 0.5rem; padding: 0.5rem; font-size: 0.72rem; background: rgba(0,0,0,0.4); border-radius: 6px; white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow-y: auto; }
.version-line { margin: 0 0 0.5rem; font-size: 0.88rem; color: #c8aa6e; }
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

.uninstall-btn {
  margin-top: 0.5rem; border: 1px solid rgba(239, 68, 68, 0.5); border-radius: 7px;
  background: rgba(239, 68, 68, 0.1); color: #fca5a5; cursor: pointer;
  padding: 0.38rem 0.7rem; font-size: 0.8rem;
  transition: background-color 0.15s, border-color 0.15s;
}
.uninstall-btn:hover { background: rgba(239, 68, 68, 0.25); border-color: rgba(239, 68, 68, 0.7); }

.update-banner {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  padding: 0.6rem 1rem; margin-bottom: 0.9rem; border-radius: 10px;
  background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.5);
  color: #93f2ce; font-size: 0.86rem; font-weight: 500;
}
.update-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }
.update-download-btn {
  border: 1px solid rgba(16, 185, 129, 0.7); border-radius: 7px;
  background: rgba(16, 185, 129, 0.2); color: #93f2ce; cursor: pointer;
  padding: 0.3rem 0.7rem; font-size: 0.8rem; font-weight: 600;
  transition: background-color 0.15s;
}
.update-download-btn:hover { background: rgba(16, 185, 129, 0.35); }
.update-dismiss-btn {
  border: none; background: transparent; color: rgba(240, 230, 210, 0.6);
  cursor: pointer; font-size: 0.78rem; text-decoration: underline; padding: 0.3rem 0.3rem;
}
.update-dismiss-btn:hover { color: #f0e6d2; }
.update-error { margin: 0.3rem 0 0; font-size: 0.78rem; color: #fecaca; }

.detail-btn {
  border: 1px solid rgba(200, 155, 60, 0.5);
  border-radius: 7px;
  background: rgba(30, 40, 45, 0.75);
  color: #c8aa6e;
  padding: 0.38rem 0.7rem;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}
.detail-btn:hover {
  background: rgba(200, 155, 60, 0.15);
  border-color: #c89b3c;
  color: #f0e6d2;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 0.9rem;
}
.video-card {
  border: 1px solid rgba(200, 155, 60, 0.25);
  border-radius: 10px;
  background: rgba(10, 20, 40, 0.55);
  overflow: hidden;
}
.video-thumb {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}
.video-content {
  padding: 0.7rem;
}
.video-title {
  margin: 0 0 0.35rem;
  font-size: 0.88rem;
  line-height: 1.3;
}
.video-meta {
  margin: 0 0 0.6rem;
  font-size: 0.75rem;
  color: rgba(240, 230, 210, 0.72);
}
.video-link {
  display: inline-block;
  text-decoration: none;
}

@media (max-width: 660px) {
  .header-card { flex-direction: column; align-items: flex-start; }
  .build-grid { grid-template-columns: 1fr; }
  .create-grid { grid-template-columns: 1fr; }
}

</style>
