<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { statsRoleIconPath, statsRoleLabel } from '~/utils/statsRoleDisplay'
import {
  DASHBOARD_RADAR_AXES,
  barWidthPct,
  breakdownSharePct,
  formatDashboardValue,
  radarPoint,
  radarPolygonPoints,
  type DashboardRadarAxis,
} from '~/utils/championDashboard'
import {
  scoreboardObjectiveIconByKey,
  scoreboardObjectiveIconCdByKey,
} from '~/utils/objectiveScoreboardIcons'
import { useToggleSet } from '~/composables/useToggleSet'

type MetricKey =
  | 'firstBlood'
  | 'deaths'
  | 'kills'
  | 'assists'
  | 'damage'
  | 'kda'
  | 'turrets'
  | 'wardsPlaced'
  | 'visionScore'
  | 'wardsKilled'
  | 'dragons'
  | 'barons'
  | 'heal'
  | 'tanked'
  | 'mitigated'
  | 'csPerMin'
  | 'gold'
  | 'totalCs'

export type ChampionDashboardRole = {
  role: string
  games: number
  winrate: number
  kills: number
  deaths: number
  assists: number
  kda: number
  gold: number
  csPerMin: number
  damage: number
}

type BreakdownMetricKey = 'kills' | 'deaths' | 'assists' | 'damage' | 'tanked'

export type ChampionDashboardSummary = {
  championId: number
  games: number
  winrate: number
  metrics: Record<MetricKey, number>
  percentiles: Record<MetricKey, number>
  radar: Record<(typeof DASHBOARD_RADAR_AXES)[number], number>
  /** Sous-lignes des dropdowns : gank / dive, dégâts par type. */
  breakdowns?: Partial<Record<BreakdownMetricKey, Array<{ key: string; value: number }>>>
  roles: ChampionDashboardRole[]
}

export type DashboardTile = {
  id: number
  name: string
  imageUrl: string
  games: number
}

const props = defineProps<{
  data: ChampionDashboardSummary | null
  pending?: boolean
  items: DashboardTile[]
  spells: DashboardTile[]
}>()

const { t } = useI18n()

const hasData = computed(() => Number(props.data?.games ?? 0) > 0)

type Group = {
  key: 'combat' | 'visionObj' | 'survival' | 'economy'
  icon: string
  color: string
  rows: Array<{ key: MetricKey; digits: number; suffix?: string }>
}

const GROUPS: Group[] = [
  {
    key: 'combat',
    icon: '⚔️',
    color: '#e84057',
    rows: [
      { key: 'firstBlood', digits: 2 },
      { key: 'deaths', digits: 1 },
      { key: 'kills', digits: 1 },
      { key: 'damage', digits: 0 },
      { key: 'kda', digits: 2 },
      { key: 'assists', digits: 1 },
    ],
  },
  {
    key: 'visionObj',
    icon: '👁️',
    color: '#4a90d9',
    rows: [
      { key: 'turrets', digits: 2 },
      { key: 'wardsPlaced', digits: 1 },
      { key: 'visionScore', digits: 1 },
      { key: 'wardsKilled', digits: 1 },
      { key: 'dragons', digits: 2 },
      { key: 'barons', digits: 2 },
    ],
  },
  {
    key: 'survival',
    icon: '🛡️',
    color: '#0ac8b9',
    rows: [
      { key: 'heal', digits: 0 },
      { key: 'tanked', digits: 0 },
      { key: 'mitigated', digits: 0 },
    ],
  },
  {
    key: 'economy',
    icon: '💰',
    color: '#c8aa6e',
    rows: [
      { key: 'csPerMin', digits: 1 },
      { key: 'gold', digits: 0 },
      { key: 'totalCs', digits: 0 },
    ],
  },
]

type MetricIcon = { src: string; cdFallback?: string; size?: number }

const STATS_ICON_BASE = '/icons/statsicon'
const PINGS_ICON_BASE = '/data/community-dragon/minimap-pings'
const MAP_PLANNER_ICON_BASE = '/data/community-dragon/map-planner'

function objectiveIcon(key: string): MetricIcon | undefined {
  const src = scoreboardObjectiveIconByKey[key]
  return src ? { src, cdFallback: scoreboardObjectiveIconCdByKey[key] } : undefined
}

