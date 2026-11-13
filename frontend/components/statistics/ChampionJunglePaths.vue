<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { statsFetch } from '~/utils/statsFetch'
import { apiUrl } from '~/utils/apiUrl'
import {
  jungleApiPatch,
  jungleSideViews,
  type CampType,
  type JunglePathsApi,
} from '~/utils/statistics/junglePaths'

const props = defineProps<{ championId: number; version: string }>()
const { t, locale } = useI18n()

const res = ref<JunglePathsApi | null>(null)
const pending = ref(false)
const failed = ref(false)
const selected = ref<{ side: 'blue' | 'red'; index: number }>({ side: 'blue', index: 0 })

const patch = computed(() => jungleApiPatch(props.version))

async function load(): Promise<void> {
  if (!props.championId || !patch.value) {
    res.value = null
    return
  }
  pending.value = true
  failed.value = false
  try {
    res.value = await statsFetch<JunglePathsApi>(
      apiUrl(
        `/api/stats/champions/${props.championId}/jungle-paths?patch=${encodeURIComponent(patch.value)}&top=6`
      )
    )
  } catch {
    res.value = null
    failed.value = true
  } finally {
    pending.value = false
  }
}
watch(() => [props.championId, patch.value], load, { immediate: true })

const sides = computed(() => jungleSideViews(res.value))
const empty = computed(() => !sides.value.some(s => s.paths.length))
watch(sides, () => {
  selected.value = { side: sides.value[0]?.side ?? 'blue', index: 0 }
})
const current = computed(
  () => sides.value.find(s => s.side === selected.value.side)?.paths[selected.value.index] ?? null
)
function isSelected(side: 'blue' | 'red', index: number): boolean {
  return selected.value.side === side && selected.value.index === index
}
const zoomOpen = ref(false)
function sideLabel(side: 'blue' | 'red'): string {
  return side === 'blue' ? t('statisticsPage.jungle.sideBlue') : t('statisticsPage.jungle.sideRed')
}

function campLabel(type: CampType): string {
  const labels: Record<CampType, string> = {
    blue_buff: t('statisticsPage.jungle.campBlue'),
    red_buff: t('statisticsPage.jungle.campRed'),
    gromp: t('statisticsPage.jungle.campGromp'),
    wolves: t('statisticsPage.jungle.campWolves'),
    raptors: t('statisticsPage.jungle.campRaptors'),
    krugs: t('statisticsPage.jungle.campKrugs'),
    scuttler: t('statisticsPage.jungle.campScuttler'),
    dragon: t('statisticsPage.jungle.campDragon'),
    baron: t('statisticsPage.jungle.campBaron'),
    unknown: t('statisticsPage.jungle.campUnknown'),
  }
  return labels[type]
}
function num(v: number): string {
  return v.toLocaleString(locale.value)
}
</script>

<template>
  <section class="jp" :aria-label="t('statisticsPage.jungle.title')">
    <header class="jp-head">
      <h3 class="jp-label">{{ t('statisticsPage.jungle.title') }}</h3>
    </header>

    <p v-if="pending" class="jp-empty">…</p>
    <p v-else-if="failed || empty" class="jp-empty">
      {{ t('statisticsPage.jungle.empty', { patch: patch ?? '—' }) }}
    </p>
    <div v-else class="jp-body">
      <div v-for="s in sides" :key="s.side" class="jp-side-col">
        <h4 class="jp-side-title">
          <span :class="['jp-dot', `is-${s.side}`]" aria-hidden="true" />
          {{ sideLabel(s.side) }}
          <small>· {{ num(s.games) }} {{ t('statisticsPage.ovGames') }}</small>
        </h4>
        <p class="jp-starts">
          <span class="jp-starts-label">{{ t('statisticsPage.jungle.start') }}</span>
          <span v-for="st in s.starts.slice(0, 4)" :key="st.type" class="jp-start">
            {{ campLabel(st.type) }} <b>{{ st.pct }} %</b>
          </span>
        </p>
        <p class="jp-cols" aria-hidden="true">
          <span>#</span>
          <span>{{ t('statisticsPage.jungle.colPath') }}</span>
          <span>{{ t('statisticsPage.jungle.colStats') }}</span>
        </p>
        <ol class="jp-list">
          <li v-for="(p, i) in s.paths" :key="p.hash">
            <button
              type="button"
              :class="['jp-row', { 'is-on': isSelected(s.side, i) }]"
              :aria-pressed="isSelected(s.side, i)"
              @click="selected = { side: s.side, index: i }"
            >
              <span class="jp-rank">{{ i + 1 }}</span>
              <span class="jp-seq">
                <template v-for="(st, j) in p.steps" :key="j">
                  <span v-if="j" class="jp-arrow" aria-hidden="true">›</span>
                  <span>{{ campLabel(st.type) }}</span>
                </template>
              </span>
              <span class="jp-meta">
                <b
                  :class="p.winrate >= 50 ? 'is-up' : 'is-down'"
                  :title="t('statisticsPage.jungle.winrateTitle')"
                  >{{ p.winrate.toFixed(1) }} %</b
                >
                <small :title="t('statisticsPage.jungle.metaTitle')"
                  >{{ num(p.games) }} · {{ p.pct.toFixed(1) }} %<template v-if="p.clearTime">
                    · {{ p.clearTime }}</template
                  ></small
                >
              </span>
            </button>
          </li>
        </ol>
      </div>
      <figure v-if="current" class="jp-map">
        <svg viewBox="0 0 100 100" role="img" :aria-label="t('statisticsPage.jungle.mapAlt')">
          <image href="/data/community-dragon/map-planner/map11.png" width="100" height="100" />
          <polyline :points="current.polyline" class="jp-line" />
          <g v-for="(st, j) in current.steps" :key="j">
            <circle :cx="st.x" :cy="st.y" r="3.4" :class="['jp-pt', `is-${current.side}`]" />
            <text :x="st.x" :y="st.y + 1.4" class="jp-num">{{ j + 1 }}</text>
          </g>
        </svg>
        <button type="button" class="jp-expand" @click="zoomOpen = true">
          ⤢ {{ t('statisticsPage.mapModal.open') }}
        </button>
        <figcaption>{{ t('statisticsPage.jungle.clearNote') }}</figcaption>
      </figure>
    </div>
    <p v-if="!pending && !empty" class="jp-legend">{{ t('statisticsPage.jungle.legend') }}</p>

    <StatisticsMapZoomModal
      :open="zoomOpen && !!current"
      :title="t('statisticsPage.jungle.title')"
      @close="zoomOpen = false"
    >
      <template #filters>
        <div class="jp-modal-filters">
          <div v-for="s in sides" :key="s.side">
            <h4 class="jp-side-title">
              <span :class="['jp-dot', `is-${s.side}`]" aria-hidden="true" />
              {{ sideLabel(s.side) }}
            </h4>
            <ol class="jp-list">
              <li v-for="(p, i) in s.paths" :key="p.hash">
                <button
                  type="button"
                  :class="['jp-row', { 'is-on': isSelected(s.side, i) }]"
                  :aria-pressed="isSelected(s.side, i)"
                  @click="selected = { side: s.side, index: i }"
                >
                  <span class="jp-rank">{{ i + 1 }}</span>
                  <span class="jp-seq">
                    <template v-for="(st, j) in p.steps" :key="j">
                      <span v-if="j" class="jp-arrow" aria-hidden="true">›</span>
                      <span>{{ campLabel(st.type) }}</span>
                    </template>
                  </span>
                  <span class="jp-meta">
                    <b :class="p.winrate >= 50 ? 'is-up' : 'is-down'"
                      >{{ p.winrate.toFixed(1) }} %</b
                    >
                    <small>{{ num(p.games) }} · {{ p.pct.toFixed(1) }} %</small>
                  </span>
                </button>
              </li>
            </ol>
          </div>
          <p class="jp-legend">{{ t('statisticsPage.jungle.legend') }}</p>
        </div>
      </template>
      <template v-if="current">
        <polyline :points="current.polyline" class="jp-line" />
        <g v-for="(st, j) in current.steps" :key="j">
          <circle :cx="st.x" :cy="st.y" r="2.4" :class="['jp-pt', `is-${current.side}`]" />
          <text :x="st.x" :y="st.y + 1" class="jp-num jp-num-sm">{{ j + 1 }}</text>
        </g>
      </template>
    </StatisticsMapZoomModal>
  </section>
