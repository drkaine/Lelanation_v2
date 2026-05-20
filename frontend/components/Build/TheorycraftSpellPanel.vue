<template>
  <section class="theorycraft-spell-panel space-y-3">
    <div
      v-if="!championId"
      class="border-border/60 text-muted rounded-lg border p-6 text-center text-sm"
    >
      {{ t('theorycraft.spells.selectChampion') }}
    </div>

    <div v-else-if="loading" class="text-muted py-6 text-center text-sm">
      {{ t('theorycraft.spells.loading') }}
    </div>

    <div v-else-if="error" class="rounded-lg border border-red-400/40 p-4 text-sm text-red-400">
      {{ error }}
    </div>

    <template v-else>
      <p v-if="buildStats" class="text-muted text-xs">
        AD {{ formatStat(buildStats.totalAD) }} · AP {{ formatStat(buildStats.AP) }}
      </p>

      <p
        v-if="!passive && spells.length === 0"
        class="border-border/60 text-muted rounded-lg border p-3 text-sm"
      >
        {{ t('theorycraft.spells.noSpells') }}
      </p>

      <div v-if="passive" class="border-border/60 rounded-lg border p-3">
        <div class="spell-entry-row flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            class="inline-flex h-3.5 min-w-[14px] items-center justify-center rounded bg-accent/20 px-1 text-[9px] font-bold leading-none text-accent"
          >
            {{ t('theorycraft.spells.passive') }}
          </span>
          <h3 class="text-sm font-semibold leading-tight text-text">{{ passive.name }}</h3>
        </div>

        <div v-if="passiveStackDefinition" class="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <label class="text-muted flex items-center gap-1.5">
            <span>{{ t('theorycraft.spells.stacks') }}</span>
            <input
              type="number"
              min="0"
              :max="passiveStackDefinition.maxStacks ?? undefined"
              class="border-border h-7 w-20 rounded border bg-surface px-2 text-sm text-text"
              :value="stackCount(passiveStackDefinition.id)"
              @input="onStackInput(passiveStackDefinition.id, $event)"
            />
          </label>
        </div>

        <!-- eslint-disable vue/no-v-html -->
        <details class="group mt-2" open>
          <summary
            class="text-muted mb-2 cursor-pointer list-none text-sm font-semibold marker:content-none"
          >
            <span class="group-open:hidden">{{ t('theorycraft.spells.showDescription') }}</span>
            <span class="hidden group-open:inline">{{
              t('theorycraft.spells.hideDescription')
            }}</span>
          </summary>

          <div
            v-if="passive.summaryHtml"
            class="tooltip-spell-description tooltip-game-description text-muted mb-2 text-sm"
            v-html="passive.summaryHtml"
          />

          <div
            v-if="passive.descriptionHtml"
            class="tooltip-spell-description tooltip-game-description text-sm"
            v-html="passive.descriptionHtml"
          />

          <div
            v-for="(detail, index) in passive.detailedTexts ?? []"
            :key="`passive-detail-${index}`"
            class="tooltip-spell-description tooltip-game-description border-border/40 mt-3 border-t pt-3 text-sm"
            v-html="detail"
          />
        </details>
        <!-- eslint-enable vue/no-v-html -->
      </div>

      <div v-for="spell in spells" :key="spell.id" class="border-border/60 rounded-lg border p-3">
        <div class="spell-entry-row flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            class="inline-flex h-3.5 min-w-[14px] items-center justify-center rounded bg-accent/20 px-1 text-[9px] font-bold leading-none text-accent"
          >
            {{ spell.slot }}
          </span>
          <h3 class="text-sm font-semibold leading-tight text-text">{{ spell.name }}</h3>
          <span
            v-if="!spell.isDynamic"
            class="rounded bg-surface px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-text/60"
          >
            {{ t('theorycraft.spells.approximateValues') }}
          </span>
          <div class="spell-rank-buttons ml-auto flex items-center gap-0.5">
            <button
              v-for="rank in spell.maxRank"
              :key="`${spell.id}-rank-${rank}`"
              type="button"
              class="inline-flex h-3.5 min-w-[14px] items-center justify-center rounded border px-0.5 text-[9px] font-semibold leading-none transition-colors"
              :class="
                activeRank(spell.id) === rank
                  ? 'border-accent bg-accent/20 text-accent'
                  : 'border-border text-text hover:border-accent/60'
              "
              @click="setRank(spell.id, rank)"
            >
              {{ rank }}
            </button>
          </div>
        </div>

        <div
          v-if="stackDefinitionForSpell(spell.id, spell.slot)"
          class="mt-2 flex flex-wrap items-center gap-2 text-xs"
        >
          <label class="text-muted flex items-center gap-1.5">
            <span>{{ t('theorycraft.spells.stacks') }}</span>
            <input
              type="number"
              min="0"
              :max="stackDefinitionForSpell(spell.id, spell.slot)?.maxStacks ?? undefined"
              class="border-border h-7 w-20 rounded border bg-surface px-2 text-sm text-text"
              :value="stackCount(stackDefinitionForSpell(spell.id, spell.slot)!.id)"
              @input="onStackInput(stackDefinitionForSpell(spell.id, spell.slot)!.id, $event)"
            />
          </label>
        </div>

        <!-- eslint-disable vue/no-v-html -->
        <dl
          v-if="spell.headerStats?.length"
          class="spell-header-stats mb-3 mt-2 grid gap-1 text-xs sm:grid-cols-2"
        >
          <div
            v-for="stat in spell.headerStats"
            :key="stat.key"
            class="spell-header-stats__row flex gap-2"
          >
            <dt class="spell-header-stats__label shrink-0 font-semibold uppercase tracking-wide">
              {{ stat.label }}:
            </dt>
            <dd
              class="spell-header-stats__value text-text"
              v-html="stat.valueHtml ?? stat.valueText"
            />
          </div>
        </dl>

        <details class="group" open>
          <summary
            class="text-muted mb-2 cursor-pointer list-none text-sm font-semibold marker:content-none"
          >
            <span class="group-open:hidden">{{ t('theorycraft.spells.showDescription') }}</span>
            <span class="hidden group-open:inline">{{
              t('theorycraft.spells.hideDescription')
            }}</span>
          </summary>

          <div
            v-if="spell.summaryHtml"
            class="tooltip-spell-description tooltip-game-description text-muted mb-2 text-sm"
            v-html="spell.summaryHtml"
          />

          <div
            v-if="spell.descriptionHtml"
            class="tooltip-spell-description tooltip-game-description text-sm"
            v-html="spell.descriptionHtml"
          />

          <div
            v-for="(detail, index) in spell.detailedTexts ?? []"
            :key="`${spell.id}-detail-${index}`"
            class="tooltip-spell-description tooltip-game-description border-border/40 mt-3 border-t pt-3 text-sm"
            v-html="detail"
          />
        </details>
        <!-- eslint-enable vue/no-v-html -->
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useChampionData } from '~/composables/useChampionData'
import {
  resolveTheorycraftSpellDescription,
  resolveTheorycraftSpellDetailRaws,
  type TheorycraftSpellRuntimeData,
  type TheorycraftStackResolveContext,
} from '~/composables/useTheorycraftTooltip'
import { useBuildStore } from '~/stores/BuildStore'
import type { TheorycraftBuildStats, TheorycraftStackDefinition } from '~/types/theorycraft'
import { normalizeKaynFormMarkup } from '~/utils/kaynFormTooltipMarkup'
import { passiveRankForChampionLevel, resolveHeaderStatAtRank } from '~/utils/theorycraftStats'
import {
  buildStackCalculationsBySource,
  findStackDefinitionForSource,
  parseStackDefinitions,
} from '~/utils/theorycraftStacks'

