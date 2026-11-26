<template>
  <section class="rounded-lg border border-primary/30 bg-surface/40 p-5">
    <h2 class="mb-4 text-lg font-semibold">{{ t('gestion.data.title') }}</h2>
    <p v-if="loading" class="text-sm text-text/70">{{ t('gestion.data.loading') }}</p>
    <template v-else>
      <p class="mb-4 rounded border border-accent/60 px-3 py-2 text-sm" role="note">
        {{ hasPending ? t('gestion.data.pendingNote') : t('gestion.data.scheduleNote') }}
      </p>
      <h3 class="mb-1 font-semibold">{{ t('gestion.data.regions') }}</h3>
      <p class="mb-3 text-xs text-text/70">{{ t('gestion.data.clusterNote') }}</p>
      <div class="mb-6 grid gap-3 sm:grid-cols-2">
        <fieldset
          v-for="group in clusters"
          :key="group.cluster"
          class="rounded border border-primary/30 p-3"
        >
          <legend class="px-1 text-sm font-semibold uppercase">{{ group.cluster }}</legend>
          <label
            v-for="p in group.platforms"
            :key="p"
            class="mb-1 mr-4 inline-flex items-start gap-1 text-sm"
          >
            <input v-model="platforms" type="checkbox" class="mt-1" :value="p" :disabled="busy" />
            <span class="flex flex-col leading-tight">
              {{ p.toUpperCase() }}
              <span class="text-xs text-text/70">{{ platformName(p) }}</span>
            </span>
          </label>
        </fieldset>
      </div>

      <h3 class="mb-1 font-semibold">{{ t('gestion.data.tiers') }}</h3>
      <div
        class="mb-2 inline-flex rounded border border-primary/40 text-sm"
        role="group"
        :aria-label="t('gestion.data.weightsMode')"
      >
        <button
          v-for="m in modes"
          :key="m"
          type="button"
          class="px-3 py-1"
          :class="mode === m ? 'bg-accent/20 font-semibold' : 'hover:bg-surface'"
          :aria-pressed="mode === m"
          :disabled="busy"
          @click="setMode(m)"
        >
          {{ m === 'all' ? t('gestion.data.modeAll') : t('gestion.data.modeByRegion') }}
        </button>
      </div>
      <template v-if="mode === 'byRegion'">
        <p class="mb-2 text-xs text-text/70">{{ t('gestion.data.modeByRegionNote') }}</p>
        <div class="mb-2 flex flex-wrap gap-1" role="tablist">
          <button
            v-for="c in activeClusters"
            :key="c"
            type="button"
            role="tab"
            class="rounded border px-2 py-0.5 text-xs uppercase"
            :class="editedRegion === c ? 'border-accent bg-accent/20' : 'border-primary/40'"
            :aria-selected="editedRegion === c"
            @click="editedRegion = c"
          >
            {{ c }}
          </button>
        </div>
      </template>
      <p class="mb-3 text-xs text-text/70">
        {{ t('gestion.data.tiersNote', { total: total.toFixed(1) }) }}
      </p>
      <div class="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <label v-for="tier in tiers" :key="tier" class="flex flex-col text-xs">
          {{ tier }}
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            class="rounded border border-primary/40 bg-background px-2 py-1 text-sm"
            :value="shownWeights[tier] ?? 0"
            :disabled="busy"
            @change="onWeight(tier, $event)"
          />
        </label>
      </div>

      <p
        v-if="message"
        class="mb-3 rounded border px-3 py-2 text-sm"
        :class="message.error ? 'border-error text-error' : 'border-accent/60'"
        role="status"
      >
        {{ message.text }}
      </p>
      <button
        type="button"
        class="rounded border border-accent px-4 py-2 text-sm font-semibold hover:bg-surface disabled:opacity-50"
        :disabled="busy || !canSave"
        @click="save"
      >
        {{ t('gestion.data.save') }}
      </button>
    </template>
  </section>
</template>

<script setup lang="ts">
import { useUserSession } from '~/composables/useUserSession'
import {
  initRegionWeights,
  rebalanceWeights,
  selectedClusters,
  settingsBody,
  weightsTotal,
  type Weights,
  type WeightsMode,
} from '~/utils/pollerWeights'

interface Choice {
  platform: string
  cluster: string
}

const { t, te } = useI18n()
const { authFetch } = useUserSession()

const loading = ref(true)
const busy = ref(false)
const choices = ref<Choice[]>([])
const tiers = ref<string[]>([])
const platforms = ref<string[]>([])
const weights = ref<Weights>({})
const message = ref<{ text: string; error: boolean } | null>(null)
const hasPending = ref(false)
const modes: readonly WeightsMode[] = ['all', 'byRegion']
const mode = ref<WeightsMode>('all')
const regionWeights = ref<Record<string, Weights>>({})
const editedRegion = ref('')

