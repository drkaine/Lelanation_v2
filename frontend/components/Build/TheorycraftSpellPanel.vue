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
      <div
        v-if="hasVersusTarget() && simulatedTarget"
        class="border-border/60 mb-2 flex flex-wrap items-center gap-2 rounded-lg border p-2 text-xs"
      >
        <span class="font-semibold text-text">
          Cible: {{ Math.round(simulatedTarget.hp) }} PV
          <span v-if="simulatedTarget.shield > 0">
            + {{ Math.round(simulatedTarget.shield) }} bouclier</span
          >
        </span>
        <span class="text-muted">({{ Math.round(effectiveTargetHp) }} effectifs)</span>
        <span class="text-muted">
          CC combo: hard {{ simulatedControl.hardCcSeconds.toFixed(2) }}s / slow
          {{ simulatedControl.slowSeconds.toFixed(2) }}s
        </span>
        <span class="text-muted">
          actif: hard {{ activeHardCcRemaining.toFixed(2) }}s / slow
          {{ activeSlowRemaining.toFixed(2) }}s
        </span>
        <span class="text-muted">lock {{ actionLockRemaining().toFixed(2) }}s</span>
        <span v-if="simulatedResource" class="text-muted">
          {{ simulatedResource.kind }} {{ simulatedResource.current.toFixed(0) }}/{{
            simulatedResource.max.toFixed(0)
          }}
        </span>
        <label class="text-muted inline-flex items-center gap-1">
          t={{ timelineNowSeconds.toFixed(1) }}s
          <input
            v-model.number="timelineStepSeconds"
            type="number"
            min="0.05"
            step="0.05"
            class="theorycraft-stack-input border-border rounded border bg-surface text-text"
            style="width: 4.8ch"
            title="Pas de temps auto après chaque action"
          />
        </label>
        <button
          type="button"
          class="border-border rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text/80 hover:border-accent/60"
          :disabled="autoRemainingCooldown() > 0.001"
          @click="useAutoAttack"
        >
          AA
          <span v-if="autoRemainingCooldown() > 0.001"
            >({{ autoRemainingCooldown().toFixed(1) }}s)</span
          >
        </button>
        <button
          type="button"
          class="border-border rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text/80 hover:border-accent/60"
          @click="enqueueAutoAttack"
        >
          Queue AA
        </button>
        <button
          type="button"
          class="border-border rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text/80 hover:border-accent/60"
          @click="waitTimelineStep"
        >
          Wait +{{ timelineStepSeconds.toFixed(2) }}s
        </button>
        <button
          type="button"
          class="border-border rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text/80 hover:border-accent/60"
          :disabled="actionQueue.length === 0"
          @click="runQueuedActions"
        >
          Run Queue ({{ actionQueue.length }})
        </button>
        <button
          type="button"
          class="border-border rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text/80 hover:border-accent/60"
          :disabled="actionQueue.length === 0"
          @click="clearQueue"
        >
          Clear Queue
        </button>
        <button
          type="button"
          class="border-border rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text/80 hover:border-accent/60"
          @click="resetSimulation"
        >
          Reset PV
        </button>
      </div>

      <div
        v-if="hasVersusTarget() && killHints.length > 0"
        class="border-border/40 mb-2 rounded border px-2 py-1.5 text-[11px] text-text/85"
      >
        <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text/65">
          Estimations kill
        </p>
        <p v-for="(hint, index) in killHints" :key="`kill-hint-${index}`">{{ hint }}</p>
      </div>

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
          <span
            v-if="passive.damageVsChampion != null"
            class="spell-vs-damage-badge"
            :class="{ 'spell-vs-damage-badge--lethal': passive.lethalVsChampion }"
          >
            {{ Math.round(passive.damageVsChampion) }} PV en moins
            <span
              v-if="passive.damageVsTooltip"
              class="spell-vs-damage-info"
              :title="passive.damageVsTooltip"
              aria-label="Détail du calcul"
              >i</span
            >
            <span v-if="passive.lethalVsChampion" aria-hidden="true">☠</span>
          </span>
          <span
            v-if="(passive.controlDurationVsChampion ?? 0) > 0"
            class="spell-vs-damage-badge"
            :title="passive.controlVsTooltip"
          >
            CC {{ passive.controlDurationVsChampion?.toFixed(2) }}s
            <span class="text-[9px] opacity-80">
              (H {{ passive.hardControlDurationVsChampion?.toFixed(2) }} / S
              {{ passive.slowDurationVsChampion?.toFixed(2) }})
            </span>
          </span>
          <button
            v-if="passive.damageVsChampion != null"
            type="button"
            class="border-border rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-text/80 hover:border-accent/60"
            @click.stop="usePassiveDamage(passive)"
          >
            Lancer
          </button>
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
          <div class="spell-entry-controls flex shrink-0 flex-wrap items-center gap-1" @click.stop>
            <div class="spell-rank-buttons flex items-center gap-0.5">
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
            <span
              v-if="spell.damageVsChampion != null"
              class="spell-vs-damage-badge"
              :class="{ 'spell-vs-damage-badge--lethal': spell.lethalVsChampion }"
            >
              {{ Math.round(spell.damageVsChampion) }} PV en moins
              <span
                v-if="spell.damageVsTooltip"
                class="spell-vs-damage-info"
                :title="spell.damageVsTooltip"
                aria-label="Détail du calcul"
                >i</span
              >
              <span v-if="spell.lethalVsChampion" aria-hidden="true">☠</span>
            </span>
            <span
              v-if="(spell.controlDurationVsChampion ?? 0) > 0"
              class="spell-vs-damage-badge"
              :title="spell.controlVsTooltip"
            >
              CC {{ spell.controlDurationVsChampion?.toFixed(2) }}s
              <span class="text-[9px] opacity-80">
                (H {{ spell.hardControlDurationVsChampion?.toFixed(2) }} / S
                {{ spell.slowDurationVsChampion?.toFixed(2) }})
              </span>
            </span>
            <button
              v-if="spell.damageVsChampion != null || (spell.controlDurationVsChampion ?? 0) > 0"
              type="button"
              class="border-border rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-text/80 hover:border-accent/60"
              :disabled="
                spellRemainingCooldown(spell.id) > 0.001 ||
                (simulatedResource != null &&
                  (spell.resourceCost ?? 0) > simulatedResource.current + 1e-6)
              "
              @click="useSpellDamage(spell)"
            >
              Lancer
              <span v-if="spellRemainingCooldown(spell.id) > 0.001">
                ({{ spellRemainingCooldown(spell.id).toFixed(1) }}s)
              </span>
              <span v-else-if="(spell.resourceCost ?? 0) > 0">
                ({{ spell.resourceCost?.toFixed(0) }} {{ simulatedResource?.kind ?? 'mana' }})
              </span>
            </button>
            <button
              v-if="spell.damageVsChampion != null || (spell.controlDurationVsChampion ?? 0) > 0"
              type="button"
              class="border-border rounded border px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-text/80 hover:border-accent/60"
              @click="enqueueSpell(spell)"
            >
              Queue
            </button>
            <button
              v-if="spell.hasActivatableBuff"
              type="button"
              class="theorycraft-spell-active-toggle shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide transition-colors"
              :class="
                isSpellActive(spell.id)
                  ? 'border-accent bg-accent/25 text-accent'
                  : 'border-border text-text/70 hover:border-accent/50'
              "
              :title="t('theorycraft.spells.toggleActive')"
              @click="toggleSpellActive(spell.id)"
            >
              {{ t('theorycraft.spells.active') }}
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

      <div
        v-if="simulationLog.length > 0"
        class="border-border/40 mt-2 rounded border px-2 py-1.5 text-[11px] text-text/85"
      >
        <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text/65">
          Historique combo
        </p>
        <p v-for="(line, index) in simulationLog" :key="`sim-log-${index}`">{{ line }}</p>
      </div>
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
  type TheorycraftSpellCalculation,
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
  damageVsChampion?: number | null
  lethalVsChampion?: boolean
  damageVsTooltip?: string
  controlDurationVsChampion?: number | null
  hardControlDurationVsChampion?: number | null
  slowDurationVsChampion?: number | null
  controlVsTooltip?: string
  cooldownSeconds?: number
  resourceCost?: number
  hitDelaySeconds?: number
}

