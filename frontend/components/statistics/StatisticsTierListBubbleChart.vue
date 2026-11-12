<script setup lang="ts">
import { computed, ref } from 'vue'
import { metaBubbleColor } from '~/utils/statistics/metaBubbleColor'
import {
  injectStatisticsPageCtx,
  type TierListOrMetaChartCtx,
} from '~/composables/statistics/statisticsPageCtx'
import {
  BUBBLE_CHART_H,
  BUBBLE_CHART_PAD,
  BUBBLE_CHART_W,
  computeBubbleLabelPlacements,
  useStatisticsTierListBubbleChart,
} from '~/composables/statistics/useStatisticsTierListBubbleChart'
import { useStatisticsTierListBubbleViewport } from '~/composables/statistics/useStatisticsTierListBubbleViewport'

const props = withDefaults(
  defineProps<{
    highlightId?: number | null
  }>(),
  {
    highlightId: null,
  }
)

const emit = defineEmits<{ select: [championId: number] }>()

const p =
  injectStatisticsPageCtx<
    TierListOrMetaChartCtx<
      | 'championName'
      | 't'
      | 'tierListChartBarColor'
      | 'tierListChartChampionImage'
      | 'tierListChartReferenceRows'
      | 'tierListChartVisibleRows'
    >
  >()

const visibleRows = computed(() => {
  const rows = p.tierListChartVisibleRows as
    | Array<{
        championId: number
        winrate: number
        pickrate: number
        banrate: number
        games: number
        tier: string
      }>
    | undefined
  return rows ?? []
})

const referenceRows = computed(() => {
  const rows = p.tierListChartReferenceRows as
    | Array<{
        championId: number
        winrate: number
        pickrate: number
        banrate: number
        games: number
        tier: string
      }>
    | undefined
  return rows ?? []
})

function tierColorOf(tier: string): string {
  return typeof p.tierListChartBarColor === 'function' ? p.tierListChartBarColor(tier) : '#60a5fa'
}
function tierLabel(tier: string): string {
  return tier === 'D' || tier === 'F' ? 'F' : tier
}

const viewportResetKey = computed(
  () =>
    referenceRows.value
      .map(r => `${r.championId}:${r.winrate}:${r.pickrate}:${r.banrate}`)
      .join('|') || 'empty'
)

const { layout, tooltip, tooltipPoint, onBubbleEnter, onBubbleMove, onBubbleLeave, formatPct } =
  useStatisticsTierListBubbleChart({
    rows: visibleRows,
    referenceRows,
    tierColor: metaBubbleColor,
  })

const {
  viewBoxString,
  zoomPercent,
  canReset,
  isPanning,
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  resetViewport,
  zoomIn,
  zoomOut,
} = useStatisticsTierListBubbleViewport({
  chartW: BUBBLE_CHART_W,
  chartH: BUBBLE_CHART_H,
  resetKey: viewportResetKey,
})

const svgRef = ref<SVGSVGElement | null>(null)
const chartCaptureRoot = ref<HTMLElement | null>(null)

function championName(id: number): string {
  if (typeof p.championName === 'function') {
    return p.championName(id) ?? String(id)
  }
  return String(id)
}

function championImage(id: number): string | null {
  if (typeof p.tierListChartChampionImage === 'function') {
    return p.tierListChartChampionImage(id)
  }
  return null
}

const t = (key: string, params?: Record<string, unknown>) => (params ? p.t(key, params) : p.t(key))

const activeChampionId = computed(() => tooltip.value?.championId ?? props.highlightId ?? null)
const dimOthers = computed(() => props.highlightId != null)

const labelPlacements = computed(() =>
  computeBubbleLabelPlacements(layout.value.points, championName)
)
/** Maquette : étiquettes seulement pour les points remarquables, sélectionnés ou survolés. */
const visibleLabels = computed(() =>
  labelPlacements.value.filter(l => !l.hidden || l.championId === activeChampionId.value)
)

function handleWheel(event: WheelEvent) {
  if (!svgRef.value) return
  onWheel(event, svgRef.value)
}

function handlePointerDown(event: PointerEvent) {
  if (!svgRef.value) return
  onPointerDown(event, svgRef.value)
}

function handlePointerMove(event: PointerEvent) {
  if (!svgRef.value) return
  onPointerMove(event, svgRef.value)
}