/** Icônes déjà utilisées ailleurs dans le site (stats de build, objectifs, pings). */
const METRIC_ICONS: Partial<Record<MetricKey, MetricIcon | undefined>> = {
  deaths: { src: `${MAP_PLANNER_ICON_BASE}/dead_blue.png` },
  assists: { src: `${PINGS_ICON_BASE}/assist.png`, size: 14 },
  damage: { src: `${STATS_ICON_BASE}/AD.png`, size: 14 },
  turrets: objectiveIcon('tower'),
  dragons: objectiveIcon('dragon'),
  barons: objectiveIcon('baron'),
  wardsPlaced: { src: `${PINGS_ICON_BASE}/need_ward.png` },
  visionScore: { src: `${PINGS_ICON_BASE}/area_is_warded_small_red_new.png` },
  wardsKilled: { src: `${PINGS_ICON_BASE}/cleared.png` },
  heal: { src: `${STATS_ICON_BASE}/Heal_power.png`, size: 14 },
  tanked: { src: `${STATS_ICON_BASE}/Armor.png`, size: 14 },
  mitigated: { src: `${STATS_ICON_BASE}/shield.png`, size: 14 },
  gold: { src: `${STATS_ICON_BASE}/Gold.svg` },
}

/** Pas d'icône existante pour ces métriques : on garde l'emoji. */
const METRIC_EMOJI_FALLBACK: Partial<Record<MetricKey, string>> = {
  firstBlood: '🩸',
  kills: '🗡️',
  kda: '⭐',
  csPerMin: '⚔️',
  totalCs: '🌾',
}

function onIconImgError(e: Event, icon?: MetricIcon): void {
  const el = e.target as Element & { dataset: DOMStringMap }
  const fallback = icon?.cdFallback
  if (!fallback || el.dataset.cdFallback === '1') return
  el.dataset.cdFallback = '1'
  if (el instanceof SVGImageElement) el.setAttribute('href', fallback)
  else (el as HTMLImageElement).src = fallback
}

/** Icône affichée à côté du libellé de chaque axe du radar « Playstyle ». */
const RADAR_AXIS_ICONS: Partial<Record<DashboardRadarAxis, MetricIcon>> = {}
if (METRIC_ICONS.tanked) RADAR_AXIS_ICONS.tank = METRIC_ICONS.tanked
if (METRIC_ICONS.dragons) RADAR_AXIS_ICONS.objects = METRIC_ICONS.dragons
if (METRIC_ICONS.damage) RADAR_AXIS_ICONS.damage = METRIC_ICONS.damage
if (METRIC_ICONS.wardsPlaced) RADAR_AXIS_ICONS.vision = METRIC_ICONS.wardsPlaced
if (METRIC_ICONS.gold) RADAR_AXIS_ICONS.economy = METRIC_ICONS.gold
if (METRIC_ICONS.heal) RADAR_AXIS_ICONS.sustain = METRIC_ICONS.heal
if (METRIC_ICONS.assists) RADAR_AXIS_ICONS.team = METRIC_ICONS.assists
const RADAR_ICON_SIZE = 13

/** Pour les morts, une barre pleine = beaucoup de morts ; on garde le percentile brut, sans inversion. */
function metricValue(key: MetricKey): number {
  return Number(props.data?.metrics?.[key] ?? 0)
}
function metricPercentile(key: MetricKey): number {
  return Number(props.data?.percentiles?.[key] ?? 0)
}

/** Famille de libellés des sous-lignes : kills / assists = participations (kill ou assist) en gank / dive. */
const BREAKDOWN_LABEL_GROUP: Record<BreakdownMetricKey, string> = {
  kills: 'participation',
  assists: 'participation',
  deaths: 'death',
  damage: 'damageType',
  tanked: 'damageType',
}
const BREAKDOWN_DIGITS: Record<BreakdownMetricKey, number> = {
  kills: 2,
  assists: 2,
  deaths: 2,
  damage: 0,
  tanked: 0,
}

const { set: openBreakdowns, toggle: toggleBreakdown } = useToggleSet<MetricKey>()

function breakdownRows(key: MetricKey): Array<{ key: string; value: number }> {
  return props.data?.breakdowns?.[key as BreakdownMetricKey] ?? []
}
function hasBreakdown(key: MetricKey): boolean {
  return breakdownRows(key).length > 0
}
function breakdownLabel(metric: MetricKey, key: string): string {
  const group = BREAKDOWN_LABEL_GROUP[metric as BreakdownMetricKey]
  return t(`statisticsPage.championDashboardBreakdown_${group}_${key}`)
}

// Radar
const SIZE = 300
const CENTER = SIZE / 2
const RADIUS = 92
const RINGS = [25, 50, 75, 100]