interface ResolvedPassiveView {
  name: string
  imageUrl?: string
  summaryHtml?: string
  showSummary: boolean
  descriptionHtml: string
  detailedTexts?: string[]
  isDynamic: boolean
  damageVsChampion?: number | null
  lethalVsChampion?: boolean
  damageVsTooltip?: string
  controlDurationVsChampion?: number | null
  hardControlDurationVsChampion?: number | null
  slowDurationVsChampion?: number | null
  controlVsTooltip?: string
}

interface SimulatedTargetState {
  hp: number
  shield: number
}

interface SimulatedControlState {
  hardCcSeconds: number
  slowSeconds: number
}

interface SimulatedResourceState {
  kind: 'mana' | 'energy'
  current: number
  max: number
}

interface TimeWindow {
  start: number
  end: number
}

interface QueuedAction {
  type: 'aa' | 'spell'
  spellId?: string
  label: string
}

interface PendingHitEvent {
  at: number
  label: string
  damage: number
  hardCc: number
  slowCc: number
}

const props = defineProps<{
  championId: string | null
  championData?: Record<string, unknown> | null
  level: number
  buildStats: TheorycraftBuildStats | null
  opponentBuildStats?: TheorycraftBuildStats | null
  opponentRawStats?: Record<string, number> | null
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
const simulatedTarget = ref<SimulatedTargetState | null>(null)
const simulatedControl = ref<SimulatedControlState>({ hardCcSeconds: 0, slowSeconds: 0 })
const simulatedResource = ref<SimulatedResourceState | null>(null)
const timelineNowSeconds = ref(0)
const timelineStepSeconds = ref(0.4)
const hardControlWindows = ref<TimeWindow[]>([])
const slowControlWindows = ref<TimeWindow[]>([])
const spellReadyAt = reactive<Record<string, number>>({})
const autoReadyAt = ref(0)
const castLockUntil = ref(0)
const gcdLockUntil = ref(0)
const actionQueue = ref<QueuedAction[]>([])
const pendingHitEvents = ref<PendingHitEvent[]>([])
const simulationLog = ref<string[]>([])

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

function hasVersusTarget(): boolean {
  return Boolean(props.opponentBuildStats && props.opponentRawStats)
}

function targetMaxHp(): number {
  return Number(props.opponentBuildStats?.totalHP ?? 0)
}

function targetInitialShield(): number {
  return Math.max(0, Number(props.opponentRawStats?.shield ?? 0))
}

function resolveResourceKind(): 'mana' | 'energy' {
  const partype = String((props.championData as { partype?: string } | null)?.partype ?? '')
    .trim()
    .toLowerCase()
  return partype.includes('energy') ? 'energy' : 'mana'
}

function maxResourcePool(): number {
  const stats = props.buildStats
  if (!stats) return 0
  if (resolveResourceKind() === 'energy') return 200
  return Math.max(0, Number(stats.maxMana ?? 0))
}

function resetSimulation() {
  if (!hasVersusTarget()) {
    simulatedTarget.value = null
    simulationLog.value = []
    return
  }
  simulatedTarget.value = {
    hp: Math.max(0, targetMaxHp()),
    shield: targetInitialShield(),
  }
  const maxResource = maxResourcePool()
  simulatedResource.value = {
    kind: resolveResourceKind(),
    current: maxResource,
    max: maxResource,
  }
  timelineNowSeconds.value = 0
  simulatedControl.value = { hardCcSeconds: 0, slowSeconds: 0 }
  hardControlWindows.value = []
  slowControlWindows.value = []
  Object.keys(spellReadyAt).forEach(key => {
    delete spellReadyAt[key]
  })
  autoReadyAt.value = 0
  castLockUntil.value = 0
  gcdLockUntil.value = 0
  actionQueue.value = []
  pendingHitEvents.value = []
  simulationLog.value = []
}

function ensureSimulationState(): SimulatedTargetState | null {
  if (!hasVersusTarget()) return null
  if (!simulatedTarget.value) resetSimulation()
  return simulatedTarget.value
}

function applyDamageToSimulation(amount: number, sourceLabel: string) {
  const target = ensureSimulationState()
  if (!target) return
  const damage = Math.max(0, Number(amount) || 0)
  if (damage <= 0) return

  let remaining = damage
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, remaining)
    target.shield -= absorbed
    remaining -= absorbed
  }
  if (remaining > 0) {
    target.hp = Math.max(0, target.hp - remaining)
  }
  recordTimelineEvent(
    `${sourceLabel}: -${formatDamageValue(damage)} (${formatDamageValue(target.hp)} PV restants)`
  )
}