interface SpellHeaderStat {
  key: string
  label: string
  valueText: string
  valueHtml?: string
}

interface ResolvedSpellView {
  id: string
  slot: string
  name: string
  maxRank: number
  summaryHtml?: string
  descriptionHtml: string
  detailedTexts?: string[]
  headerStats?: SpellHeaderStat[]
  isDynamic: boolean
}

const props = defineProps<{
  championId: string | null
  championData?: Record<string, unknown> | null
  level: number
  buildStats: TheorycraftBuildStats | null
}>()

const { t } = useI18n()
const { loadChampion, error: loadError } = useChampionData()
const buildStore = useBuildStore()

const loading = ref(false)
const error = ref<string | null>(null)
const loadedChampion = ref<Record<string, unknown> | null>(null)
const rankBySpellId = reactive<Record<string, number>>({})
const stackDefinitions = computed(() => parseStackDefinitions(loadedChampion.value))
const stackCalculationsBySource = computed(() =>
  buildStackCalculationsBySource(loadedChampion.value)
)

const passiveStackDefinition = computed(() =>
  findStackDefinitionForSource(stackDefinitions.value, { scope: 'passive' })
)

function stackDefinitionForSpell(id: string, slot: string): TheorycraftStackDefinition | null {
  return findStackDefinitionForSource(stackDefinitions.value, { scope: 'spell', id, slot })
}

