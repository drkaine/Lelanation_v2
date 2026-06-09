import { computed, onMounted, onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface LcuStatus {
  connected: boolean;
  phase: string;
  championId: number | null;
}

export interface ApplyResult {
  runes: boolean;
  items: boolean;
  summoners: boolean;
  summonersPending: boolean;
  errors: string[];
}

export interface BuildPayload {
  name: string;
  championId: number;
  championFolder?: string;
  buildId?: string;
  runes?: {
    primaryPath: number;
    secondaryPath: number;
    perks: {
      primaryPerks: [number, number, number, number];
      secondaryPerks: [number, number];
      shards: [number, number, number];
    };
  };
  items?: {
    starter: number[];
    core: number[];
    boots: number[];
    optional: number[];
  };
  summonerSpells?: [number, number];
  importRunes?: boolean;
  importItems?: boolean;
  importSummonerSpells?: boolean;
}

export function useLcuExport() {
  const lcuStatus = ref<LcuStatus>({
    connected: false,
    phase: "None",
    championId: null,
  });
  const exportStatus = ref<{
    loading: boolean;
    result: ApplyResult | null;
    error: string | null;
  }>({
    loading: false,
    result: null,
    error: null,
  });

  const unlisteners: UnlistenFn[] = [];

  async function refreshStatus() {
    try {
      const status = await invoke<LcuStatus>("get_lcu_status");
      lcuStatus.value = {
        connected: status.connected,
        phase: status.phase,
        championId: status.championId ?? null,
      };
    } catch {
      lcuStatus.value = { connected: false, phase: "None", championId: null };
    }
  }

  onMounted(async () => {
    await refreshStatus();

    unlisteners.push(
      await listen<string>("lcu:phase-changed", (event) => {
        lcuStatus.value.phase = event.payload;
      })
    );
    unlisteners.push(
      await listen("lcu:connected", () => {
        lcuStatus.value.connected = true;
      })
    );
    unlisteners.push(
      await listen("lcu:disconnected", () => {
        lcuStatus.value.connected = false;
        lcuStatus.value.phase = "None";
        lcuStatus.value.championId = null;
      })
    );
    unlisteners.push(
      await listen<number>("lcu:champion-selected", (event) => {
        lcuStatus.value.championId = event.payload;
      })
    );
    unlisteners.push(
      await listen<{ summoners?: boolean; buildName?: string }>("lcu:auto-applied", () => {
        void refreshStatus();
      })
    );
  });

  onUnmounted(() => {
    for (const unlisten of unlisteners) {
      void unlisten();
    }
  });

  async function exportBuild(build: BuildPayload) {
    exportStatus.value = { loading: true, result: null, error: null };
    try {
      const result = await invoke<ApplyResult>("apply_build", { build });
      exportStatus.value = { loading: false, result, error: null };
      await refreshStatus();
      return result;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      exportStatus.value = { loading: false, result: null, error };
      throw e;
    }
  }

  async function getPendingBuild() {
    return invoke<BuildPayload | null>("get_pending_build");
  }

  const statusMessage = computed(() => {
    if (!lcuStatus.value.connected) return "⚫ Client non détecté";
    if (lcuStatus.value.phase === "ChampSelect") return "🟢 En sélection — prêt";
    if (lcuStatus.value.phase === "Lobby") return "🟡 En lobby — runes et items seront appliqués";
    return "🔵 Connecté — en attente de lobby";
  });

  return {
    lcuStatus,
    exportStatus,
    exportBuild,
    getPendingBuild,
    refreshStatus,
    statusMessage,
  };
}