function recordTimelineEvent(message: string) {
  simulationLog.value = [
    `t=${formatDamageValue(timelineNowSeconds.value)}s • ${message}`,
    ...simulationLog.value,
  ].slice(0, 12)
}

function advanceTimeline(seconds?: number) {
  const step = Number(seconds ?? timelineStepSeconds.value)
  if (!Number.isFinite(step) || step <= 0) return
  timelineNowSeconds.value += step
  if (simulatedResource.value) {
    const regenPerSecond = simulatedResource.value.kind === 'energy' ? 10 : 8
    simulatedResource.value.current = Math.min(
      simulatedResource.value.max,
      simulatedResource.value.current + regenPerSecond * step
    )
  }
  processPendingHitEvents()
}

function waitTimelineStep() {
  advanceTimeline()
}

function autoAttackIntervalSeconds(): number {
  const asFromStats = Number(buildStore.calculatedStats?.attackSpeed ?? NaN)
  const attackSpeed = Number.isFinite(asFromStats) && asFromStats > 0 ? asFromStats : 0.7
  return 1 / attackSpeed
}

function spellRemainingCooldown(spellId: string): number {
  const readyAt = Number(spellReadyAt[spellId] ?? 0)
  return Math.max(0, readyAt - timelineNowSeconds.value)
}

function autoRemainingCooldown(): number {
  return Math.max(0, autoReadyAt.value - timelineNowSeconds.value)
}

function actionLockRemaining(): number {
  const now = timelineNowSeconds.value
  return Math.max(0, castLockUntil.value - now, gcdLockUntil.value - now)
}

function applyActionRecovery(castTimeSeconds: number, gcdSeconds = 0.1) {
  const now = timelineNowSeconds.value
  castLockUntil.value = Math.max(castLockUntil.value, now + Math.max(0, castTimeSeconds))
  gcdLockUntil.value = Math.max(gcdLockUntil.value, now + Math.max(0, gcdSeconds))
}

function queueHitEvent(event: PendingHitEvent) {
  pendingHitEvents.value = [...pendingHitEvents.value, event].sort((a, b) => a.at - b.at)
}

function processPendingHitEvents() {
  if (pendingHitEvents.value.length === 0) return
  const now = timelineNowSeconds.value
  const due = pendingHitEvents.value.filter(event => event.at <= now + 1e-6)
  if (due.length === 0) return
  pendingHitEvents.value = pendingHitEvents.value.filter(event => event.at > now + 1e-6)
  for (const event of due) {
    if (event.damage > 0) applyDamageToSimulation(event.damage, event.label)
    if (event.hardCc > 0) addControlWindow('hard', event.hardCc)
    if (event.slowCc > 0) addControlWindow('slow', event.slowCc)
    if (event.hardCc > 0 || event.slowCc > 0) {
      recordTimelineEvent(
        `${event.label}: CC impact (hard ${formatDamageValue(event.hardCc)} / slow ${formatDamageValue(event.slowCc)})`
      )
    }
  }
}

function mergeTimeWindows(windows: TimeWindow[]): TimeWindow[] {
  if (windows.length <= 1) return windows
  const sorted = [...windows].sort((a, b) => a.start - b.start)
  const merged: TimeWindow[] = [sorted[0]!]
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index]!
    const last = merged[merged.length - 1]!
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end)
    } else {
      merged.push({ ...current })
    }
  }
  return merged
}

