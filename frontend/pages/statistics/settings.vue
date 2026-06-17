<template>
  <div class="statistics-settings min-h-screen p-4 text-text">
    <div class="mx-auto max-w-5xl space-y-4">
      <header class="space-y-2">
        <NuxtLink
          :to="statisticsIndexLink"
          class="inline-flex items-center gap-1 text-sm text-text/65 hover:text-accent"
        >
          ← {{ t('statisticsPage.settingsBack') }}
        </NuxtLink>
        <h1 class="text-xl font-semibold text-text-accent">
          {{ t('statisticsPage.settingsTitle') }}
        </h1>
        <p class="text-sm text-text/70">
          {{ t('statisticsPage.settingsDescription') }}
        </p>
        <p class="text-xs text-text/55">
          {{ t('statisticsPage.settingsDefaultTabHint') }}
        </p>
      </header>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-xs text-text/55">
          {{
            t('statisticsPage.settingsVisibleCount', { count: visibleCount, total: tabRows.length })
          }}
        </span>
        <button
          type="button"
          class="rounded border border-primary/35 bg-surface/50 px-3 py-1.5 text-xs hover:bg-primary/10"
          @click="resetTabs"
        >
          {{ t('statisticsPage.settingsReset') }}
        </button>
      </div>

      <ul class="flex flex-wrap gap-2">
        <li
          v-for="row in tabRows"
          :key="row.id"
          class="flex w-[9.5rem] flex-col gap-2 rounded-lg border border-primary/25 bg-surface/30 px-2.5 py-2"
          :class="row.visible ? 'opacity-100' : 'opacity-55'"
        >
          <div class="min-h-[2.25rem] text-xs font-medium leading-snug text-text/90">
            {{ row.label }}
          </div>
          <div class="flex items-center justify-between gap-1">
            <label
              class="inline-flex cursor-pointer items-center gap-1.5 text-[10px] text-text/60"
              :class="{ 'cursor-not-allowed opacity-40': !row.visible }"
            >
              <input
                type="radio"
                name="statistics-default-tab"
                class="h-3.5 w-3.5 shrink-0 accent-accent"
                :checked="row.isDefault"
                :disabled="!row.visible"
                :aria-label="t('statisticsPage.settingsDefaultTabAria', { tab: row.label })"
                @change="setDefaultTab(row.id)"
              />
              <span>{{ t('statisticsPage.settingsDefaultTab') }}</span>
            </label>
            <button
              type="button"
              class="command-toggle command-toggle-button shrink-0 scale-90"
              :aria-pressed="row.visible"
              :aria-label="row.label"
              @click="toggleTab(row.id)"
            >
              <span class="command-toggle-track" :class="{ active: row.visible }">
                <span class="command-toggle-thumb" />
              </span>
            </button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  STATISTICS_MAIN_TAB_LABEL_KEYS,
  STATISTICS_MAIN_TAB_ORDER,
} from '~/constants/statisticsMainTabs'
import { useStatisticsUiStore, type StatisticsMainTab } from '~/stores/StatisticsUiStore'

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const statisticsUiStore = useStatisticsUiStore()
if (import.meta.client) {
  statisticsUiStore.init()
}

const tabRows = computed(() =>
  STATISTICS_MAIN_TAB_ORDER.map(id => ({
    id,
    label: t(STATISTICS_MAIN_TAB_LABEL_KEYS[id]),
    visible: statisticsUiStore.isTabVisible(id),
    isDefault: statisticsUiStore.defaultTab === id,
  }))
)

const visibleCount = computed(() => tabRows.value.filter(row => row.visible).length)

function pickStatisticsSharedQuery(keys: readonly string[]): Record<string, string | string[]> {
  const q = route.query as Record<string, string | string[] | undefined>
  const out: Record<string, string | string[]> = {}
  for (const key of keys) {
    const v = q[key]
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    out[key] = v
  }
  return out
}

const statisticsIndexLink = computed(() =>
  localePath({
    path: '/statistics',
    query: pickStatisticsSharedQuery(['version', 'role', 'otp', 'rankTier', 'tab']),
  })
)

function toggleTab(tab: StatisticsMainTab): void {
  statisticsUiStore.setTabVisible(tab, !statisticsUiStore.isTabVisible(tab))
}

function setDefaultTab(tab: StatisticsMainTab): void {
  statisticsUiStore.setDefaultTab(tab)
}

function resetTabs(): void {
  statisticsUiStore.resetTabVisibility()
}

useHead({
  title: () => t('statisticsPage.settingsTitle'),
})
</script>