</template>

<style scoped>
.jp {
  margin: 16px 4px 4px;
  padding: 18px 20px;
  border: 1px solid #463714;
  border-radius: 10px;
  background: #0a1428;
  color: #f0e6d2;
}
.jp-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 14px;
}
.jp-label {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #a09b8c;
}
.jp-body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr)) minmax(200px, 260px);
  gap: 20px;
  align-items: start;
}
@media (max-width: 1023px) {
  .jp-body {
    grid-template-columns: 1fr;
  }
  .jp-map {
    max-width: 300px;
  }
}
.jp-side-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
}
.jp-side-title small {
  font-weight: 400;
  color: #a09b8c;
}
.jp-starts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin: 0 0 8px;
  font-size: 12px;
  color: #a09b8c;
}
.jp-starts-label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.jp-start b {
  color: #f0e6d2;
  font-variant-numeric: tabular-nums;
}
.jp-cols {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr) auto;
  gap: 10px;
  margin: 0 0 4px;
  padding: 0 10px;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #a09b8c;
}
.jp-legend {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #a09b8c;
}
.jp-expand {
  display: block;
  margin: 8px 0 4px;
  padding: 4px 10px;
  border: 1px solid #463714;
  border-radius: 6px;
  font-size: 12px;
  color: #f0e6d2;
}
.jp-expand:hover {
  border-color: #c89b3c;
}
.jp-modal-filters {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.jp-num.jp-num-sm {
  font-size: 2.6px;
}
.jp-rank {
  font-size: 12px;
  font-weight: 700;
  color: #c89b3c;
}
.jp-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.jp-row {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  text-align: left;
}
.jp-row:hover,
.jp-row.is-on {
  border-color: #463714;
  background: rgb(240 230 210 / 0.04);
}
.jp-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.is-blue {
  background: #0ac8b9;
  fill: #0ac8b9;
}
.is-red {
  background: #e84057;
  fill: #e84057;
}
.jp-seq {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
  font-size: 13px;
  font-weight: 600;
}
.jp-arrow {
  color: #c89b3c;
}
.jp-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-variant-numeric: tabular-nums;
}
.jp-meta b {
  font-size: 14px;
}
.jp-meta small {
  font-size: 11px;
  color: #a09b8c;
}
b.is-up {
  color: #0ac8b9;
  background: none;
}
b.is-down {
  color: #e84057;
  background: none;
}
.jp-map {
  margin: 0;
}
.jp-map svg {
  display: block;
  width: 100%;
  border: 1px solid #463714;
  border-radius: 8px;
}
.jp-line {
  fill: none;
  stroke: #c89b3c;
  stroke-width: 0.8;
  stroke-dasharray: 2 1.2;
}
.jp-pt {
  stroke: #0a1428;
  stroke-width: 0.6;
}
.jp-num {
  font-size: 4px;
  font-weight: 700;
  text-anchor: middle;
  fill: #0a1428;
}
.jp-map figcaption,
.jp-empty {
  margin: 6px 0 0;
  font-size: 12px;
  color: #a09b8c;
}
</style>