function stackCount(definitionId: string): number {
  return buildStore.theorycraftStackCounts[definitionId] ?? 0
}

function onStackInput(definitionId: string, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  buildStore.setTheorycraftStackCount(definitionId, value)
}

function buildStackContext(source: {
  scope: 'passive' | 'spell'
  id?: string
  slot?: string
}): TheorycraftStackResolveContext | null {
  const definition = findStackDefinitionForSource(stackDefinitions.value, source)
  if (!definition) return null
  const count = stackCount(definition.id)
  if (count <= 0) return null
  return {
    definition,
    stackCount: count,
    calculationsBySource: stackCalculationsBySource.value,
  }
}

function formatStat(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value * 10) / 10) : '0'
}

function activeRank(spellId: string): number {
  return rankBySpellId[spellId] ?? 1
}

function setRank(spellId: string, rank: number) {
  rankBySpellId[spellId] = rank
}

function resolveSpellView(
  raw: TheorycraftSpellRuntimeData & Record<string, unknown>,
  rank: number,
  stackContext?: TheorycraftStackResolveContext | null
): Omit<ResolvedSpellView, 'id' | 'slot'> {
  const fallbackHtml = normalizeKaynFormMarkup(
    String(
      raw.descriptionHtml ?? raw.descriptionParsed ?? raw.descriptionText ?? raw.parsedText ?? ''
    )
  )

  const resolved = resolveTheorycraftSpellDescription(
    raw,
    props.buildStats,
    rank,
    fallbackHtml,
    stackContext
  )

  const resolvedDetails = resolveTheorycraftSpellDetailRaws(
    raw,
    props.buildStats,
    rank,
    stackContext
  )
  const staticDetails = Array.isArray(raw.detailedTexts)
    ? raw.detailedTexts.map(section => normalizeKaynFormMarkup(String(section ?? '')))
    : []

  return {
    name: String(raw.name ?? ''),
    maxRank: Math.max(1, Number(raw.maxRank ?? 5)),
    summaryHtml: raw.summaryHtml ? String(raw.summaryHtml) : undefined,
    descriptionHtml: normalizeKaynFormMarkup(resolved.html),
    detailedTexts:
      resolvedDetails.length > 0
        ? resolvedDetails.map(section => normalizeKaynFormMarkup(section))
        : staticDetails,
    headerStats: Array.isArray(raw.headerStats)
      ? raw.headerStats.map((stat: SpellHeaderStat) =>
          resolveHeaderStatAtRank(stat, rank, {
            cooldownReduction: props.buildStats?.cooldownReduction ?? 0,
          })
        )
      : [],
    isDynamic: resolved.isDynamic,
  }
}

