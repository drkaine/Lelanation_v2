<template>
  <div class="statistics-custom min-h-screen p-4 text-text">
    <div class="mx-auto max-w-7xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="inline-flex rounded-lg border border-primary/30 bg-surface/40 p-1">
          <NuxtLink :to="localePath('/statistics')" class="mode-btn">
            {{ t('statisticsPage.modeClassic') }}
          </NuxtLink>
          <NuxtLink :to="localePath('/statistics/custom')" class="mode-btn mode-btn-active">
            {{ t('statisticsPage.modeCustom') }}
          </NuxtLink>
        </div>
        <button
          type="button"
          class="rounded border border-primary/40 bg-surface px-3 py-2 text-sm hover:bg-primary/15"
          @click="store.setConstructionMode(!store.constructionMode)"
        >
          {{
            store.constructionMode
              ? t('statisticsPage.customModeView')
              : t('statisticsPage.customModeBuild')
          }}
        </button>
      </div>

      <div
        v-if="!widgets.length"
        class="rounded-lg border border-primary/30 bg-surface/30 p-6 text-text/80"
      >
        {{ t('statisticsPage.customEmpty') }}
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <article
          v-for="(widget, idx) in widgets"
          :key="widget.id"
          class="rounded-lg border border-primary/30 bg-surface/30 p-4"
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
import { useStatisticsCustomStore } from '~/stores/StatisticsCustomStore'

const { t } = useI18n()
const localePath = useLocalePath()
const store = useStatisticsCustomStore()

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
  border-radius: 0.375rem;
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
  text-decoration: none;
  color: rgb(var(--rgb-text) / 0.8);
}
.mode-btn-active {
  background: rgb(var(--rgb-accent) / 0.2);
  color: var(--color-accent);
}
.ctrl-btn {
  border-radius: 0.35rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.45);
  background: rgb(var(--rgb-surface));
  padding: 0.2rem 0.5rem;
  font-size: 0.75rem;
}
</style>