function addControlWindow(kind: 'hard' | 'slow', durationSeconds: number) {
  const duration = Math.max(0, Number(durationSeconds) || 0)
  if (duration <= 0) return
  const start = timelineNowSeconds.value
  const end = start + duration
  if (kind === 'hard') {
    hardControlWindows.value = mergeTimeWindows([...hardControlWindows.value, { start, end }])
  } else {
    slowControlWindows.value = mergeTimeWindows([...slowControlWindows.value, { start, end }])
  }
}

function totalWindowDuration(windows: TimeWindow[]): number {
  return windows.reduce((sum, window) => sum + Math.max(0, window.end - window.start), 0)
}

function useSpellDamage(spell: ResolvedSpellView) {
  if (spell.damageVsChampion == null && spell.controlDurationVsChampion == null) return
  const actionLock = actionLockRemaining()
  if (actionLock > 0.001) {
    recordTimelineEvent(
      `${displaySpellSlot(spell.slot)} ${spell.name} bloqué (${formatDamageValue(actionLock)}s)`
    )
    return
  }
  const remaining = spellRemainingCooldown(spell.id)
  if (remaining > 0.001) {
    recordTimelineEvent(
      `${displaySpellSlot(spell.slot)} ${spell.name} indisponible (${formatDamageValue(remaining)}s CD)`
    )
    return
  }
  const cost = Math.max(0, Number(spell.resourceCost ?? 0))
  if (cost > 0 && simulatedResource.value) {
    if (simulatedResource.value.current + 1e-6 < cost) {
      recordTimelineEvent(
        `${displaySpellSlot(spell.slot)} ${spell.name} impossible (coût ${formatDamageValue(cost)} ${simulatedResource.value.kind})`
      )
      return
    }
    simulatedResource.value.current = Math.max(0, simulatedResource.value.current - cost)
  }
  const slot = displaySpellSlot(spell.slot)
  const hardCc = Number(spell.hardControlDurationVsChampion ?? 0)
  const slowCc = Number(spell.slowDurationVsChampion ?? 0)
  const hitDelay = Math.max(0, Number(spell.hitDelaySeconds ?? 0))
  queueHitEvent({
    at: timelineNowSeconds.value + hitDelay,
    label: `${slot} ${spell.name}`,
    damage: Math.max(0, Number(spell.damageVsChampion ?? 0)),
    hardCc: Math.max(0, hardCc),
    slowCc: Math.max(0, slowCc),
  })
  recordTimelineEvent(`${slot} ${spell.name} cast (impact +${formatDamageValue(hitDelay)}s)`)
  const cooldown = Math.max(0, Number(spell.cooldownSeconds ?? 0))
  if (cooldown > 0) {
    spellReadyAt[spell.id] = timelineNowSeconds.value + cooldown
  }
  applyActionRecovery(0.25, 0.1)
  advanceTimeline(0.25)
}

function usePassiveDamage(passiveView: ResolvedPassiveView) {
  if (passiveView.damageVsChampion != null) {
    applyDamageToSimulation(passiveView.damageVsChampion, `P ${passiveView.name}`)
  }
  const hardCc = Number(passiveView.hardControlDurationVsChampion ?? 0)
  const slowCc = Number(passiveView.slowDurationVsChampion ?? 0)
  if (hardCc > 0 || slowCc > 0) {
    addControlWindow('hard', hardCc)
    addControlWindow('slow', slowCc)
  }
  if ((passiveView.controlDurationVsChampion ?? 0) > 0) {
    recordTimelineEvent(
      `P ${passiveView.name}: CC ${formatDamageValue(passiveView.controlDurationVsChampion ?? 0)}s (hard ${formatDamageValue(hardCc)} / slow ${formatDamageValue(slowCc)})`
    )
  }
  advanceTimeline()
}

function estimatedAutoAttackDamage(): number | null {
  const attacker = props.buildStats
  const defenderRaw = props.opponentRawStats
  if (!attacker || !defenderRaw) return null
  return reduceDamageByDefenses(attacker.totalAD, 'physical', defenderRaw)
}

function useAutoAttack() {
  const actionLock = actionLockRemaining()
  if (actionLock > 0.001) {
    recordTimelineEvent(`AA bloquée (${formatDamageValue(actionLock)}s)`)
    return
  }
  const remaining = autoRemainingCooldown()
  if (remaining > 0.001) {
    recordTimelineEvent(`AA indisponible (${formatDamageValue(remaining)}s)`)
    return
  }
  const damage = estimatedAutoAttackDamage()
  if (damage == null) return
  queueHitEvent({
    at: timelineNowSeconds.value + 0.1,
    label: 'AA',
    damage,
    hardCc: 0,
    slowCc: 0,
  })
  recordTimelineEvent('AA lancé (impact +0.1s)')
  autoReadyAt.value = timelineNowSeconds.value + autoAttackIntervalSeconds()
  applyActionRecovery(0.15, 0.1)
  advanceTimeline(0.15)
}

const effectiveTargetHp = computed(() => {
  const state = simulatedTarget.value
  if (!state) return 0
  return Math.max(0, state.hp + state.shield)
})

const activeHardCcRemaining = computed(() => {
  const now = timelineNowSeconds.value
  const active = hardControlWindows.value.find(window => now >= window.start && now < window.end)
  return active ? active.end - now : 0
})