// Régions de limite (europe, americas, asia, sea) des plateformes cochées.
const activeClusters = computed(() => selectedClusters(choices.value, platforms.value))
// Région éditée toujours parmi les régions de limite cochées ; nouvelle région = poids globaux.
watch(activeClusters, list => {
  regionWeights.value = initRegionWeights(list, weights.value, regionWeights.value)
  if (!list.includes(editedRegion.value)) editedRegion.value = list[0] ?? ''
})

const platformName = (p: string) =>
  te(`gestion.data.platformNames.${p}`) ? t(`gestion.data.platformNames.${p}`) : ''

const shownWeights = computed<Weights>(() =>
  mode.value === 'byRegion'
    ? (regionWeights.value[editedRegion.value] ?? weights.value)
    : weights.value
)
const total = computed(() => weightsTotal(shownWeights.value))
// Par région : chaque région cochée doit avoir un total > 0.
const canSave = computed(
  () =>
    platforms.value.length > 0 &&
    (mode.value === 'all'
      ? weightsTotal(weights.value) > 0
      : activeClusters.value.every(c => weightsTotal(regionWeights.value[c] ?? weights.value) > 0))
)
const clusters = computed(() => {
  const map = new Map<string, string[]>()
  for (const c of choices.value) map.set(c.cluster, [...(map.get(c.cluster) ?? []), c.platform])
  return [...map].map(([cluster, list]) => ({ cluster, platforms: list }))
})

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

function onWeight(tier: string, event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  if (mode.value === 'byRegion' && editedRegion.value) {
    const next = rebalanceWeights(shownWeights.value, tier, Number(input.value))
    regionWeights.value = { ...regionWeights.value, [editedRegion.value]: next }
    input.value = String(next[tier])
    return
  }
  weights.value = rebalanceWeights(weights.value, tier, Number(input.value))
  input.value = String(weights.value[tier])
}

function setMode(m: WeightsMode) {
  if (m === 'byRegion')
    regionWeights.value = initRegionWeights(
      activeClusters.value,
      weights.value,
      regionWeights.value
    )
  mode.value = m
}

function toWeights(raw: unknown): Weights {
  const rec = isRecord(raw) ? raw : {}
  return Object.fromEntries(
    tiers.value.map(tier => {
      const v = rec[tier]
      return [tier, typeof v === 'number' ? v : 0]
    })
  )
}

async function load() {
  loading.value = true
  try {
    const res = await authFetch('/api/admin/poller-settings')
    const body: unknown = await res.json()
    if (!res.ok || !isRecord(body) || !isRecord(body.settings)) throw new Error('invalid settings')
    choices.value = Array.isArray(body.choices)
      ? body.choices.flatMap(c =>
          isRecord(c) && typeof c.platform === 'string' && typeof c.cluster === 'string'
            ? [{ platform: c.platform, cluster: c.cluster }]
            : []
        )
      : []
    tiers.value = strings(body.tiers)
    // Le formulaire montre les réglages programmés pour 00 h s'il y en a, sinon les actifs.
    const shown = isRecord(body.pending) ? body.pending : body.settings
    hasPending.value = isRecord(body.pending)
    platforms.value = strings(shown.platforms)
    weights.value = toWeights(shown.tierWeights)
    const byRegion = isRecord(shown.tierWeightsByRegion) ? shown.tierWeightsByRegion : null
    mode.value = byRegion ? 'byRegion' : 'all'
    regionWeights.value = initRegionWeights(
      activeClusters.value,
      weights.value,
      Object.fromEntries(Object.entries(byRegion ?? {}).map(([c, w]) => [c, toWeights(w)]))
    )
    editedRegion.value = activeClusters.value[0] ?? ''
  } catch {
    message.value = { text: t('gestion.data.loadError'), error: true }
  } finally {
    loading.value = false
  }
}

async function save() {
  busy.value = true
  message.value = null
  try {
    const put = await authFetch('/api/admin/poller-settings', {
      method: 'PUT',
      body: JSON.stringify(
        settingsBody(
          platforms.value,
          activeClusters.value,
          weights.value,
          mode.value,
          regionWeights.value
        )
      ),
    })
    if (!put.ok) throw new Error('invalid')
    hasPending.value = true
    message.value = { text: t('gestion.data.saved'), error: false }
  } catch {
    message.value = { text: t('gestion.data.saveError'), error: true }
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>
