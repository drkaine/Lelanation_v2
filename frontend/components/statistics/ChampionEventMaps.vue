<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { statsFetch } from '~/utils/statsFetch'
import { apiUrl } from '~/utils/apiUrl'
import { jungleApiPatch } from '~/utils/statistics/junglePaths'
import {
  COMBAT_KINDS,
  VISION_KINDS,
  eventMapDots,
  type EventMapApi,
  type EventMapLayer,
  type EventPhase,
} from '~/utils/statistics/eventMap'

const props = defineProps<{ championId: number; version: string; role?: string | null }>()
const { t, locale } = useI18n()

const data = ref<EventMapApi | null>(null)
const pending = ref(false)
const failed = ref(false)
const phase = ref<EventPhase>('all')
const hidden = ref<Record<EventMapLayer, Set<string>>>({ combat: new Set(), vision: new Set() })

const patch = computed(() => jungleApiPatch(props.version))

async function load(): Promise<void> {
  if (!props.championId || !patch.value) {
    data.value = null
    return
  }
  pending.value = true
  failed.value = false
  try {
    const role = props.role ? `&role=${encodeURIComponent(props.role)}` : ''
    data.value = await statsFetch<EventMapApi>(
      apiUrl(
        `/api/stats/champions/${props.championId}/event-map?patch=${encodeURIComponent(patch.value)}${role}`
      )
    )
  } catch {
    data.value = null
    failed.value = true
  } finally {
    pending.value = false
  }
}
watch(() => [props.championId, patch.value, props.role], load, { immediate: true })

const layers = computed(() =>
  (['combat', 'vision'] as const).map(layer => {
    const kinds = layer === 'combat' ? COMBAT_KINDS : VISION_KINDS
    const all = eventMapDots(data.value, layer, { phase: phase.value, kinds: null })
    const counts = new Map<string, number>()
    for (const d of all) counts.set(d.kind, (counts.get(d.kind) ?? 0) + 1)
    const off = hidden.value[layer]
    return {
      layer,
      dots: all.filter(d => !off.has(d.kind)),
      legend: kinds.map(k => ({ kind: k, count: counts.get(k) ?? 0, on: !off.has(k) })),
    }
  })
)
const empty = computed(() => !data.value || layers.value.every(l => !l.legend.some(x => x.count)))

function toggle(layer: EventMapLayer, kind: string): void {
  const next = new Set(hidden.value[layer])
  if (next.has(kind)) next.delete(kind)
  else next.add(kind)
  hidden.value = { ...hidden.value, [layer]: next }
}
function num(v: number): string {
  return v.toLocaleString(locale.value)
}
</script>

<template>
  <section class="em" :aria-label="t('statisticsPage.eventMap.title')">
    <header class="em-head">
      <h3 class="em-label">
        {{ t('statisticsPage.eventMap.title') }}
        <small v-if="data?.games"
          >· {{ t('statisticsPage.eventMap.games', { n: num(data.games) }) }}</small
        >
      </h3>
      <div class="em-phases" role="group">
        <button
          v-for="p in ['all', 'early', 'mid', 'late'] as const"
          :key="p"
          type="button"
          :class="['em-chip', { 'is-on': phase === p }]"
          :aria-pressed="phase === p"
          @click="phase = p"
        >
          {{ t(`statisticsPage.eventMap.phase.${p}`) }}
        </button>
      </div>
    </header>

    <p v-if="pending" class="em-note">…</p>
    <p v-else-if="failed || empty" class="em-note">
      {{ t('statisticsPage.eventMap.empty', { patch: patch ?? '—' }) }}
    </p>
    <div v-else class="em-grid">
      <figure v-for="l in layers" :key="l.layer" class="em-map">
        <figcaption class="em-title">
          {{ t(`statisticsPage.eventMap.layer.${l.layer}`) }}
        </figcaption>
        <svg
          viewBox="0 0 100 100"
          role="img"
          :aria-label="t(`statisticsPage.eventMap.layer.${l.layer}`)"
        >
          <image href="/data/community-dragon/map-planner/map11.png" width="100" height="100" />
          <circle
            v-for="(d, i) in l.dots"
            :key="i"
            :cx="d.x"
            :cy="d.y"
            r="0.9"
            :class="['em-dot', `k-${d.kind}`]"
          />
        </svg>
        <ul class="em-legend">
          <li v-for="g in l.legend" :key="g.kind">
            <button
              type="button"
              :class="['em-chip', { 'is-off': !g.on }]"
              :aria-pressed="g.on"
              @click="toggle(l.layer, g.kind)"
            >
              <span :class="['em-sw', `k-${g.kind}`]" aria-hidden="true" />
              {{ t(`statisticsPage.eventMap.kind.${g.kind}`) }}
              <small>{{ num(g.count) }}</small>
            </button>
          </li>
        </ul>
      </figure>
    </div>
    <p v-if="!pending && !empty" class="em-note">{{ t('statisticsPage.eventMap.note') }}</p>
  </section>
</template>

<style scoped>
.em {
  margin: 16px 4px 4px;
  padding: 18px 20px;
  border: 1px solid #463714;
  border-radius: 10px;
  background: #0a1428;
  color: #f0e6d2;
}
.em-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 14px;
}
.em-label {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #a09b8c;
}
.em-label small {
  letter-spacing: 0;
  text-transform: none;
  font-weight: 400;
}
.em-phases {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.em-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid #463714;
  border-radius: 6px;
  font-size: 12px;
  color: #a09b8c;
}
.em-chip.is-on {
  border-color: #c89b3c;
  color: #f0e6d2;
}
.em-chip.is-off {
  opacity: 0.4;
}
.em-chip small {
  font-variant-numeric: tabular-nums;
  color: #a09b8c;
}
.em-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
@media (max-width: 767px) {
  .em-grid {
    grid-template-columns: 1fr;
  }
}
.em-map {
  margin: 0;
}
.em-title {
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 600;
}
.em-map svg {
  display: block;
  width: 100%;
  border: 1px solid #463714;
  border-radius: 8px;
}
.em-dot {
  opacity: 0.7;
  stroke: #0a1428;
  stroke-width: 0.15;
}
.em-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}
.em-sw {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}
.em-note {
  margin: 8px 0 0;
  font-size: 12px;
  color: #a09b8c;
}
/* Combat */
.k-gank {
  fill: #c89b3c;
  background: #c89b3c;
}
.k-roam {
  fill: #b46cf0;
  background: #b46cf0;
}
.k-lane {
  fill: #0ac8b9;
  background: #0ac8b9;
}
.k-jungle {
  fill: #3fb950;
  background: #3fb950;
}
.k-late {
  fill: #8a95a5;
  background: #8a95a5;
}
.k-death {
  fill: #e84057;
  background: #e84057;
}
/* Vision */
.k-trinket {
  fill: #f2d14c;
  background: #f2d14c;
}
.k-control {
  fill: #e84057;
  background: #e84057;
}
.k-farsight {
  fill: #4ca6f2;
  background: #4ca6f2;
}
.k-ward {
  fill: #3fb950;
  background: #3fb950;
}
.k-killed {
  fill: #f0e6d2;
  background: #f0e6d2;
}
</style>
