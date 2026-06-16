<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import {
  INTERNET_ITEM_ID,
  itemsGroupedBySection,
  type ProgressionTabId,
} from "../progression/definition";
import { progressionItemLabel, progressionSectionIntro, progressionSectionLabel } from "../i18n/progression-labels";
import { translate } from "../i18n";
import { probeInternetFromWebView } from "../internetProbe";
import type { ProgressionSave } from "../types/progression";

const props = defineProps<{
  language: "fr" | "en";
  tab: ProgressionTabId;
}>();

const emit = defineEmits<{
  saved: [];
}>();

const data = ref<ProgressionSave>({
  updatedAtMs: 0,
  checked: {},
  internetAuto: false,
  notes: "",
});
const saving = ref(false);
const saveMessage = ref("");
const checkingInternet = ref(false);
const internetFeedback = ref("");

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

function sectionIntro(section: string): string {
  return progressionSectionIntro(props.language, section);
}

const groupedItems = computed(() => itemsGroupedBySection(props.tab));

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

async function loadData() {
  try {
    data.value = await invoke<ProgressionSave>("load_progression");
  } catch {
    /* browser preview */
  }
}

async function runInternetTest() {
  checkingInternet.value = true;
  internetFeedback.value = "";
  try {
    const webOk = await probeInternetFromWebView();
    let updated: ProgressionSave;

    if (webOk) {
      updated = await invoke<ProgressionSave>("confirm_internet_for_progression", { online: true });
    } else {
      updated = await invoke<ProgressionSave>("test_internet_for_progression");
    }

    data.value = {
      ...updated,
      checked: { ...(updated.checked ?? {}) },
    };
    const online = !!data.value.checked[INTERNET_ITEM_ID];
    internetFeedback.value = online
      ? t("checklist.improvement.internetOk")
      : t("checklist.improvement.internetFail");
    emit("saved");
  } catch (e) {
    internetFeedback.value =
      e instanceof Error ? e.message : t("checklist.improvement.internetFail");
  } finally {
    checkingInternet.value = false;
  }
}

async function persist() {
  saving.value = true;
  saveMessage.value = "";
  try {
    data.value = await invoke<ProgressionSave>("save_progression", { data: data.value });
    saveMessage.value = t("checklist.improvement.saved");
    emit("saved");
  } catch (e) {
    saveMessage.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void loadData();
});

watch(
  () => props.tab,
  (tab) => {
    if (tab === "base") void loadData();
  }
);
</script>