const activeSlowRemaining = computed(() => {
  const now = timelineNowSeconds.value
  const active = slowControlWindows.value.find(window => now >= window.start && now < window.end)
  return active ? active.end - now : 0
})

watch([hardControlWindows, slowControlWindows], () => {
  simulatedControl.value = {
    hardCcSeconds: totalWindowDuration(hardControlWindows.value),
    slowSeconds: totalWindowDuration(slowControlWindows.value),
  }
})

function castsToKill(targetHp: number, perCastDamage: number | null | undefined): number | null {
  const damage = Number(perCastDamage ?? 0)
  if (!Number.isFinite(targetHp) || targetHp <= 0) return 0
  if (!Number.isFinite(damage) || damage <= 0) return null
  return Math.max(1, Math.ceil(targetHp / damage))
}

const autoAttackTiming = computed(() => {
  const hits = castsToKill(effectiveTargetHp.value, estimatedAutoAttackDamage())
  const secondsPerAttack = autoAttackIntervalSeconds()
  const timeToKill = hits == null ? null : Math.max(0, (hits - 1) * secondsPerAttack)
  return { hits, timeToKill }
})

function enqueueAutoAttack() {
  actionQueue.value.push({ type: 'aa', label: 'AA' })
}

function enqueueSpell(spell: ResolvedSpellView) {
  actionQueue.value.push({
    type: 'spell',
    spellId: spell.id,
    label: `${displaySpellSlot(spell.slot)} ${spell.name}`,
  })
}

function clearQueue() {
  actionQueue.value = []
}

function runQueuedActions() {
  let guard = 0
  while (actionQueue.value.length > 0 && guard < 200) {
    guard += 1
    const action = actionQueue.value[0]!
    const lock = actionLockRemaining()
    const aaCd = action.type === 'aa' ? autoRemainingCooldown() : 0
    const spellCd =
      action.type === 'spell' ? spellRemainingCooldown(String(action.spellId ?? '')) : 0
    const wait = Math.max(lock, aaCd, spellCd)
    if (wait > 0.001) {
      advanceTimeline(wait)
    }
    if (action.type === 'aa') {
      useAutoAttack()
      actionQueue.value.shift()
      continue
    }
    const spell = spells.value.find(entry => entry.id === action.spellId)
    if (!spell) {
      recordTimelineEvent(`Action ignorée: ${action.label}`)
      actionQueue.value.shift()
      continue
    }
    useSpellDamage(spell)
    actionQueue.value.shift()
  }
}

function resolveSpellCooldownSeconds(
  raw: TheorycraftSpellRuntimeData & Record<string, unknown>,
  rank: number
): number {
  const maxRank = Math.max(1, Number(raw.maxRank ?? 5))
  const rankIndex = Math.min(Math.max(rank, 1), maxRank) - 1
  const cdEntry = (raw.dataValues ?? []).find(entry =>
    /cooldown|cd|recasttime|chargetime/i.test(String(entry.name ?? ''))
  )
  if (cdEntry) {
    const value = Number(cdEntry.values?.[rankIndex] ?? cdEntry.values?.[0] ?? 0)
    if (Number.isFinite(value) && value > 0) return value
  }
  const cdCalc = (raw.calculations ?? []).find(calc => /cooldown|cd/i.test(String(calc.key ?? '')))
  if (cdCalc) {
    const value = Number(cdCalc.baseValues?.[rankIndex] ?? cdCalc.baseValues?.[0] ?? 0)
    if (Number.isFinite(value) && value > 0) return value
  }
  return 0
}

function resolveSpellResourceCost(
  raw: TheorycraftSpellRuntimeData & Record<string, unknown>,
  rank: number
): number {
  const maxRank = Math.max(1, Number(raw.maxRank ?? 5))
  const rankIndex = Math.min(Math.max(rank, 1), maxRank) - 1
  const costEntry = (raw.dataValues ?? []).find(entry =>
    /cost|manacost|energycost|resourcecost/i.test(String(entry.name ?? ''))
  )
  if (costEntry) {
    const value = Number(costEntry.values?.[rankIndex] ?? costEntry.values?.[0] ?? 0)
    if (Number.isFinite(value) && value > 0) return value
  }
  const costCalc = (raw.calculations ?? []).find(calc => /cost|manacost|energycost/i.test(calc.key))
  if (costCalc) {
    const value = Number(costCalc.baseValues?.[rankIndex] ?? costCalc.baseValues?.[0] ?? 0)
    if (Number.isFinite(value) && value > 0) return value
  }
  return 0
}

function resolveSpellHitDelaySeconds(
  raw: TheorycraftSpellRuntimeData & Record<string, unknown>,
  rank: number
): number {
  const maxRank = Math.max(1, Number(raw.maxRank ?? 5))
  const rankIndex = Math.min(Math.max(rank, 1), maxRank) - 1
  const delayEntry = (raw.dataValues ?? []).find(entry =>
    /delay|casttime|traveltime|missile|impacttime/i.test(String(entry.name ?? ''))
  )
  if (delayEntry) {
    const value = Number(delayEntry.values?.[rankIndex] ?? delayEntry.values?.[0] ?? 0)
    if (Number.isFinite(value) && value >= 0 && value <= 3) return value
  }
  const slot = String(raw.slot ?? '')
    .trim()
    .toUpperCase()
  if (slot === 'R') return 0.2
  return 0.1
}

