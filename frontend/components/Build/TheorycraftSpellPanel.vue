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
      <p
        v-if="!passive && spells.length === 0"
        class="border-border/60 text-muted rounded-lg border p-3 text-sm"
      >
        {{ t('theorycraft.spells.noSpells') }}
      </p>

      <details v-if="passive" class="theorycraft-spell-entry group p-1.5" open>
        <summary
          class="spell-entry-row flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 marker:content-none"
        >
          <span class="text-muted shrink-0 text-[10px] leading-none" aria-hidden="true">
            <span class="group-open:hidden">▶</span>
            <span class="hidden group-open:inline">▼</span>
          </span>
          <div v-if="passive.imageUrl" class="theorycraft-spell-icon shrink-0">
            <img
              :src="passive.imageUrl"
              :alt="passive.name"
              class="theorycraft-spell-icon__img"
              loading="lazy"
            />
            <span class="theorycraft-spell-icon__key">P</span>
          </div>
          <h3 class="text-sm font-semibold leading-tight text-text">{{ passive.name }}</h3>
        </summary>

        <div v-if="passiveStackDefinition" class="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <label class="text-muted flex items-center gap-1.5">
            <span>{{ t('theorycraft.spells.stacks') }}</span>
            <input
              type="number"
              min="0"
              :max="passiveStackDefinition.maxStacks ?? undefined"
              class="theorycraft-stack-input border-border rounded border bg-surface text-text"
              :size="stackInputSize(passiveStackDefinition, stackCount(passiveStackDefinition.id))"
              :value="stackCount(passiveStackDefinition.id)"
              @input="onStackInput(passiveStackDefinition.id, $event)"
            />
          </label>
        </div>

        <!-- eslint-disable vue/no-v-html -->
        <div
          v-if="passive.summaryHtml && passive.showSummary"
          class="tooltip-spell-description tooltip-game-description text-muted mb-2 mt-2 text-sm"
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
          class="tooltip-spell-description tooltip-game-description border-border/40 mt-2 border-t pt-1.5 text-sm"
          v-html="detail"
        />
        <!-- eslint-enable vue/no-v-html -->
      </details>

      <details
        v-for="spell in spells"
        :key="spell.id"
        class="theorycraft-spell-entry group p-1.5"
        open
      >
        <summary
          class="spell-entry-row flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 marker:content-none"
        >
          <span class="text-muted shrink-0 text-[10px] leading-none" aria-hidden="true">
            <span class="group-open:hidden">▶</span>
            <span class="hidden group-open:inline">▼</span>
          </span>
          <div v-if="spell.imageUrl" class="theorycraft-spell-icon shrink-0">
            <img
              :src="spell.imageUrl"
              :alt="spell.name"
              class="theorycraft-spell-icon__img"
              loading="lazy"
            />
            <span class="theorycraft-spell-icon__key">{{ displaySpellSlot(spell.slot) }}</span>
          </div>
          <h3 class="text-sm font-semibold leading-tight text-text">{{ spell.name }}</h3>
          <span
            v-if="!spell.isDynamic"
            class="rounded bg-surface px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-text/60"
          >
            {{ t('theorycraft.spells.approximateValues') }}
          </span>
          <button
            v-if="spell.hasActivatableBuff"
            type="button"
            class="theorycraft-spell-active-toggle ml-auto shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide transition-colors"
            :class="
              isSpellActive(spell.id)
                ? 'border-accent bg-accent/25 text-accent'
                : 'border-border text-text/70 hover:border-accent/50'
            "
            :title="t('theorycraft.spells.toggleActive')"
            @click.stop="toggleSpellActive(spell.id)"
          >
            {{ t('theorycraft.spells.active') }}
          </button>
          <div class="spell-rank-buttons flex items-center gap-0.5" @click.stop>
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
        </summary>

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
              class="theorycraft-stack-input border-border rounded border bg-surface text-text"
              :size="
                stackInputSize(
                  stackDefinitionForSpell(spell.id, spell.slot)!,
                  stackCount(stackDefinitionForSpell(spell.id, spell.slot)!.id)
                )
              "
              :value="stackCount(stackDefinitionForSpell(spell.id, spell.slot)!.id)"
              @input="onStackInput(stackDefinitionForSpell(spell.id, spell.slot)!.id, $event)"
            />
          </label>
        </div>

        <!-- eslint-disable vue/no-v-html -->
        <dl
          v-if="spell.headerStats?.length"
          class="spell-header-stats mb-2 mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs"
        >
          <div
            v-for="stat in spell.headerStats"
            :key="stat.key"
            class="spell-header-stats__row inline-flex items-baseline gap-1 whitespace-nowrap"
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

        <div
          v-if="spell.summaryHtml && spell.showSummary"
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
          class="tooltip-spell-description tooltip-game-description border-border/40 mt-2 border-t pt-1.5 text-sm"
          v-html="detail"
        />
        <!-- eslint-enable vue/no-v-html -->
      </details>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useChampionData } from '~/composables/useChampionData'
