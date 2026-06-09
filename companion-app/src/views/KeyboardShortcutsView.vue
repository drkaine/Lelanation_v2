<script setup lang="ts">
import { computed } from "vue";
import { translate } from "../i18n";

const props = defineProps<{
  language: "fr" | "en";
}>();

function t(key: string): string {
  return translate(props.language, key);
}

const toggleRows = computed(() => [
  { keys: "Alt + T", label: t("shortcuts.disableTooltips") },
  { keys: "Alt + P", label: t("shortcuts.presentationMode") },
  { keys: "Alt + Z", label: t("shortcuts.presentationZoom") },
  { keys: "Alt + S", label: t("shortcuts.championSplash") },
  { keys: "Alt + C", label: t("shortcuts.simplifiedStats") },
]);

const shortcutRows = computed(() => [
  { keys: "Alt + H", label: t("shortcuts.openModal") },
  ...toggleRows.value,
]);
</script>

<template>
  <section class="shortcuts-page">
    <div class="shortcuts-modal">
      <header class="shortcuts-header">
        <h2 class="shortcuts-title">{{ t("shortcuts.title") }}</h2>
        <p class="shortcuts-hint">{{ t("shortcuts.hint") }}</p>
      </header>

      <div class="shortcuts-grid">
        <section class="shortcuts-section">
          <h3 class="shortcuts-section-title">{{ t("shortcuts.togglesSection") }}</h3>
          <ul class="shortcuts-toggle-list">
            <li v-for="row in toggleRows" :key="row.keys" class="shortcuts-toggle-row">
              <span class="shortcuts-label">{{ row.label }}</span>
              <span class="shortcut-key">{{ row.keys }}</span>
            </li>
          </ul>
        </section>

        <section class="shortcuts-section">
          <h3 class="shortcuts-section-title">{{ t("shortcuts.shortcutsSection") }}</h3>
          <ul class="shortcuts-list">
            <li v-for="row in shortcutRows" :key="`list-${row.keys}`">
              <span class="shortcut-key">{{ row.keys }}</span>
              <span>{{ row.label }}</span>
            </li>
          </ul>
          <p class="shortcuts-help">
            {{ t("shortcuts.builderLabel") }}:
            <span class="shortcut-key">Ctrl + ←</span>
            {{ t("shortcuts.previousStep") }},
            <span class="shortcut-key">Ctrl + →</span>
            {{ t("shortcuts.nextStep") }}
          </p>
          <p class="shortcuts-help">
            <span class="shortcut-key">Ctrl + ↓</span>
            {{ t("shortcuts.showBar") }},
            <span class="shortcut-key">Ctrl + ↑</span>
            {{ t("shortcuts.hideBar") }}
          </p>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.shortcuts-page {
  flex: 1;
  min-height: 0;
  margin: 0 1rem 0.5rem;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow: auto;
}

.shortcuts-modal {
  width: min(960px, 100%);
  border: 1px solid rgba(200, 155, 60, 0.35);
  border-radius: 12px;
  background: rgba(10, 20, 40, 0.92);
  box-shadow: 0 14px 35px rgba(0, 0, 0, 0.25);
  padding: 1.25rem 1.5rem 1.5rem;
}

.shortcuts-header {
  border-bottom: 1px solid rgba(200, 155, 60, 0.2);
  padding-bottom: 1rem;
  margin-bottom: 1.25rem;
}

.shortcuts-title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  color: #c8aa6e;
}

.shortcuts-hint {
  margin: 0.45rem 0 0;
  font-size: 0.86rem;
  opacity: 0.85;
  color: #f0e6d2;
}

.shortcuts-grid {
  display: grid;
  gap: 2rem;
}

@media (min-width: 768px) {
  .shortcuts-grid {
    grid-template-columns: 1fr 1fr;
    gap: 2.5rem;
  }
}

.shortcuts-section-title {
  margin: 0 0 1rem;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(240, 230, 210, 0.72);
}

.shortcuts-toggle-list,
.shortcuts-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.shortcuts-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  background: rgba(5, 15, 35, 0.55);
  border: 1px solid rgba(200, 155, 60, 0.15);
  font-size: 0.9rem;
  color: rgba(240, 230, 210, 0.92);
}

.shortcuts-label {
  min-width: 0;
  flex: 1;
}

.shortcuts-list li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
  color: rgba(240, 230, 210, 0.92);
}

.shortcuts-help {
  margin: 1.25rem 0 0;
  font-size: 0.84rem;
  color: rgba(240, 230, 210, 0.78);
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.shortcut-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 4.5rem;
  padding: 0.2rem 0.45rem;
  border-radius: 6px;
  border: 1px solid rgba(200, 155, 60, 0.45);
  background: rgba(200, 155, 60, 0.12);
  color: #f0e6d2;
  font-family: Consolas, "Courier New", monospace;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
}
</style>