function isDamageCalculationKey(key: string): boolean {
  const normalized = key.toLowerCase()
  if (/shield|heal|mana|cost|cooldown|cdr|speed|slow|buff|bonus|resist|armor|mr/.test(normalized)) {
    return false
  }
  return /damage|dmg|execute|detonate|impact|blast|burn|bleed|onhit|proc/.test(normalized)
}

type DamageType = 'physical' | 'magic' | 'true'

function normalizeDamageType(value: unknown): DamageType | null {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
  if (normalized === 'physical' || normalized === 'magic' || normalized === 'true')
    return normalized
  return null
}

function inferFormulaBaseDamageType(
  formula: TheorycraftSpellCalculation,
  raw: TheorycraftSpellRuntimeData & Record<string, unknown>
): DamageType {
  const ratioTypes = (formula.ratios ?? [])
    .map((ratio: { type?: unknown }) => normalizeDamageType(ratio.type))
    .filter((ratioType): ratioType is DamageType => Boolean(ratioType))
  if (
    ratioTypes.length > 0 &&
    ratioTypes.every((ratioType: DamageType) => ratioType === ratioTypes[0])
  ) {
    return ratioTypes[0]!
  }

  const haystack = `${String(formula.key ?? '')} ${String(raw.tooltipRaw ?? '')}`.toLowerCase()
  if (/truedamage|true damage|dégâts bruts|degats bruts/.test(haystack)) return 'true'
  if (/magicdamage|magic damage|dégâts magiques|degats magiques/.test(haystack)) return 'magic'
  return 'physical'
}

function reduceDamageByDefenses(
  rawDamage: number,
  damageType: 'physical' | 'magic' | 'true',
  target: { armor?: number; magicResist?: number; damageReduction?: number }
): number {
  const safeRaw = Math.max(0, rawDamage)
  if (!Number.isFinite(safeRaw) || safeRaw <= 0) return 0
  let mitigated = safeRaw
  if (damageType === 'physical') {
    const armor = Number(target.armor ?? 0)
    mitigated = armor >= 0 ? safeRaw * (100 / (100 + armor)) : safeRaw * (2 - 100 / (100 - armor))
  } else if (damageType === 'magic') {
    const mr = Number(target.magicResist ?? 0)
    mitigated = mr >= 0 ? safeRaw * (100 / (100 + mr)) : safeRaw * (2 - 100 / (100 - mr))
  }
  const dr = Number(target.damageReduction ?? 0)
  const clampedDr = Math.min(Math.max(dr, 0), 0.95)
  mitigated *= 1 - clampedDr
  return Math.max(0, mitigated)
}

function formatDamageValue(value: number): string {
  const rounded = Math.round(value * 10) / 10
  if (!Number.isFinite(rounded)) return '0'
  if (Number.isInteger(rounded)) return String(rounded)
  return String(rounded)
}

function ratioCoefficientAtRank(coefficient: number[] | number, rankIndex: number): number {
  if (Array.isArray(coefficient)) {
    if (coefficient.length === 0) return 0
    const value = coefficient[Math.min(Math.max(rankIndex, 0), coefficient.length - 1)]
    return Number.isFinite(value ?? NaN) ? Number(value) : 0
  }
  return Number.isFinite(coefficient) ? coefficient : 0
}

