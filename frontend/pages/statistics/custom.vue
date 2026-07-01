<template>
  <div class="statistics-custom min-h-screen p-4 text-text">
    <div class="mx-auto max-w-7xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="ui-build-card-surface inline-flex gap-1 rounded-xl p-1">
          <NuxtLink :to="localePath('/statistics')" class="mode-btn">
            {{ t('statisticsPage.modeClassic') }}
          </NuxtLink>
          <NuxtLink
            :to="localePath('/statistics/custom')"
            class="mode-btn"
            :class="{ 'mode-btn-active': customTab === 'custom' }"
          >
            {{ t('statisticsPage.modeCustom') }}
          </NuxtLink>
          <NuxtLink
            :to="{ path: localePath('/statistics/custom'), query: { tab: 'recap' } }"
            class="mode-btn"
            :class="{ 'mode-btn-active': customTab === 'recap' }"
          >
            {{ t('statisticsPage.recapNav') }}
          </NuxtLink>
        </div>
        <button
          v-if="customTab === 'custom'"
          type="button"
          class="ui-build-card-button inline-flex items-center gap-1.5 px-3 py-2 text-sm"
          :title="t('statisticsPage.customModeBuildTooltip')"
          @click="store.setConstructionMode(!store.constructionMode)"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M14.7 6.3l3 3m-9.9 9.9l3-3m-5.8 1.2l3.5-3.5 2.5 2.5-3.5 3.5H5v-2.2zm9.2-13.7l2.8-2.8 3.2 3.2-2.8 2.8-3.2-3.2z"
            />
          </svg>
          {{
            store.constructionMode
              ? t('statisticsPage.customModeView')
              : t('statisticsPage.customModeBuild')
          }}
        </button>
      </div>

      <div v-if="customTab === 'recap'" class="ui-build-card-surface rounded-xl p-6 text-text/80">
        <p class="mb-3">{{ t('statisticsPage.recapDescription') }}</p>
        <NuxtLink
          :to="localePath('/statistics/recap')"
          class="ui-build-card-button inline-flex px-3 py-2 text-sm"
        >
          {{ t('statisticsPage.recapTitle') }}
        </NuxtLink>
      </div>

      <div v-else-if="!widgets.length" class="ui-build-card-surface rounded-xl p-6 text-text/80">
        {{ t('statisticsPage.customEmpty') }}
      </div>

      <div v-if="customTab === 'custom'" class="grid gap-3 md:grid-cols-2">
        <article
          v-for="(widget, idx) in widgets"
          :key="widget.id"
          class="ui-build-card-surface rounded-xl p-4"
        >
          <div class="mb-2 flex items-center justify-between gap-2">
            <template v-if="store.constructionMode">
              <input
                :value="widget.title"
                class="w-full rounded border border-primary/40 bg-background px-2 py-1 text-sm"
                @change="renameWidget(widget.id, ($event.target as HTMLInputElement).value)"
              />
            </template>
            <h2 v-else class="font-semibold text-text-accent">{{ widget.title }}</h2>
            <div v-if="store.constructionMode" class="flex items-center gap-1">
              <button class="ctrl-btn" :disabled="idx === 0" @click="moveWidget(idx, idx - 1)">
                ↑
              </button>
              <button
                class="ctrl-btn"
                :disabled="idx === widgets.length - 1"
                @click="moveWidget(idx, idx + 1)"
              >
                ↓
              </button>
              <button class="ctrl-btn" @click="removeWidget(widget.id)">✕</button>
            </div>
          </div>
          <p class="text-sm text-text/75">
            {{ t('statisticsPage.customWidgetHint') }}: {{ widget.id }}
          </p>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useStatisticsCustomStore } from '~/stores/StatisticsCustomStore'

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const store = useStatisticsCustomStore()
const customTab = computed(() => (route.query.tab === 'recap' ? 'recap' : 'custom'))

const widgets = computed(() => store.layout.filter(w => store.favoriteWidgetIds.includes(w.id)))

function moveWidget(from: number, to: number) {
  store.moveWidget(from, to)
}
function removeWidget(id: string) {
  store.removeWidget(id)
}
function renameWidget(id: string, title: string) {
  store.renameWidget(id, title)
}

onMounted(() => {
  store.init()
})
</script>

<style scoped>
.mode-btn {
  text-decoration: none;
  color: rgb(var(--rgb-text) / 0.85);
}
</style>