async function ensureChampionLoaded() {
  if (props.championData) {
    loadedChampion.value = props.championData
    return
  }
  if (!props.championId) {
    loadedChampion.value = null
    return
  }
  loading.value = true
  error.value = null
  try {
    loadedChampion.value = await loadChampion(props.championId)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    loadedChampion.value = null
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.championId, props.championData] as const,
  () => {
    ensureChampionLoaded().catch(() => undefined)
  },
  { immediate: true }
)

const passive = computed(() => {
  const champion = loadedChampion.value
  const passiveRaw = champion?.passive
  if (!passiveRaw || typeof passiveRaw !== 'object') return null

  const passiveData = passiveRaw as TheorycraftSpellRuntimeData & Record<string, unknown>
  const rank = passiveRankForChampionLevel(props.level)
  const resolved = resolveSpellView(passiveData, rank, buildStackContext({ scope: 'passive' }))

  return {
    name: resolved.name,
    summaryHtml: resolved.summaryHtml,
    descriptionHtml: resolved.descriptionHtml,
    detailedTexts: resolved.detailedTexts,
    isDynamic: resolved.isDynamic,
  }
})

const spells = computed<ResolvedSpellView[]>(() => {
  const champion = loadedChampion.value
  const list = Array.isArray(champion?.spells) ? champion.spells : []

  return list.map(raw => {
    const spell = raw as TheorycraftSpellRuntimeData & Record<string, unknown>
    const id = String(spell.id ?? '')
    const maxRank = Math.max(1, Number(spell.maxRank ?? 5))
    const rank = Math.min(Math.max(rankBySpellId[id] ?? 1, 1), maxRank)
    const resolved = resolveSpellView(
      spell,
      rank,
      buildStackContext({ scope: 'spell', id, slot: String(spell.slot ?? '') })
    )

    return {
      id,
      slot: String(spell.slot ?? ''),
      ...resolved,
    }
  })
})

watch(
  () =>
    [
      props.championId,
      props.championData,
      stackDefinitions.value,
      stackCalculationsBySource.value,
    ] as const,
  () => {
    const champion = props.championData ?? loadedChampion.value
    const championId = props.championId ?? String(champion?.id ?? '')
    if (!championId || stackDefinitions.value.length === 0) return
    buildStore.setTheorycraftStackContext({
      championId,
      definitions: stackDefinitions.value,
      calculationsBySource: stackCalculationsBySource.value,
    })
  },
  { immediate: true }
)

watch(loadError, value => {
  if (value) error.value = value
})
</script>

<style scoped>
summary::-webkit-details-marker {
  display: none;
}

.spell-header-stats__label {
  color: rgb(252 211 77 / 0.95);
}

.spell-header-stats__value {
  font-weight: 700;
  color: rgb(255 255 255 / 0.92);
}

:deep(.tooltip-spell-description .dmg-physical),
:deep(.tooltip-spell-description physicalDamage) {
  color: rgb(248 113 113 / 1);
}

:deep(.tooltip-spell-description .dmg-magic),
:deep(.tooltip-spell-description magicDamage) {
  color: rgb(196 181 253 / 1);
}

:deep(.tooltip-spell-description .dmg-true),
:deep(.tooltip-spell-description trueDamage) {
  color: rgb(226 232 240 / 1);
}

:deep(.tooltip-spell-description .scale-ap),
:deep(.tooltip-spell-description .tooltip-tag.scale-ap) {
  color: rgb(196 181 253 / 1);
  font-weight: 700;
}

:deep(.tooltip-spell-description .scale-ad),
:deep(.tooltip-spell-description .tooltip-tag.scale-ad) {
  color: rgb(253 224 71 / 1);
  font-weight: 700;
}

:deep(.tooltip-spell-description .healing),
:deep(.tooltip-spell-description healing) {
  color: rgb(134 239 172 / 1);
}

:deep(.tooltip-spell-description .shield),
:deep(.tooltip-spell-description shield) {
  color: rgb(134 239 172 / 1);
}

:deep(.tooltip-spell-description .speed),
:deep(.tooltip-spell-description speed) {
  color: rgb(96 165 250 / 1);
}
</style>