<template>
  <div class="improvement-panel">
    <div class="tab-panel">
      <div
        v-for="group in groupedItems"
        :key="group.section"
        class="item-group"
      >
        <h3 v-if="groupedItems.length > 1">{{ sectionLabel(group.section) }}</h3>
        <p v-if="sectionIntro(group.section)" class="section-intro">{{ sectionIntro(group.section) }}</p>

        <div
          v-if="props.tab === 'farm' && group.section === 'farm'"
          class="cs-reference"
        >
          <h4>{{ t("checklist.farm.csTableTitle") }}</h4>
          <table class="cs-table">
            <thead>
              <tr>
                <th></th>
                <th>80 %</th>
                <th>90 %</th>
                <th>95 %</th>
                <th>{{ t("checklist.farm.perfectFarm") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>{{ t("checklist.farm.at5") }}</th>
                <td>35</td>
                <td>40</td>
                <td>42</td>
                <td>44</td>
              </tr>
              <tr>
                <th>{{ t("checklist.farm.at10") }}</th>
                <td>85</td>
                <td>96</td>
                <td>101</td>
                <td>107</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ul>
          <template v-for="id in group.ids" :key="id">
            <li v-if="id === 'wave_first4_range_vs_melee' || id === 'lane_first4_range_vs_melee'" class="intro-li">
              <p class="section-intro">{{ t("checklist.wave.first4Intro") }}</p>
            </li>
            <li>
              <div v-if="id === INTERNET_ITEM_ID" class="internet-item">
                <label class="item-row" :class="{ auto: isAutoItem(id) }">
                  <input
                    type="checkbox"
                    :checked="isChecked(id)"
                    disabled
                  />
                  <span>{{ itemLabel(id) }}</span>
                  <span v-if="isAutoItem(id)" class="auto-tag">{{ t("checklist.improvement.auto") }}</span>
                </label>
                <button
                  type="button"
                  class="test-internet-btn"
                  :disabled="checkingInternet"
                  @click.stop.prevent="runInternetTest"
                >
                  {{
                    checkingInternet
                      ? t("checklist.improvement.checkingInternet")
                      : t("checklist.improvement.testInternet")
                  }}
                </button>
                <p
                  v-if="internetFeedback"
                  class="internet-feedback"
                  :class="{ ok: data.checked[INTERNET_ITEM_ID], fail: !data.checked[INTERNET_ITEM_ID] }"
                >
                  {{ internetFeedback }}
                </p>
              </div>
              <label v-else class="item-row">
                <input
                  type="checkbox"
                  :checked="isChecked(id)"
                  @change="toggleItem(id)"
                />
                <span>{{ itemLabel(id) }}</span>
              </label>
            </li>
          </template>
        </ul>

        <p
          v-if="props.tab === 'farm' && group.section === 'farm_training'"
          class="section-footnote"
        >
          {{ t("checklist.farm.elyndarSource") }}
          <a
            href="https://imgur.com/elyndars-guide-to-cs-like-challenger-orWUCKH"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t("checklist.farm.elyndarLink") }}
          </a>
        </p>
      </div>
    </div>

    <label class="notes-field">
      <span>{{ t("checklist.improvement.notes") }}</span>
      <textarea
        v-model="data.notes"
        rows="3"
        :placeholder="t('checklist.improvement.notesPlaceholder')"
        @input="scheduleSave"
      />
    </label>

    <div class="footer-actions">
      <button type="button" class="btn-primary" :disabled="saving" @click="persist">
        {{ saving ? t("checklist.improvement.saving") : t("checklist.improvement.save") }}
      </button>
      <span v-if="saveMessage" class="save-msg">{{ saveMessage }}</span>
    </div>
  </div>
</template>

<style scoped>
.tab-panel {
  background: #151b24;
  border: 1px solid #2d3748;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
}
.section-intro {
  margin: 0 0 0.65rem;
  color: #9aa0a6;
  font-size: 0.88rem;
  line-height: 1.45;
  white-space: pre-line;
}
.section-footnote {
  margin: 0.5rem 0 0;
  font-size: 0.82rem;
  color: #9aa0a6;
}
.section-footnote a {
  color: #8ab4f8;
}
.cs-reference {
  margin: 0 0 0.85rem;
  padding: 0.65rem 0.75rem;
  background: #0f1419;
  border: 1px solid #2d3748;
  border-radius: 8px;
}
.cs-reference h4 {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  color: #8ab4f8;
}
.cs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}
.cs-table th,
.cs-table td {
  border: 1px solid #2d3748;
  padding: 0.35rem 0.5rem;
  text-align: center;
}
.cs-table th:first-child {
  text-align: left;
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
.internet-item {
  padding: 0.45rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.test-internet-btn {
  align-self: flex-start;
  margin-left: 1.6rem;
  padding: 0.35rem 0.65rem;
  background: #1f2933;
  border: 1px solid #3c4043;
  border-radius: 6px;
  color: #e8eaed;
  cursor: pointer;
  font-size: 0.82rem;
}
.test-internet-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.test-internet-btn:hover:not(:disabled) {
  background: #2d3748;
}
.internet-feedback {
  margin: 0 0 0 1.6rem;
  font-size: 0.82rem;
}
.internet-feedback.ok {
  color: #7ee787;
}
.internet-feedback.fail {
  color: #f28b82;
}
.intro-li .section-intro {
  margin: 0.5rem 0 0.25rem;
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
.save-msg {
  font-size: 0.85rem;
  color: #7ee787;
}
</style>
