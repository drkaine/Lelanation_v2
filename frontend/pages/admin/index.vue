<template>
  <div class="admin-dashboard min-h-screen p-4 text-text">
    <div
      :class="
        activeTab === 'logs' || activeTab === 'stats' || activeTab === 'buildEngagement'
          ? 'w-full max-w-none'
          : 'mx-auto max-w-6xl'
      "
    >
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-text-accent">Admin</h1>
          <p class="mt-1 hidden text-sm text-text/70 sm:block">
            {{ t('admin.tabs.contact') }} · {{ t('admin.tabs.videos') }} ·
            {{ t('admin.tabs.data') }} · {{ t('admin.tabs.stats') }} ·
            {{ t('admin.tabs.buildEngagement') }} · {{ t('admin.tabs.logs') }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <NuxtLink
            :to="localePath('/admin/patch-notes')"
            class="rounded-lg border border-primary bg-surface px-4 py-2 text-sm text-text transition-colors hover:bg-primary hover:text-white"
          >
            {{ t('admin.patchNotes.title') }}
          </NuxtLink>
          <button
            type="button"
            class="rounded-lg border border-primary bg-surface px-4 py-2 text-sm text-text transition-colors hover:bg-primary hover:text-white"
            @click="logout"
          >
            {{ t('admin.logout') }}
          </button>
        </div>
      </div>

      <div
        v-if="authError"
        class="mb-4 rounded-lg border border-error bg-surface p-3 text-sm text-error"
      >
        {{ authError }}
      </div>

      <!-- Tabs (responsive: wrap + scroll on small, select on mobile) -->
      <div class="mb-4 border-b border-primary/30 pb-2">
        <select
          v-model="activeTab"
          class="mb-2 w-full rounded border border-primary/50 bg-surface px-3 py-2 text-sm text-text sm:hidden"
          aria-label="Onglet admin"
        >
          <option v-for="tab in adminTabs" :key="tab.id" :value="tab.id">
            {{ tab.label }}
          </option>
        </select>
        <div class="flex flex-wrap gap-2 overflow-x-auto pb-1 sm:flex-nowrap">
          <button
            v-for="tab in adminTabs"
            :key="tab.id"
            type="button"
            :class="[
              'shrink-0 rounded px-3 py-2 text-sm font-medium transition-colors sm:px-4',
              activeTab === tab.id
                ? 'bg-accent text-background'
                : 'bg-surface/50 text-text/80 hover:bg-primary/20 hover:text-text',
            ]"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <!-- Tab: Contact -->
      <AdminContactTab
        v-show="activeTab === 'contact'"
        ref="contactTabRef"
        @auth-error="authError = $event"
      />

      <!-- Tab: Monitoring -->
      <AdminMonitoringTab v-show="activeTab === 'monitoring'" ref="monitoringTabRef" />

      <!-- Tab: Stats collecte -->
      <AdminCollectStatsTab v-show="activeTab === 'stats'" ref="collectStatsTabRef" />

      <!-- Tab: Engagement builds -->
      <AdminBuildEngagementTab
        v-show="activeTab === 'buildEngagement'"
        ref="buildEngagementTabRef"
      />

      <!-- Tab: Data (Crons + stats) -->
      <AdminDataTab
        v-show="activeTab === 'data'"
        ref="dataTabRef"
        @auth-error="authError = $event"
      />

      <!-- Tab: Logs (full width container) -->
      <AdminLogsTab v-show="activeTab === 'logs'" ref="logsTabRef" />

      <!-- Tab: Videos -->
      <AdminVideosTab
        v-show="activeTab === 'videos'"
        ref="videosTabRef"
        @auth-error="authError = $event"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAdminAuth } from '~/composables/useAdminAuth'

definePageMeta({
  layout: false,
})

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { clearAuth, checkLoggedIn } = useAdminAuth()

const VALID_TABS = [
  'contact',
  'monitoring',
  'videos',
  'data',
  'stats',
  'buildEngagement',
  'logs',
] as const
type AdminTab = (typeof VALID_TABS)[number]

function resolveAdminTab(tab: unknown): AdminTab {
  if (typeof tab !== 'string') return 'contact'
  return VALID_TABS.includes(tab as AdminTab) ? (tab as AdminTab) : 'contact'
}

const authError = ref<string | null>(null)
const activeTab = ref<AdminTab>(resolveAdminTab(route.query.tab))

const adminTabs = computed(() => [
  { id: 'contact' as const, label: t('admin.tabs.contact') },
  { id: 'monitoring' as const, label: t('admin.tabs.monitoring') },
  { id: 'videos' as const, label: t('admin.tabs.videos') },
  { id: 'data' as const, label: t('admin.tabs.data') },
  { id: 'stats' as const, label: t('admin.tabs.stats') },
  { id: 'buildEngagement' as const, label: t('admin.tabs.buildEngagement') },
  { id: 'logs' as const, label: t('admin.tabs.logs') },
])

const collectStatsTabRef = ref<{ loadStats: () => Promise<void> } | null>(null)
const buildEngagementTabRef = ref<{ loadRecap: () => Promise<void> } | null>(null)
const monitoringTabRef = ref<{ load: () => Promise<void> } | null>(null)

async function logout() {
  clearAuth()
  await navigateTo(localePath('/admin/login'))
}

const contactTabRef = ref<{
  load: () => Promise<void>
  ensureLoaded: () => Promise<void> | undefined
} | null>(null)
const dataTabRef = ref<{
  loadAll: () => Promise<unknown>
  activate: () => void
  deactivate: () => void
} | null>(null)
const logsTabRef = ref<{ reload: () => Promise<void> } | null>(null)
const videosTabRef = ref<{
  load: () => Promise<void>
  activate: () => Promise<void> | undefined
} | null>(null)

onMounted(async () => {
  if (!checkLoggedIn()) {
    await navigateTo(localePath('/admin/login'))
    return
  }
  // Ensure URL reflects current tab (e.g. after direct load without query)
  if (!route.query.tab || !VALID_TABS.includes(route.query.tab as AdminTab)) {
    navigateTo(
      { path: route.path, query: { ...route.query, tab: activeTab.value } },
      { replace: true }
    )
  }
  await Promise.all([
    contactTabRef.value?.load(),
    videosTabRef.value?.load(),
    dataTabRef.value?.loadAll(),
  ])
  if (activeTab.value === 'logs') logsTabRef.value?.reload()
  if (activeTab.value === 'monitoring') monitoringTabRef.value?.load()
  if (activeTab.value === 'data') dataTabRef.value?.activate()
})

// Sync URL when tab changes (refresh will restore the tab)
watch(activeTab, (tab, prevTab) => {
  if (tab !== prevTab && route.query.tab !== tab) {
    navigateTo({ path: route.path, query: { ...route.query, tab } }, { replace: true })
  }
  dataTabRef.value?.deactivate()
  if (tab === 'contact') contactTabRef.value?.ensureLoaded()
  if (tab === 'stats') collectStatsTabRef.value?.loadStats()
  if (tab === 'monitoring') monitoringTabRef.value?.load()
  if (tab === 'buildEngagement') buildEngagementTabRef.value?.loadRecap()
  if (tab === 'data') dataTabRef.value?.activate()
  if (tab === 'videos') videosTabRef.value?.activate()
  if (tab === 'logs') logsTabRef.value?.reload()
})

// Sync activeTab when URL changes (browser back/forward)
watch(
  () => route.query.tab,
  tab => {
    const resolved = resolveAdminTab(tab)
    if (activeTab.value !== resolved) {
      activeTab.value = resolved
    }
  }
)
</script>
