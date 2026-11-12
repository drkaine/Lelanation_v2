<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { statsFetch } from '~/utils/statsFetch'
import { apiUrl } from '~/utils/apiUrl'
import {
  jungleApiPatch,
  junglePathViews,
  type CampType,
  type JunglePathApiRow,
} from '~/utils/statistics/junglePaths'

const props = defineProps<{ championId: number; version: string }>()
const { t, locale } = useI18n()

const rows = ref<JunglePathApiRow[]>([])
const pending = ref(false)
const failed = ref(false)
const side = ref<'blue' | 'red' | null>(null)
const selected = ref(0)

const patch = computed(() => jungleApiPatch(props.version))

async function load(): Promise<void> {
  if (!props.championId || !patch.value) {
    rows.value = []
    return
  }
  pending.value = true
  failed.value = false
  try {
    const res = await statsFetch<{ paths: JunglePathApiRow[] }>(
      apiUrl(
        `/api/stats/champions/${props.championId}/jungle-paths?patch=${encodeURIComponent(patch.value)}&limit=60`
      )
    )
    rows.value = res?.paths ?? []
  } catch {
    rows.value = []
    failed.value = true
  } finally {
    pending.value = false
  }
}
watch(() => [props.championId, patch.value], load, { immediate: true })

const paths = computed(() => junglePathViews(rows.value, { limit: 6, side: side.value }))
watch(paths, () => {
  selected.value = 0
})
const current = computed(() => paths.value[selected.value] ?? null)

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
      <div class="jp-sides" role="group">
        <button
          v-for="s in [null, 'blue', 'red'] as const"
          :key="String(s)"
          type="button"
          :class="['jp-side', { 'is-on': side === s }]"
          :aria-pressed="side === s"
          @click="side = s"
        >
          {{
            s === null
              ? t('statisticsPage.jungle.sideAll')
              : s === 'blue'
                ? t('statisticsPage.jungle.sideBlue')
                : t('statisticsPage.jungle.sideRed')
          }}
        </button>
      </div>
    </header>

    <p v-if="pending" class="jp-empty">…</p>
    <p v-else-if="failed || !paths.length" class="jp-empty">
      {{ t('statisticsPage.jungle.empty', { patch: patch ?? '—' }) }}
    </p>
    <div v-else class="jp-body">
      <ol class="jp-list">
        <li v-for="(p, i) in paths" :key="p.hash">
          <button
            type="button"
            :class="['jp-row', { 'is-on': i === selected }]"
            :aria-pressed="i === selected"
            @click="selected = i"
          >
            <span :class="['jp-dot', `is-${p.side}`]" aria-hidden="true" />
            <span class="jp-seq">
              <template v-for="(s, j) in p.steps" :key="j">
                <span v-if="j" class="jp-arrow" aria-hidden="true">›</span>
                <span>{{ campLabel(s.type) }}</span>
              </template>
            </span>
            <span class="jp-meta">
              <b :class="p.winrate >= 50 ? 'is-up' : 'is-down'">{{ p.winrate.toFixed(1) }} %</b>
              <small
                >{{ num(p.games) }} {{ t('statisticsPage.ovGames')
                }}<template v-if="p.clearTime"> · {{ p.clearTime }}</template></small
              >
            </span>
          </button>
        </li>
      </ol>
      <figure v-if="current" class="jp-map">
        <svg viewBox="0 0 100 100" role="img" :aria-label="t('statisticsPage.jungle.mapAlt')">
          <image href="/data/community-dragon/map-planner/map11.png" width="100" height="100" />
          <polyline :points="current.polyline" class="jp-line" />
          <g v-for="(s, j) in current.steps" :key="j">
            <circle :cx="s.x" :cy="s.y" r="3.4" :class="['jp-pt', `is-${current.side}`]" />
            <text :x="s.x" :y="s.y + 1.4" class="jp-num">{{ j + 1 }}</text>
          </g>
        </svg>
        <figcaption>{{ t('statisticsPage.jungle.clearNote') }}</figcaption>
      </figure>
    </div>
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
.jp-sides {
  display: flex;
  gap: 4px;
}
.jp-side {
  padding: 4px 10px;
  border: 1px solid #463714;
  border-radius: 6px;
  font-size: 12px;
  color: #a09b8c;
}
.jp-side.is-on {
  border-color: #c89b3c;
  color: #f0e6d2;
}
.jp-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 300px);
  gap: 20px;
  align-items: start;
}
@media (max-width: 767px) {
  .jp-body {
    grid-template-columns: 1fr;
  }
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
  grid-template-columns: 10px minmax(0, 1fr) auto;
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
  font-size: 14px;
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
