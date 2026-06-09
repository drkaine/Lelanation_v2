<script setup lang="ts">
import { computed } from "vue";
import type { Build } from "@lelanation/shared-types";
import { buildToPayload } from "../lcuBuildImport";
import { useLcuExport } from "../composables/useLcuExport";

const props = defineProps<{
  build: Build;
  importRunes?: boolean;
  importItems?: boolean;
  importSummonerSpells?: boolean;
  t?: (key: string) => string;
}>();

const emit = defineEmits<{
  exported: [result: { runes: boolean; items: boolean; summoners: boolean; summonersPending: boolean }];
  error: [message: string];
}>();

const { lcuStatus, exportStatus, exportBuild, statusMessage } = useLcuExport();

const tooltipText = computed(() => {
  if (!lcuStatus.value.connected) {
    return "Ouvrez League of Legends pour exporter ce build.";
  }
  if (lcuStatus.value.phase === "ChampSelect") {
    return "Runes, items et sorts d'invocateur seront appliqués immédiatement.";
  }
  if (lcuStatus.value.phase === "Lobby") {
    return "Runes et items maintenant ; sorts en attente de la sélection de champion.";
  }
  return "Runes et items seront appliqués ; sorts en attente du champ select.";
});

async function onExport() {
  try {
    const payload = buildToPayload(props.build, {
      importRunes: props.importRunes ?? true,
      importItems: props.importItems ?? true,
      importSummonerSpells: props.importSummonerSpells ?? true,
    });
    const result = await exportBuild(payload);
    emit("exported", result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    emit("error", msg);
  }
}

function tr(key: string, fallback: string): string {
  return props.t?.(key) ?? fallback;
}
</script>

<template>
  <div class="build-export">
    <span class="lcu-badge" :data-connected="lcuStatus.connected ? '1' : '0'">
      {{ statusMessage }}
    </span>

    <button
      type="button"
      class="export-btn"
      :disabled="!lcuStatus.connected || exportStatus.loading"
      :title="tooltipText"
      @click="onExport"
    >
      <span v-if="exportStatus.loading" class="spinner" aria-hidden="true" />
      {{
        exportStatus.loading
          ? tr("importInProgress", "Export en cours…")
          : tr("importToClient", "Exporter vers le client")
      }}
    </button>

    <ul v-if="exportStatus.result" class="export-results">
      <li v-if="exportStatus.result.runes">✅ Page de runes appliquée</li>
      <li v-if="exportStatus.result.items">✅ Page d'items créée / mise à jour</li>
      <li v-if="exportStatus.result.summoners">✅ Sorts d'invocateur définis</li>
      <li v-if="exportStatus.result.summonersPending">⏳ Sorts en attente (champ select)</li>
      <li v-for="(err, i) in exportStatus.result.errors" :key="i" class="err">❌ {{ err }}</li>
    </ul>
    <p v-if="exportStatus.error" class="export-error">{{ exportStatus.error }}</p>
  </div>
</template>

<style scoped>
.build-export {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.lcu-badge {
  font-size: 0.78rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  border: 1px solid rgba(200, 155, 60, 0.45);
  align-self: flex-start;
}
.lcu-badge[data-connected="1"] {
  border-color: rgba(80, 200, 120, 0.55);
  color: #b8f0c8;
}
.export-btn {
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  border: 1px solid rgba(200, 155, 60, 0.55);
  background: rgba(10, 40, 60, 0.75);
  color: #cdfafa;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}
.export-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(205, 250, 250, 0.25);
  border-top-color: #cdfafa;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.export-results {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.82rem;
}
.export-results .err {
  color: #ffb4b4;
}
.export-error {
  margin: 0;
  color: #ffb4b4;
  font-size: 0.82rem;
}
</style>
