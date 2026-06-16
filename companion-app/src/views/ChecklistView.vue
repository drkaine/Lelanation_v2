<script setup lang="ts">
import { onMounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import {
  PROGRESSION_TABS,
  PROGRESSION_ITEM_ORDER,
  ITEM_SECTIONS as PROGRESSION_ITEM_SECTIONS,
  type ProgressionTabId,
} from "../progression/definition";
import ImprovementTabPanel from "../components/ImprovementTabPanel.vue";
import { translate } from "../i18n";
import type { ProgressionSave } from "../types/progression";

const props = defineProps<{
  language: "fr" | "en";
}>();

const activeTab = ref<ProgressionTabId>("base");
const progressionProgress = ref<ProgressionSave>({
  updatedAtMs: 0,
  checked: {},
  internetAuto: false,
  notes: "",
});

function t(key: string, params?: Record<string, string | number>): string {
  return translate(props.language, key, params);
}

function tabLabel(tabId: ProgressionTabId): string {
  return t(`checklist.tabs.${tabId}`);
}

function tabProgressCount(tabId: ProgressionTabId): { done: number; total: number } {
  const tab = PROGRESSION_TABS.find((entry) => entry.id === tabId);
  if (!tab) return { done: 0, total: 0 };
  const sections = new Set<string>(tab.sections);
  const ids = PROGRESSION_ITEM_ORDER.filter((id) =>
    sections.has(PROGRESSION_ITEM_SECTIONS[id] ?? "")
  );
  const done = ids.filter((id) => progressionProgress.value.checked[id]).length;
  return { done, total: ids.length };
}

async function loadProgressionProgress() {
  try {
    progressionProgress.value = await invoke<ProgressionSave>("load_progression");
  } catch {
    /* browser preview */
  }
}

onMounted(() => {
  void loadProgressionProgress();
});
</script>

<template>
  <section class="checklist-page">
    <header class="checklist-header">
      <div>
        <h2>{{ t("checklist.title") }}</h2>
        <p class="checklist-sub">{{ t("checklist.subtitle") }}</p>
      </div>
    </header>

    <nav class="tab-bar" aria-label="Checklist">
      <button
        v-for="tab in PROGRESSION_TABS"
        :key="tab.id"
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tabLabel(tab.id) }}
        <span class="tab-count">
          {{ tabProgressCount(tab.id).done }}/{{ tabProgressCount(tab.id).total }}
        </span>
      </button>
    </nav>

    <ImprovementTabPanel
      :tab="activeTab"
      :language="language"
      @saved="loadProgressionProgress"
    />
  </section>
</template>

<style scoped>
.checklist-page {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 1rem 1.25rem 2rem;
  background: #0f1419;
  color: #e8eaed;
}
.checklist-header {
  margin-bottom: 0.75rem;
}
.checklist-header h2 {
  margin: 0 0 0.35rem;
  font-size: 1.25rem;
}
.checklist-sub {
  margin: 0;
  color: #9aa0a6;
  font-size: 0.9rem;
}
.tab-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 1rem;
}
.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.65rem;
  background: #151b24;
  border: 1px solid #2d3748;
  border-radius: 6px;
  color: #9aa0a6;
  cursor: pointer;
  font-size: 0.82rem;
}
.tab-btn.active {
  border-color: #8ab4f8;
  color: #e8eaed;
  background: #1a2332;
}
.tab-count {
  font-size: 0.72rem;
  color: #7ee787;
}
</style>