const radarValues = computed(() =>
  DASHBOARD_RADAR_AXES.map(axis => Number(props.data?.radar?.[axis] ?? 0))
)
const radarPolygon = computed(() => radarPolygonPoints(radarValues.value, RADIUS, CENTER, CENTER))
const radarDots = computed(() =>
  radarValues.value.map((v, i) =>
    radarPoint(i, radarValues.value.length, v, RADIUS, CENTER, CENTER)
  )
)
const radarAxes = computed(() =>
  DASHBOARD_RADAR_AXES.map((axis, i) => {
    const end = radarPoint(i, DASHBOARD_RADAR_AXES.length, 100, RADIUS, CENTER, CENTER)
    const icon = radarPoint(i, DASHBOARD_RADAR_AXES.length, 100, RADIUS + 7, CENTER, CENTER)
    const label = radarPoint(i, DASHBOARD_RADAR_AXES.length, 100, RADIUS + 21, CENTER, CENTER)
    const dx = label.x - CENTER
    const anchor = Math.abs(dx) < 4 ? 'middle' : dx > 0 ? 'start' : 'end'
    return { axis, end, icon, label, anchor, value: radarValues.value[i] ?? 0 }
  })
)
const radarIconAxes = computed(() => radarAxes.value.filter(a => RADAR_AXIS_ICONS[a.axis]))
function ringPoints(pct: number): string {
  return radarPolygonPoints(
    DASHBOARD_RADAR_AXES.map(() => pct),
    RADIUS,
    CENTER,
    CENTER
  )
}

const roleRows = computed(() => props.data?.roles ?? [])
const maxRoleGames = computed(() => Math.max(1, ...roleRows.value.map(r => r.games)))
const maxRoleGold = computed(() => Math.max(1, ...roleRows.value.map(r => r.gold)))
const maxRoleDamage = computed(() => Math.max(1, ...roleRows.value.map(r => r.damage)))
const maxRoleKda = computed(() => Math.max(1, ...roleRows.value.map(r => r.kda)))
const maxRoleCs = computed(() => Math.max(1, ...roleRows.value.map(r => r.csPerMin)))

function relPct(value: number, max: number): number {
  return barWidthPct((value / max) * 100)
}
function winrateClass(wr: number): string {
  if (wr >= 52) return 'bg-info'
  if (wr < 48) return 'bg-error'
  return 'bg-accent'
}

function maxTileGames(tiles: DashboardTile[]): number {
  return Math.max(1, ...tiles.map(x => x.games))
}
</script>