function ratioStatValueForVsDamage(
  stat: string,
  attacker: TheorycraftBuildStats,
  defender: TheorycraftBuildStats
): number {
  const normalized = String(stat ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  const fromAttacker: Record<string, number> = {
    totalad: attacker.totalAD,
    bonusad: attacker.bonusAD,
    attackdamage: attacker.totalAD,
    ap: attacker.AP,
    abilitypower: attacker.AP,
    totalhp: attacker.totalHP,
    bonushp: attacker.bonusHP,
    bonushealth: attacker.bonusHP,
    armor: attacker.armor,
    magicresist: attacker.magicResist,
    maxmana: attacker.maxMana,
    mana: attacker.maxMana,
  }

  const fromDefender: Record<string, number> = {
    targetmaxhealth: defender.totalHP,
    targethealth: defender.totalHP,
    enemytotalhp: defender.totalHP,
    enemymxhp: defender.totalHP,
    maxhealth: defender.totalHP,
    maxhp: defender.totalHP,
  }

  if (normalized in fromDefender) return Number(fromDefender[normalized] ?? 0)
  if (normalized in fromAttacker) return Number(fromAttacker[normalized] ?? 0)
  return 0
}

function computeDamageVsChampion(
  raw: TheorycraftSpellRuntimeData & Record<string, unknown>,
  rank: number
): { damage: number; lethal: boolean; tooltip: string } | null {
  const attacker = props.buildStats
  const defender = props.opponentBuildStats
  const defenderRaw = props.opponentRawStats
  if (!attacker || !defender || !defenderRaw) return null
  const maxRank = Math.max(1, Number(raw.maxRank ?? 5))
  const formulas = (raw.calculations ?? []).filter(entry =>
    isDamageCalculationKey(String(entry.key ?? ''))
  )
  if (formulas.length === 0) return null

  const rankIndex = Math.min(Math.max(rank, 1), maxRank) - 1
  const breakdownLines: string[] = []
  const totalMitigated = formulas.reduce((sum, formula) => {
    const base = Math.max(0, Number(formula.baseValues?.[rankIndex] ?? 0))
    const baseType = inferFormulaBaseDamageType(formula, raw)
    const components: Record<DamageType, number> = {
      physical: baseType === 'physical' ? base : 0,
      magic: baseType === 'magic' ? base : 0,
      true: baseType === 'true' ? base : 0,
    }

    for (const ratio of formula.ratios ?? []) {
      const coeff = ratioCoefficientAtRank(ratio.coefficient, rankIndex)
      const statValue = ratioStatValueForVsDamage(String(ratio.stat ?? ''), attacker, defender)
      const ratioType = normalizeDamageType((ratio as { type?: unknown }).type) ?? baseType
      components[ratioType] += Math.max(0, coeff * statValue)
    }

    const physicalMitigated = reduceDamageByDefenses(components.physical, 'physical', defenderRaw)
    const magicMitigated = reduceDamageByDefenses(components.magic, 'magic', defenderRaw)
    const trueMitigated = reduceDamageByDefenses(components.true, 'true', defenderRaw)
    const exact = components.physical + components.magic + components.true
    const mitigated = physicalMitigated + magicMitigated + trueMitigated
    const ratioPart = exact - base
    breakdownLines.push(
      `${formula.key}: ${formatDamageValue(base)} + ${formatDamageValue(ratioPart)} = ${formatDamageValue(exact)} brut -> ${formatDamageValue(mitigated)} mitigé (P:${formatDamageValue(physicalMitigated)} M:${formatDamageValue(magicMitigated)} T:${formatDamageValue(trueMitigated)})`
    )
    return sum + mitigated
  }, 0)

  const targetShield = Number(defenderRaw.shield ?? 0)
  const targetHp = Number(defender.totalHP ?? 0)
  const currentEffectiveTargetHp = Math.max(
    0,
    effectiveTargetHp.value || targetHp + Math.max(0, targetShield)
  )
  const lethal = currentEffectiveTargetHp > 0 && totalMitigated >= currentEffectiveTargetHp
  breakdownLines.push(
    `Total: ${formatDamageValue(totalMitigated)} | Cible: ${formatDamageValue(targetHp)} PV + ${formatDamageValue(Math.max(0, targetShield))} bouclier`
  )
  return { damage: totalMitigated, lethal, tooltip: breakdownLines.join('\n') }
}

type ControlKind = 'hard' | 'airborne' | 'slow'

function detectControlKind(name: string): ControlKind | null {
  const normalized = name.toLowerCase()
  if (/airborne|knockup|knockback|pull|launch/.test(normalized)) return 'airborne'
  if (/slow/.test(normalized)) return 'slow'
  if (
    /stun|snare|root|taunt|fear|charm|sleep|silence|suppress|suppression|stasis|cc/.test(normalized)
  ) {
    return 'hard'
  }
  return null
}

function computeControlVsChampion(
  raw: TheorycraftSpellRuntimeData & Record<string, unknown>,
  rank: number
): { duration: number; hardDuration: number; slowDuration: number; tooltip: string } | null {
  const defender = props.opponentBuildStats
  if (!defender) return null
  const defenderRaw = props.opponentRawStats
  const maxRank = Math.max(1, Number(raw.maxRank ?? 5))
  const rankIndex = Math.min(Math.max(rank, 1), maxRank) - 1
  const tenacity = Math.min(Math.max(Number(defenderRaw?.tenacity ?? 0), 0), 0.95)
  const entries: Array<{ label: string; duration: number; kind: ControlKind }> = []

  for (const entry of raw.dataValues ?? []) {
    const name = String(entry.name ?? '')
    const kind = detectControlKind(name)
    if (!kind) continue
    const lowered = name.toLowerCase()
    if (!/duration|time|seconds|sec|slow/.test(lowered)) continue
    const value = Number(entry.values?.[rankIndex] ?? entry.values?.[0] ?? 0)
    if (!Number.isFinite(value) || value <= 0) continue
    entries.push({
      label: name,
      duration: kind === 'airborne' ? value : value * (1 - tenacity),
      kind,
    })
  }

  for (const calculation of raw.calculations ?? []) {
    const kind = detectControlKind(calculation.key)
    if (!kind) continue
    const lowered = calculation.key.toLowerCase()
    if (!/duration|time|seconds|sec|slow/.test(lowered)) continue
    const value = Number(calculation.baseValues?.[rankIndex] ?? calculation.baseValues?.[0] ?? 0)
    if (!Number.isFinite(value) || value <= 0) continue
    entries.push({
      label: calculation.key,
      duration: kind === 'airborne' ? value : value * (1 - tenacity),
      kind,
    })
  }

  if (entries.length === 0) return null
  const total = entries.reduce((sum, entry) => sum + entry.duration, 0)
  const hardDuration = entries
    .filter(entry => entry.kind === 'hard' || entry.kind === 'airborne')
    .reduce((sum, entry) => sum + entry.duration, 0)
  const slowDuration = entries
    .filter(entry => entry.kind === 'slow')
    .reduce((sum, entry) => sum + entry.duration, 0)
  const lines = entries.map(
    entry => `${entry.label}: ${formatDamageValue(entry.duration)}s (${entry.kind})`
  )
  return { duration: total, hardDuration, slowDuration, tooltip: lines.join('\n') }
}

function annotateExecuteThresholdWithHp(
  html: string,
  targetMaxHp: number | null | undefined
): string {
  if (!html) return html
  if (!Number.isFinite(targetMaxHp) || (targetMaxHp ?? 0) <= 0) return html
  return html.replace(
    /(\d+(?:[.,]\d+)?)%\s*(de ses PV|de sa vie|max health|maximum health)(?!\s*\()/gi,
    (_match, percentRaw: string, suffix: string) => {
      const pct = Number(String(percentRaw).replace(',', '.'))
      if (!Number.isFinite(pct)) return `${percentRaw}% ${suffix}`
      const hpValue = Math.round((targetMaxHp! * pct) / 100)
      return `${percentRaw}% (${hpValue} PV) ${suffix}`
    }
  )
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
  const damageVs = computeDamageVsChampion(raw, rank)
  const controlVs = computeControlVsChampion(raw, rank)
  const targetMaxHp = Number(props.opponentBuildStats?.totalHP ?? NaN)
  const summaryHtml = finalized.summaryHtml
    ? annotateExecuteThresholdWithHp(finalized.summaryHtml, targetMaxHp)
    : undefined
  const descriptionHtml = annotateExecuteThresholdWithHp(finalized.descriptionHtml, targetMaxHp)
  const detailedTexts = (finalized.detailedTexts ?? []).map(section =>
    annotateExecuteThresholdWithHp(section, targetMaxHp)
  )

  return {
    name: String(raw.name ?? ''),
    maxRank: Math.max(1, Number(raw.maxRank ?? 5)),
    summaryHtml,
    showSummary: finalized.showSummary,
    descriptionHtml,
    detailedTexts,
    headerStats: Array.isArray(raw.headerStats)
      ? raw.headerStats.map((stat: SpellHeaderStat) =>
          resolveHeaderStatAtRank(stat, rank, {
            cooldownReduction: props.buildStats?.cooldownReduction ?? 0,
          })
        )
      : [],
    isDynamic: resolved.isDynamic,
    hasActivatableBuff: spellHasActivatableBuff(raw),
    damageVsChampion: damageVs?.damage ?? null,
    lethalVsChampion: damageVs?.lethal ?? false,
    damageVsTooltip: damageVs?.tooltip ?? '',
    controlDurationVsChampion: controlVs?.duration ?? null,
    hardControlDurationVsChampion: controlVs?.hardDuration ?? null,
    slowDurationVsChampion: controlVs?.slowDuration ?? null,
    controlVsTooltip: controlVs?.tooltip ?? '',
    cooldownSeconds: resolveSpellCooldownSeconds(raw, rank),
    resourceCost: resolveSpellResourceCost(raw, rank),
    hitDelaySeconds: resolveSpellHitDelaySeconds(raw, rank),
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

watch(
  () =>
    [props.opponentBuildStats?.totalHP, props.opponentRawStats?.shield, props.championId] as const,
  () => {
    resetSimulation()
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
    damageVsChampion: resolved.damageVsChampion,
    lethalVsChampion: resolved.lethalVsChampion,
    damageVsTooltip: resolved.damageVsTooltip,
    controlDurationVsChampion: resolved.controlDurationVsChampion,
    hardControlDurationVsChampion: resolved.hardControlDurationVsChampion,
    slowDurationVsChampion: resolved.slowDurationVsChampion,
    controlVsTooltip: resolved.controlVsTooltip,
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
      ...resolved,
    }
  })
})

const killHints = computed(() => {
  const hints: string[] = []
  const hp = effectiveTargetHp.value
  if (!Number.isFinite(hp) || hp <= 0) {
    hints.push('La cible est déjà éliminée.')
    return hints
  }

  const aaHits = autoAttackTiming.value.hits
  if (aaHits != null) {
    const seconds = autoAttackTiming.value.timeToKill ?? 0
    hints.push(`AA: ${aaHits} coups pour tuer (~${formatDamageValue(seconds)}s).`)
  } else {
    hints.push('AA: dégâts insuffisants pour estimer le kill.')
  }

  const topSpells = spells.value
    .filter(spell => (spell.damageVsChampion ?? 0) > 0)
    .sort((a, b) => Number(b.damageVsChampion ?? 0) - Number(a.damageVsChampion ?? 0))
    .slice(0, 4)
  for (const spell of topSpells) {
    const count = castsToKill(hp, spell.damageVsChampion)
    if (count == null) continue
    const slot = displaySpellSlot(spell.slot)
    hints.push(`${slot} ${spell.name}: ${count} casts pour tuer la cible.`)
  }

  if (hints.length === 1 && topSpells.length === 0) {
    hints.push('Aucun sort avec dégâts calculables pour cette cible.')
  }
  return hints
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

.spell-vs-damage-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  border: 1px solid rgb(200 155 60 / 0.55);
  border-radius: 0.35rem;
  background: rgb(200 155 60 / 0.12);
  color: rgb(255 231 163 / 0.95);
  padding: 0.05rem 0.35rem;
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1.2;
}

.spell-vs-damage-badge--lethal {
  border-color: rgb(248 113 113 / 0.7);
  background: rgb(127 29 29 / 0.25);
  color: rgb(254 202 202 / 0.98);
}

.spell-vs-damage-info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 999px;
  border: 1px solid rgb(255 255 255 / 0.35);
  font-size: 0.58rem;
  font-weight: 700;
  line-height: 1;
  color: rgb(255 255 255 / 0.9);
  cursor: help;
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