function handlePointerUp(event: PointerEvent) {
  if (!svgRef.value) return
  onPointerUp(event, svgRef.value)
}

defineExpose({
  get chartCaptureRoot() {
    return chartCaptureRoot.value
  },
})
</script>

<template>
  <div class="tier-list-bubble-wrap w-full">
    <div class="mb-2 flex items-center gap-2 overflow-x-auto px-1" data-bubble-chart-toolbar>
      <slot name="toolbar-leading" />
      <div class="ml-auto flex shrink-0 items-center gap-1.5">
        <span class="text-[11px] tabular-nums text-text/65">{{ zoomPercent }}%</span>
        <button
          type="button"
          class="ui-build-card-action-button ui-build-card-action-button--icon"
          :title="t('statisticsPage.tierListBubbleZoomOut')"
          :aria-label="t('statisticsPage.tierListBubbleZoomOut')"
          @click="zoomOut(svgRef)"
        >
          −
        </button>
        <button
          type="button"
          class="ui-build-card-action-button ui-build-card-action-button--icon"
          :title="t('statisticsPage.tierListBubbleZoomIn')"
          :aria-label="t('statisticsPage.tierListBubbleZoomIn')"
          @click="zoomIn(svgRef)"
        >
          +
        </button>
        <button
          type="button"
          class="ui-build-card-action-button px-2 py-1 text-[11px] font-semibold"
          :disabled="!canReset"
          @click="resetViewport"
        >
          {{ t('statisticsPage.tierListBubbleResetView') }}
        </button>
      </div>
    </div>

    <div ref="chartCaptureRoot">
      <div
        class="tier-list-bubble-viewport overflow-hidden"
        :class="isPanning ? 'cursor-grabbing' : 'cursor-grab'"
      >
        <svg
          ref="svgRef"
          :viewBox="viewBoxString"
          class="tier-list-bubble-svg block h-full w-full touch-none select-none"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          :aria-label="t('statisticsPage.tierListBubbleChartTitle')"
          @wheel="handleWheel"
          @pointerdown="handlePointerDown"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
          @pointercancel="handlePointerUp"
          @pointerleave="handlePointerUp"
        >
          <title>{{ t('statisticsPage.tierListBubbleChartTitle') }}</title>

          <rect
            :x="BUBBLE_CHART_PAD.left"
            :y="BUBBLE_CHART_PAD.top"
            :width="layout.plotW"
            :height="layout.plotH"
            fill="rgb(8 16 31 / 0.55)"
            rx="4"
          />
          <rect
            :x="BUBBLE_CHART_PAD.left"
            :y="BUBBLE_CHART_PAD.top"
            :width="Math.max(0, layout.refX - BUBBLE_CHART_PAD.left)"
            :height="Math.max(0, layout.refY - BUBBLE_CHART_PAD.top)"
            fill="rgb(10 200 185 / 0.06)"
          />

          <text
            :x="BUBBLE_CHART_PAD.left + 10"
            :y="BUBBLE_CHART_PAD.top + 18"
            fill="#0ac8b9"
            font-size="13"
            font-weight="600"
          >
            {{ t('statisticsPage.tierListBubbleQuadrantHiddenOp') }}
          </text>
          <text
            :x="BUBBLE_CHART_W - BUBBLE_CHART_PAD.right - 10"
            :y="BUBBLE_CHART_PAD.top + 18"
            fill="#c8aa6e"
            font-size="13"
            font-weight="600"
            text-anchor="end"
          >
            {{ t('statisticsPage.tierListBubbleQuadrantOverpowered') }}
          </text>
          <text
            :x="BUBBLE_CHART_PAD.left + 10"
            :y="BUBBLE_CHART_PAD.top + layout.plotH - 8"
            fill="#a09b8c"
            font-size="13"
            font-weight="600"
          >
            {{ t('statisticsPage.tierListBubbleQuadrantWeak') }}
          </text>
          <text
            :x="BUBBLE_CHART_W - BUBBLE_CHART_PAD.right - 10"
            :y="BUBBLE_CHART_PAD.top + layout.plotH - 8"
            fill="#e2665a"
            font-size="13"
            font-weight="600"
            text-anchor="end"
          >
            {{ t('statisticsPage.tierListBubbleQuadrantPopularWeak') }}
          </text>

          <g stroke="rgb(var(--rgb-accent) / 0.12)" stroke-width="1">
            <line
              v-for="tick in layout.xTicks"
              :key="'xgrid-' + tick"
              :x1="
                BUBBLE_CHART_PAD.left +
                ((tick - layout.xMin) / (layout.xMax - layout.xMin)) * layout.plotW
              "
              :x2="
                BUBBLE_CHART_PAD.left +
                ((tick - layout.xMin) / (layout.xMax - layout.xMin)) * layout.plotW
              "
              :y1="BUBBLE_CHART_PAD.top"
              :y2="BUBBLE_CHART_PAD.top + layout.plotH"
            />
            <line
              v-for="tick in layout.yTicks"
              :key="'ygrid-' + tick"
              :x1="BUBBLE_CHART_PAD.left"
              :x2="BUBBLE_CHART_PAD.left + layout.plotW"
              :y1="
                BUBBLE_CHART_PAD.top +
                layout.plotH -
                ((tick - layout.yMin) / (layout.yMax - layout.yMin)) * layout.plotH
              "
              :y2="
                BUBBLE_CHART_PAD.top +
                layout.plotH -
                ((tick - layout.yMin) / (layout.yMax - layout.yMin)) * layout.plotH
              "
            />
          </g>

          <line
            :x1="layout.refX"
            :x2="layout.refX"
            :y1="BUBBLE_CHART_PAD.top"
            :y2="BUBBLE_CHART_PAD.top + layout.plotH"
            stroke="rgb(var(--rgb-accent) / 0.35)"
            stroke-width="1.5"
            stroke-dasharray="6 5"
          />
          <line
            :x1="BUBBLE_CHART_PAD.left"
            :x2="BUBBLE_CHART_PAD.left + layout.plotW"
            :y1="layout.refY"
            :y2="layout.refY"
            stroke="rgb(var(--rgb-accent) / 0.35)"
            stroke-width="1.5"
            stroke-dasharray="6 5"
          />

          <g>
            <g
              v-for="point in [...layout.points].sort((a, b) => b.r - a.r)"
              :key="'bubble-' + point.championId"
              data-bubble-point
              class="cursor-pointer"
              @mouseenter="onBubbleEnter(point.championId, $event)"
              @mousemove="onBubbleMove"
              @mouseleave="onBubbleLeave"
              @click="emit('select', point.championId)"
            >
              <circle
                :cx="point.cx"
                :cy="point.cy"
                :r="point.r"
                :fill="point.color"
                :fill-opacity="
                  activeChampionId === point.championId ? 0.95 : dimOthers ? 0.3 : 0.72
                "
                :stroke="
                  props.highlightId === point.championId ? '#ffffff' : 'rgb(255 255 255 / 0.35)'
                "
                :stroke-width="activeChampionId === point.championId ? 2.5 : 1"
              />
            </g>
          </g>

          <g pointer-events="none">
            <text
              v-for="label in visibleLabels"
              :key="'label-' + label.championId"
              :x="label.x"
              :y="label.y"
              :font-size="label.fontSize"
              font-weight="600"
              :text-anchor="label.anchor"
              :fill="
                activeChampionId === label.championId
                  ? 'rgb(var(--rgb-gold-100) / 0.98)'
                  : label.hidden
                    ? 'rgb(var(--rgb-gold-100) / 0.58)'
                    : 'rgb(var(--rgb-gold-100) / 0.9)'
              "
              :stroke="
                activeChampionId === label.championId || !label.hidden
                  ? 'rgb(8 16 31 / 0.72)'
                  : 'rgb(8 16 31 / 0.45)'
              "
              stroke-width="2"
              paint-order="stroke"
              :class="['bubble-label', activeChampionId === label.championId ? 'is-active' : '']"
            >
              {{ championName(label.championId) }}
            </text>
          </g>

          <g fill="rgb(var(--rgb-accent-light) / 0.8)" font-size="11">
            <text
              v-for="tick in layout.xTicks"
              :key="'xtick-' + tick"
              :x="
                BUBBLE_CHART_PAD.left +
                ((tick - layout.xMin) / (layout.xMax - layout.xMin)) * layout.plotW
              "
              :y="BUBBLE_CHART_H - 20"
              text-anchor="middle"
            >
              {{ tick % 1 === 0 ? tick : tick.toFixed(1) }}
            </text>
            <text
              :x="BUBBLE_CHART_PAD.left + layout.plotW / 2"
              :y="BUBBLE_CHART_H - 4"
              text-anchor="middle"
              fill="rgb(var(--rgb-gold-100) / 0.85)"
              font-size="12"
              font-weight="600"
            >
              {{ t('statisticsPage.pickrate') }}
            </text>
          </g>

          <g fill="rgb(var(--rgb-accent-light) / 0.8)" font-size="11">
            <text
              v-for="tick in layout.yTicks"
              :key="'ytick-' + tick"
              :x="BUBBLE_CHART_PAD.left - 10"
              :y="
                BUBBLE_CHART_PAD.top +
                layout.plotH -
                ((tick - layout.yMin) / (layout.yMax - layout.yMin)) * layout.plotH +
                4
              "
              text-anchor="end"
            >
              {{ tick % 1 === 0 ? tick : tick.toFixed(1) }}
            </text>
            <text
              :x="18"
              :y="BUBBLE_CHART_PAD.top + layout.plotH / 2"
              text-anchor="middle"
              fill="rgb(var(--rgb-gold-100) / 0.85)"
              font-size="12"
              font-weight="600"
              :transform="`rotate(-90 18 ${BUBBLE_CHART_PAD.top + layout.plotH / 2})`"
            >
              {{ t('statisticsPage.winrate') }}
            </text>
          </g>
        </svg>
      </div>

      <p v-if="!layout.sizeUsesBanRate" class="mt-2 px-1 text-center text-[11px] text-text/55">
        {{ t('statisticsPage.tierListBubbleSizeFallback') }}
      </p>
    </div>

    <div
      v-if="$slots['toolbar-actions']"
      class="mt-2 flex items-center justify-end gap-1.5 px-1"
      data-bubble-chart-actions
    >
      <slot name="toolbar-actions" />
    </div>

    <Teleport to="body">
      <div
        v-if="tooltip && tooltipPoint"
        class="pointer-events-none fixed z-[300] w-max max-w-[17rem] rounded border border-l-4 border-accent/45 bg-panel p-2 text-left text-xs text-accent-light shadow-xl"
        :style="{
          borderLeftColor: tierColorOf(tooltipPoint.tier),
          left: tooltip.x + 'px',
          top: tooltip.y + 'px',
          transform: 'translate(-50%, calc(-100% - 12px))',
        }"
      >
        <div class="flex items-center gap-2">
          <img
            v-if="championImage(tooltipPoint.championId)"
            :src="championImage(tooltipPoint.championId) || ''"
            :alt="championName(tooltipPoint.championId)"
            class="h-8 w-8 shrink-0 rounded object-cover"
          />
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="truncate font-semibold text-accent-light">
                {{ championName(tooltipPoint.championId) }}
              </span>
              <span
                class="rounded px-1 text-[10px] font-bold leading-4 text-background"
                :style="{ backgroundColor: tierColorOf(tooltipPoint.tier) }"
                >{{ tierLabel(tooltipPoint.tier) }}</span
              >
            </div>
            <div class="text-[11px] text-accent-light/80">
              {{ t('statisticsPage.winrate') }}:
              <span
                :class="
                  tooltipPoint.winPct >= 52
                    ? 'text-[#4ade80]'
                    : tooltipPoint.winPct <= 48
                      ? 'text-[#f87171]'
                      : ''
                "
                >{{ formatPct(tooltipPoint.winPct) }}</span
              >
            </div>
            <div class="text-[11px] text-accent-light/80">
              {{ t('statisticsPage.pickrate') }}: {{ formatPct(tooltipPoint.pickPct) }}
            </div>
            <div class="text-[11px] text-accent-light/80">
              {{ t('statisticsPage.banrate') }}: {{ formatPct(tooltipPoint.banPct) }}
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
@media (max-width: 767px) {
  .bubble-label:not(.is-active) {
    display: none;
  }
}
.tier-list-bubble-wrap {
  width: 100%;
}

.tier-list-bubble-viewport {
  width: 100%;
  aspect-ratio: 1280 / 760;
  max-height: 82dvh;
  min-height: 280px;
}
</style>