<template>
  <div class="champion-dashboard-tab w-full min-w-0 max-w-full space-y-4">
    <div v-if="pending" class="text-sm text-text/70">
      {{ t('statisticsPage.loading') }}
    </div>
    <div v-else-if="!hasData" class="statistics-empty-panel p-4">
      {{ t('statisticsPage.championDashboardEmpty') }}
    </div>
    <template v-else>
      <div
        class="grid w-full items-stretch gap-3 lg:grid-cols-[minmax(260px,330px)_minmax(0,2fr)_minmax(0,0.65fr)_minmax(0,0.65fr)]"
      >
        <!-- Radar -->
        <section class="flex flex-col rounded-xl border border-primary/25 bg-surface/20 p-3">
          <h3 class="mb-1 text-center text-sm font-semibold tracking-wider text-text-accent">
            {{ t('statisticsPage.championDashboardPlaystyle') }}
          </h3>
          <svg
            :viewBox="`0 0 ${SIZE} ${SIZE}`"
            class="mx-auto my-auto block w-full max-w-[340px]"
            role="img"
            :aria-label="t('statisticsPage.championDashboardPlaystyle')"
          >
            <polygon
              v-for="ring in RINGS"
              :key="ring"
              :points="ringPoints(ring)"
              fill="none"
              stroke="currentColor"
              class="text-text/15"
              stroke-width="1"
            />
            <line
              v-for="a in radarAxes"
              :key="`axis-${a.axis}`"
              :x1="CENTER"
              :y1="CENTER"
              :x2="a.end.x"
              :y2="a.end.y"
              stroke="currentColor"
              class="text-text/15"
              stroke-width="1"
            />
            <polygon
              :points="radarPolygon"
              fill="#c8aa6e"
              fill-opacity="0.25"
              stroke="#c8aa6e"
              stroke-width="2"
            />
            <circle
              v-for="(d, i) in radarDots"
              :key="`dot-${i}`"
              :cx="d.x"
              :cy="d.y"
              r="3"
              fill="#c8aa6e"
            >
              <title>
                {{ t(`statisticsPage.championDashboardAxis_${DASHBOARD_RADAR_AXES[i]}`) }} :
                {{ formatDashboardValue(radarValues[i] ?? 0, 0) }}
              </title>
            </circle>
            <image
              v-for="a in radarIconAxes"
              :key="`icon-${a.axis}`"
              :href="RADAR_AXIS_ICONS[a.axis]!.src"
              :x="a.icon.x - RADAR_ICON_SIZE / 2"
              :y="a.icon.y - RADAR_ICON_SIZE / 2"
              :width="RADAR_ICON_SIZE"
              :height="RADAR_ICON_SIZE"
              @error="onIconImgError($event, RADAR_AXIS_ICONS[a.axis])"
            />
            <text
              v-for="a in radarAxes"
              :key="`label-${a.axis}`"
              :x="a.label.x"
              :y="a.label.y"
              :text-anchor="a.anchor"
              dominant-baseline="middle"
              font-size="11"
              fill="currentColor"
              class="text-text-accent"
            >
              {{ t(`statisticsPage.championDashboardAxis_${a.axis}`) }}
            </text>
          </svg>
          <p class="mt-1 text-center text-[11px] italic text-text/55">
            {{ t('statisticsPage.championDashboardPercentileHint') }}
          </p>
        </section>

        <!-- Groupes de stats -->
        <div class="grid min-w-0 grid-cols-1 content-start gap-3 sm:grid-cols-2">
          <section
            v-for="group in GROUPS"
            :key="group.key"
            class="min-w-0 rounded-lg border bg-black/20 px-3 py-2"
            :style="{ borderColor: `${group.color}55` }"
          >
            <h3
              class="mb-2 text-center text-xs font-semibold tracking-wider"
              :style="{ color: group.color }"
            >
              {{ group.icon }} {{ t(`statisticsPage.championDashboardGroup_${group.key}`) }}
            </h3>
            <ul class="space-y-1.5">
              <template v-for="row in group.rows" :key="row.key">
                <li
                  class="flex items-center gap-2 text-xs"
                  :title="`${t('statisticsPage.championDashboardPercentileLabel')} ${formatDashboardValue(metricPercentile(row.key), 0)}`"
                >
                  <component
                    :is="hasBreakdown(row.key) ? 'button' : 'span'"
                    :type="hasBreakdown(row.key) ? 'button' : undefined"
                    :aria-expanded="hasBreakdown(row.key) ? openBreakdowns.has(row.key) : undefined"
                    class="flex w-[42%] shrink-0 items-center gap-1.5 truncate text-left font-semibold text-text/90"
                    :class="hasBreakdown(row.key) ? 'hover:text-text' : ''"
                    @click="hasBreakdown(row.key) && toggleBreakdown(row.key)"
                  >
                    <span
                      class="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden"
                      aria-hidden="true"
                    >
                      <img
                        v-if="METRIC_ICONS[row.key]"
                        :src="METRIC_ICONS[row.key]!.src"
                        alt=""
                        :width="METRIC_ICONS[row.key]!.size ?? 20"
                        :height="METRIC_ICONS[row.key]!.size ?? 20"
                        loading="lazy"
                        class="max-h-full max-w-full object-contain"
                        @error="onIconImgError($event, METRIC_ICONS[row.key])"
                      />
                      <span v-else class="text-[15px] leading-none">
                        {{ METRIC_EMOJI_FALLBACK[row.key] }}
                      </span>
                    </span>
                    <span class="truncate">
                      {{ t(`statisticsPage.championDashboardMetric_${row.key}`) }}
                    </span>
                    <span
                      v-if="hasBreakdown(row.key)"
                      class="inline-block shrink-0 text-[9px] text-text/60 transition-transform duration-200"
                      :class="openBreakdowns.has(row.key) ? 'rotate-180' : ''"
                      aria-hidden="true"
                      >▼</span
                    >
                  </component>
                  <span class="relative h-3.5 flex-1 overflow-hidden rounded-full bg-black/40">
                    <span
                      class="block h-full rounded-full"
                      :style="{
                        width: `${barWidthPct(metricPercentile(row.key))}%`,
                        backgroundColor: group.color,
                      }"
                    />
                    <span
                      class="absolute inset-0 flex items-center justify-end pr-2 text-[11px] font-bold tabular-nums text-white [text-shadow:0_0_3px_rgba(0,0,0,0.7)]"
                    >
                      {{ formatDashboardValue(metricValue(row.key), row.digits) }}
                    </span>
                  </span>
                </li>
                <template v-if="hasBreakdown(row.key) && openBreakdowns.has(row.key)">
                  <li
                    v-for="sub in breakdownRows(row.key)"
                    :key="`${row.key}-${sub.key}`"
                    class="flex items-center gap-2 text-[11px]"
                  >
                    <span class="w-[42%] shrink-0 truncate pl-7 text-text/70">
                      {{ breakdownLabel(row.key, sub.key) }}
                    </span>
                    <span class="relative h-3 flex-1 overflow-hidden rounded-full bg-black/30">
                      <span
                        class="block h-full rounded-full opacity-60"
                        :style="{
                          width: `${breakdownSharePct(sub.value, metricValue(row.key))}%`,
                          backgroundColor: group.color,
                        }"
                      />
                      <span
                        class="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-semibold tabular-nums text-white [text-shadow:0_0_3px_rgba(0,0,0,0.7)]"
                      >
                        {{
                          formatDashboardValue(
                            sub.value,
                            BREAKDOWN_DIGITS[row.key as BreakdownMetricKey]
                          )
                        }}
                      </span>
                    </span>
                  </li>
                </template>
              </template>
            </ul>
          </section>
        </div>

        <!-- Top objets / sorts -->
        <section
          v-if="items.length"
          class="min-w-0 rounded-lg border border-primary/25 bg-black/20 p-2"
        >
          <h3 class="mb-2 text-center text-xs font-semibold tracking-wider text-text-accent">
            🛡️ {{ t('statisticsPage.championDashboardTopItems') }}
          </h3>
          <ul class="grid grid-cols-2 gap-1.5">
            <li
              v-for="tile in items"
              :key="tile.id"
              class="flex flex-col items-center gap-1 rounded-lg bg-black/25 p-1.5"
              :title="tile.name"
            >
              <img
                :src="tile.imageUrl"
                :alt="tile.name"
                width="32"
                height="32"
                loading="lazy"
                class="h-8 w-8 shrink-0 rounded border border-primary/60"
              />
              <span class="flex w-full min-w-0 flex-col items-center gap-0.5">
                <span class="w-full truncate text-center text-[11px] font-semibold text-text/90">
                  {{ tile.name }}
                </span>
                <span class="relative h-3.5 w-full overflow-hidden rounded-md bg-black/40">
                  <span
                    class="block h-full rounded-md bg-info"
                    :style="{ width: `${relPct(tile.games, maxTileGames(items))}%` }"
                  />
                  <span
                    class="absolute inset-0 flex items-center justify-end pr-1.5 text-[10px] font-bold tabular-nums text-white [text-shadow:0_0_3px_rgba(0,0,0,0.7)]"
                  >
                    {{ formatDashboardValue(tile.games) }}
                  </span>
                </span>
              </span>
            </li>
          </ul>
        </section>
        <section
          v-if="spells.length"
          class="min-w-0 rounded-lg border border-primary/25 bg-black/20 p-2"
        >
          <h3 class="mb-2 text-center text-xs font-semibold tracking-wider text-text-accent">
            ✨ {{ t('statisticsPage.championDashboardTopSpells') }}
          </h3>
          <ul class="grid grid-cols-2 gap-1.5">
            <li
              v-for="tile in spells"
              :key="tile.id"
              class="flex flex-col items-center gap-1 rounded-lg bg-black/25 p-1.5"
              :title="tile.name"
            >
              <img
                :src="tile.imageUrl"
                :alt="tile.name"
                width="32"
                height="32"
                loading="lazy"
                class="h-8 w-8 shrink-0 rounded border border-primary/60"
              />
              <span class="flex w-full min-w-0 flex-col items-center gap-0.5">
                <span class="w-full truncate text-center text-[11px] font-semibold text-text/90">
                  {{ tile.name }}
                </span>
                <span class="relative h-3.5 w-full overflow-hidden rounded-md bg-black/40">
                  <span
                    class="block h-full rounded-md bg-violet-500"
                    :style="{ width: `${relPct(tile.games, maxTileGames(spells))}%` }"
                  />
                  <span
                    class="absolute inset-0 flex items-center justify-end pr-1.5 text-[10px] font-bold tabular-nums text-white [text-shadow:0_0_3px_rgba(0,0,0,0.7)]"
                  >
                    {{ formatDashboardValue(tile.games) }}
                  </span>
                </span>
              </span>
            </li>
          </ul>
        </section>
      </div>

      <!-- Détail par rôle -->
      <section v-if="roleRows.length" class="rounded-xl border border-primary/25 bg-surface/20 p-3">
        <h3 class="mb-2 text-center text-sm font-semibold tracking-wider text-text-accent">
          {{ t('statisticsPage.championDashboardByRole') }}
        </h3>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[760px] table-fixed text-xs">
            <thead>
              <tr class="border-b border-primary/40 text-text-accent">
                <th class="w-[12%] p-1.5 text-center">
                  {{ t('statisticsPage.championDashboardRole') }}
                </th>
                <th class="w-[15%] p-1.5 text-center">
                  {{ t('statisticsPage.championDashboardGamesShort') }}
                </th>
                <th class="w-[12%] p-1.5 text-center">WR%</th>
                <th class="w-[13%] p-1.5 text-center">K/D/A</th>
                <th class="w-[11%] p-1.5 text-center">KDA</th>
                <th class="w-[13%] p-1.5 text-center">
                  {{ t('statisticsPage.championDashboardMetric_gold') }}
                </th>
                <th class="w-[10%] p-1.5 text-center">CS/m</th>
                <th class="w-[14%] p-1.5 text-center">
                  {{ t('statisticsPage.championDashboardMetric_damage') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in roleRows" :key="r.role" class="border-b border-primary/10">
                <td class="p-1.5 text-center font-bold text-text-accent">
                  <span class="inline-flex items-center justify-center gap-1">
                    <img
                      :src="statsRoleIconPath(r.role)"
                      :alt="statsRoleLabel(r.role)"
                      width="14"
                      height="14"
                      class="h-3.5 w-3.5 object-contain"
                    />
                    {{ statsRoleLabel(r.role) }}
                  </span>
                </td>
                <td class="p-1.5">
                  <span class="relative block h-5 overflow-hidden rounded bg-black/40">
                    <span
                      class="block h-full rounded bg-info"
                      :style="{ width: `${relPct(r.games, maxRoleGames)}%` }"
                    />
                    <span class="role-bar-label">{{ formatDashboardValue(r.games) }}</span>
                  </span>
                </td>
                <td class="p-1.5">
                  <span class="relative block h-5 overflow-hidden rounded bg-black/40">
                    <span
                      class="block h-full rounded"
                      :class="winrateClass(r.winrate)"
                      :style="{ width: `${barWidthPct(r.winrate)}%` }"
                    />
                    <span class="role-bar-label">{{ formatDashboardValue(r.winrate, 1) }}%</span>
                  </span>
                </td>
                <td class="p-1.5 text-center tabular-nums text-text/90">
                  {{ formatDashboardValue(r.kills, 1) }}/{{ formatDashboardValue(r.deaths, 1) }}/{{
                    formatDashboardValue(r.assists, 1)
                  }}
                </td>
                <td class="p-1.5">
                  <span class="relative block h-5 overflow-hidden rounded bg-black/40">
                    <span
                      class="block h-full rounded bg-sky-500"
                      :style="{ width: `${relPct(r.kda, maxRoleKda)}%` }"
                    />
                    <span class="role-bar-label">{{ formatDashboardValue(r.kda, 2) }}</span>
                  </span>
                </td>
                <td class="p-1.5">
                  <span class="relative block h-5 overflow-hidden rounded bg-black/40">
                    <span
                      class="block h-full rounded bg-yellow-400"
                      :style="{ width: `${relPct(r.gold, maxRoleGold)}%` }"
                    />
                    <span class="role-bar-label">{{ formatDashboardValue(r.gold) }}</span>
                  </span>
                </td>
                <td class="p-1.5">
                  <span class="relative block h-5 overflow-hidden rounded bg-black/40">
                    <span
                      class="block h-full rounded bg-violet-500"
                      :style="{ width: `${relPct(r.csPerMin, maxRoleCs)}%` }"
                    />
                    <span class="role-bar-label">{{ formatDashboardValue(r.csPerMin, 1) }}</span>
                  </span>
                </td>
                <td class="p-1.5">
                  <span class="relative block h-5 overflow-hidden rounded bg-black/40">
                    <span
                      class="block h-full rounded bg-orange-500"
                      :style="{ width: `${relPct(r.damage, maxRoleDamage)}%` }"
                    />
                    <span class="role-bar-label">{{ formatDashboardValue(r.damage) }}</span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.role-bar-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #fff;
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.7);
  pointer-events: none;
}
</style>