import {
  finalizeTooltipDisplay,
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
import { spellHasActivatableBuff } from '~/utils/theorycraftSpellBuffs'
import { getImageUrl } from '~/utils/imageUrl'

interface SpellHeaderStat {
  key: string
  label: string
  valueText: string
  valueHtml?: string
}

interface SpellImageRef {
  full?: string
}

interface ResolvedSpellView {
  id: string
  slot: string
  name: string
  maxRank: number
  imageUrl?: string
  summaryHtml?: string
  showSummary: boolean
  descriptionHtml: string
  detailedTexts?: string[]
  headerStats?: SpellHeaderStat[]
  isDynamic: boolean
  hasActivatableBuff: boolean
}

interface ResolvedPassiveView {
  name: string
  imageUrl?: string
  summaryHtml?: string
  showSummary: boolean
  descriptionHtml: string
  detailedTexts?: string[]
  isDynamic: boolean
}

const props = defineProps<{
  championId: string | null
  championData?: Record<string, unknown> | null
  level: number
  buildStats: TheorycraftBuildStats | null
}>()

const { t, locale } = useI18n()
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

function stackInputSize(
  definition: Pick<TheorycraftStackDefinition, 'maxStacks'>,
  value: number
): number {
  const maxLen = String(definition.maxStacks ?? 9999).length
  const valueLen = String(value || 0).length
  return Math.max(2, maxLen, valueLen) + 1
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

const QWERTY_TO_AZERTY: Record<string, string> = {
  Q: 'A',
  W: 'Z',
  E: 'E',
  R: 'R',
}

function displaySpellSlot(slot: string): string {
  const normalized = String(slot ?? '')
    .trim()
    .toUpperCase()
  if (locale.value === 'fr') {
    return QWERTY_TO_AZERTY[normalized] ?? normalized
  }
  return normalized
}

function championIdForImages(): string {
  const champion = props.championData ?? loadedChampion.value
  return String(props.championId ?? champion?.id ?? '').trim()
}

function spellImageRef(raw: Record<string, unknown>): SpellImageRef | null {
  const image = raw.image
  if (!image || typeof image !== 'object') return null
  return image as SpellImageRef
}

function resolveSpellImageUrl(imageFull: string, isPassive = false): string {
  const filename = String(imageFull ?? '').trim()
  if (!filename) return ''
  const subPath = isPassive ? 'passive' : championIdForImages()
  if (!isPassive && !subPath) return ''
  return getImageUrl('champion-spell', 'latest', filename, subPath)
}

function resolvePassiveImageUrl(passiveRaw: Record<string, unknown>): string {
  const imageFull = String(spellImageRef(passiveRaw)?.full ?? '').trim()
  if (imageFull) return resolveSpellImageUrl(imageFull, true)
  const championId = championIdForImages()
  if (!championId) return ''
  return resolveSpellImageUrl(`${championId}_P.png`, true)
}

function resolveAbilityImageUrl(spellRaw: Record<string, unknown>): string {
  const imageFull = String(spellImageRef(spellRaw)?.full ?? '').trim()
  if (imageFull) return resolveSpellImageUrl(imageFull, false)
  const championId = championIdForImages()
  const slot = String(spellRaw.slot ?? '')
    .trim()
    .toUpperCase()
  if (!championId || !slot) return ''
  return resolveSpellImageUrl(`${championId}${slot}.png`, false)
}

function activeRank(spellId: string): number {
  return rankBySpellId[spellId] ?? 1
}

function setRank(spellId: string, rank: number) {
  rankBySpellId[spellId] = rank
  buildStore.setTheorycraftSpellRank(spellId, rank)
}

function isSpellActive(spellId: string): boolean {
  return Boolean(buildStore.theorycraftActiveSpells[spellId])
}

function toggleSpellActive(spellId: string) {
  buildStore.toggleTheorycraftActiveSpell(spellId)
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

  const detailCandidates =
    resolvedDetails.length > 0
      ? resolvedDetails.map(section => normalizeKaynFormMarkup(section))
      : staticDetails

  const finalized = finalizeTooltipDisplay({
    summaryHtml: raw.summaryHtml ? String(raw.summaryHtml) : undefined,
    descriptionHtml: normalizeKaynFormMarkup(resolved.html),
    detailedTexts: detailCandidates,
  })

  return {
    name: String(raw.name ?? ''),
    maxRank: Math.max(1, Number(raw.maxRank ?? 5)),
    summaryHtml: finalized.summaryHtml,
    showSummary: finalized.showSummary,
    descriptionHtml: finalized.descriptionHtml,
    detailedTexts: finalized.detailedTexts,
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

const passive = computed((): ResolvedPassiveView | null => {
  const champion = loadedChampion.value
  const passiveRaw = champion?.passive
  if (!passiveRaw || typeof passiveRaw !== 'object') return null

  const passiveData = passiveRaw as TheorycraftSpellRuntimeData & Record<string, unknown>
  const rank = passiveRankForChampionLevel(props.level)
  const resolved = resolveSpellView(passiveData, rank, buildStackContext({ scope: 'passive' }))

  return {
    name: resolved.name,
    imageUrl: resolvePassiveImageUrl(passiveData),
    summaryHtml: resolved.summaryHtml,
    showSummary: resolved.showSummary,
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
    const storeRank = buildStore.theorycraftSpellRanks[id]
    if (storeRank != null && rankBySpellId[id] !== storeRank) {
      rankBySpellId[id] = storeRank
    }
    const rank = Math.min(Math.max(rankBySpellId[id] ?? storeRank ?? 1, 1), maxRank)
    const resolved = resolveSpellView(
      spell,
      rank,
      buildStackContext({ scope: 'spell', id, slot: String(spell.slot ?? '') })
    )

    return {
      id,
      slot: String(spell.slot ?? ''),
      imageUrl: resolveAbilityImageUrl(spell),
      hasActivatableBuff: spellHasActivatableBuff(spell),
      ...resolved,
    }
  })
})

watch(
  () =>
    [
      props.championId,
      props.championData,
      loadedChampion.value,
      stackDefinitions.value,
      stackCalculationsBySource.value,
    ] as const,
  () => {
    const champion = props.championData ?? loadedChampion.value
    const championId = props.championId ?? String(champion?.id ?? '')
    if (!championId) return
    const spells = Array.isArray(champion?.spells) ? champion.spells : []
    buildStore.setTheorycraftStackContext({
      championId,
      definitions: stackDefinitions.value,
      calculationsBySource: stackCalculationsBySource.value,
      spells: spells as TheorycraftSpellRuntimeData[],
    })
  },
  { immediate: true }
)

watch(loadError, value => {
  if (value) error.value = value
})
</script>

<style scoped>
.theorycraft-spell-entry {
  --spell-entry-border-gradient: var(
    --card-border-gradient-strong,
    linear-gradient(130deg, #bba077 0%, #9a8468 45%, #1e2328 100%)
  );
  border: 2px solid transparent;
  border-radius: 6px;
  background:
    linear-gradient(var(--color-blue-500), var(--color-blue-500)) padding-box,
    var(--spell-entry-border-gradient) border-box;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.35);
}

summary::-webkit-details-marker {
  display: none;
}

.theorycraft-spell-icon {
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  overflow: visible;
}

.theorycraft-spell-icon__img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 4px;
  border: 2px solid transparent;
  border-image: var(
      --card-border-gradient-strong,
      linear-gradient(130deg, #bba077 0%, #9a8468 45%, #1e2328 100%)
    )
    1;
  background: #000;
  object-fit: cover;
}

.theorycraft-spell-icon__key {
  position: absolute;
  bottom: -5px;
  right: -5px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.9);
  color: var(--color-gold-300);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.spell-entry-row {
  overflow: visible;
}

.theorycraft-stack-input {
  box-sizing: border-box;
  width: auto;
  min-width: 2ch;
  height: 1.2em;
  padding: 0 0.35em;
  font: inherit;
  line-height: 1;
  text-align: center;
  vertical-align: baseline;
  field-sizing: content;
  appearance: textfield;
  -moz-appearance: textfield;
}

.theorycraft-stack-input::-webkit-outer-spin-button,
.theorycraft-stack-input::-webkit-inner-spin-button {
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
}

.spell-header-stats__label {
  color: rgb(252 211 77 / 0.95);
}

.spell-header-stats__value {
  font-weight: 700;
  color: rgb(255 255 255 / 0.92);
  white-space: nowrap;
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
