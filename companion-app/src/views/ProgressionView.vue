<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import {
  INTERNET_ITEM_ID,
  PROGRESSION_TABS,
  itemsGroupedBySection,
  type ProgressionTabId,
} from "../progression/definition";
import { progressionItemLabel, progressionSectionLabel } from "../i18n/progression-labels";
import { translate } from "../i18n";
import type { ProgressionSave } from "../types/progression";

const props = defineProps<{
  language: "fr" | "en";
}>();

const activeTab = ref<ProgressionTabId>("base");
const data = ref<ProgressionSave>({
  updatedAtMs: 0,
  checked: {},
  internetAuto: false,
  notes: "",
});
const saving = ref(false);
const saveMessage = ref("");
const checkingInternet = ref(false);

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function t(key: string, params?: Record<string, string | number>): string {
  return translate(props.language, key, params);
}

function itemLabel(id: string): string {
  return progressionItemLabel(props.language, id) ?? id;
}

function sectionLabel(section: string): string {
  return progressionSectionLabel(props.language, section);
}

function tabLabel(tabId: ProgressionTabId): string {
  return t(`progression.tabs.${tabId}`);
}

const groupedItems = computed(() => itemsGroupedBySection(activeTab.value));

const tabProgress = computed(() => {
  const out: Record<string, { done: number; total: number }> = {};
  for (const tab of PROGRESSION_TABS) {
    const groups = itemsGroupedBySection(tab.id);
    const ids = groups.flatMap((g) => g.ids);
    const done = ids.filter((id) => data.value.checked[id]).length;
    out[tab.id] = { done, total: ids.length };
  }
  return out;
});

function isChecked(id: string): boolean {
  return !!data.value.checked[id];
}

function isAutoItem(id: string): boolean {
  return id === INTERNET_ITEM_ID;
}

function toggleItem(id: string) {
  if (isAutoItem(id)) return;
  data.value.checked[id] = !data.value.checked[id];
  scheduleSave();
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void persist();
  }, 600);
}

async function runInternetTest() {
  checkingInternet.value = true;
  try {
    data.value = await invoke<ProgressionSave>("get_progression");
  } catch {
    /* browser preview */
  } finally {
    checkingInternet.value = false;
  }
}

async function persist() {
  saving.value = true;
  saveMessage.value = "";
  try {
    data.value = await invoke<ProgressionSave>("save_progression", { data: data.value });
    saveMessage.value = t("progression.saved");
  } catch (e) {
    saveMessage.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void runInternetTest();
});
</script>

<template>
  <section class="progression-page">
    <header class="progression-header">
      <div>
        <h2>{{ t("progression.title") }}</h2>
        <p class="progression-sub">{{ t("progression.subtitle") }}</p>
      </div>
    </header>

    <nav class="tab-bar" aria-label="Progression">
      <button
        v-for="tab in PROGRESSION_TABS"
        :key="tab.id"
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tabLabel(tab.id) }}
        <span class="tab-count">{{ tabProgress[tab.id]?.done }}/{{ tabProgress[tab.id]?.total }}</span>
      </button>
    </nav>

    <div class="tab-panel">
      <div
        v-for="group in groupedItems"
        :key="group.section"
        class="item-group"
      >
        <h3 v-if="groupedItems.length > 1">{{ sectionLabel(group.section) }}</h3>
        <ul>
          <li v-for="id in group.ids" :key="id">
            <label class="item-row" :class="{ auto: isAutoItem(id) }">
              <input
                type="checkbox"
                :checked="isChecked(id)"
                :disabled="isAutoItem(id) || (id === INTERNET_ITEM_ID && checkingInternet)"
                @change="toggleItem(id)"
              />
              <span>{{ itemLabel(id) }}</span>
              <span
                v-if="id === INTERNET_ITEM_ID && checkingInternet"
                class="checking-tag"
              >
                {{ t("progression.checkingInternet") }}
              </span>
              <span v-else-if="isAutoItem(id)" class="auto-tag">{{ t("progression.auto") }}</span>
            </label>
          </li>
        </ul>
      </div>
    </div>

    <label class="notes-field">
      <span>{{ t("progression.notes") }}</span>
      <textarea
        v-model="data.notes"
        rows="3"
        :placeholder="t('progression.notesPlaceholder')"
        @input="scheduleSave"
      />
    </label>

    <div class="footer-actions">
      <button type="button" class="btn-primary" :disabled="saving" @click="persist">
        {{ saving ? t("progression.saving") : t("progression.save") }}
      </button>
      <span v-if="saveMessage" class="save-msg">{{ saveMessage }}</span>
    </div>
  </section>
</template>

<style scoped>
.progression-page {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 1rem 1.25rem 2rem;
  background: #0f1419;
  color: #e8eaed;
}
.progression-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}
.progression-header h2 {
  margin: 0 0 0.35rem;
  font-size: 1.25rem;
}
.progression-sub {
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
.tab-panel {
  background: #151b24;
  border: 1px solid #2d3748;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
}
.item-group {
  margin-bottom: 0.75rem;
}
.item-group:last-child {
  margin-bottom: 0;
}
.item-group h3 {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #8ab4f8;
}
.item-group ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.item-group li {
  border-bottom: 1px solid #1f2933;
}
.item-group li:last-child {
  border-bottom: none;
}
.item-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.45rem 0;
  cursor: pointer;
  font-size: 0.92rem;
  width: 100%;
}
.item-row.auto {
  opacity: 0.95;
}
.auto-tag,
.checking-tag {
  margin-left: auto;
  font-size: 0.72rem;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  flex-shrink: 0;
}
.auto-tag {
  background: #1e3a5f;
  color: #8ab4f8;
}
.checking-tag {
  background: #2a2a1a;
  color: #fdd663;
}
.notes-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}
.notes-field textarea {
  background: #151b24;
  border: 1px solid #2d3748;
  border-radius: 6px;
  color: #e8eaed;
  padding: 0.5rem 0.65rem;
  resize: vertical;
  font-family: inherit;
}
.footer-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.btn-primary {
  padding: 0.5rem 1rem;
  background: #8ab4f8;
  color: #0f1419;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-sm {
  padding: 0.35rem 0.65rem;
  background: #1f2933;
  border: 1px solid #3c4043;
  border-radius: 6px;
  color: #e8eaed;
  cursor: pointer;
  font-size: 0.85rem;
  flex-shrink: 0;
}
.save-msg {
  font-size: 0.85rem;
  color: #7ee787;
}
</style>
