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
            class="mr-4 inline-flex items-center gap-1 text-sm"
          >
            <input v-model="platforms" type="checkbox" :value="p" :disabled="busy" />
            {{ p.toUpperCase() }}
          </label>
        </fieldset>
      </div>

      <h3 class="mb-1 font-semibold">{{ t('gestion.data.tiers') }}</h3>
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
            :value="weights[tier] ?? 0"
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
        :disabled="busy || platforms.length === 0 || total <= 0"
        @click="save"
      >
        {{ t('gestion.data.save') }}
      </button>
    </template>
  </section>
</template>

<script setup lang="ts">
import { useUserSession } from '~/composables/useUserSession'
import { rebalanceWeights, weightsTotal, type Weights } from '~/utils/pollerWeights'

interface Choice {
  platform: string
  cluster: string
}

const { t } = useI18n()
const { authFetch } = useUserSession()

const loading = ref(true)
const busy = ref(false)
const choices = ref<Choice[]>([])
const tiers = ref<string[]>([])
const platforms = ref<string[]>([])
const weights = ref<Weights>({})
const message = ref<{ text: string; error: boolean } | null>(null)
const hasPending = ref(false)

const total = computed(() => weightsTotal(weights.value))
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
  weights.value = rebalanceWeights(weights.value, tier, Number(input.value))
  input.value = String(weights.value[tier])
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
    const raw = isRecord(shown.tierWeights) ? shown.tierWeights : {}
    weights.value = Object.fromEntries(
      tiers.value.map(tier => [tier, typeof raw[tier] === 'number' ? raw[tier] : 0])
    )
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
      body: JSON.stringify({ platforms: platforms.value, tierWeights: weights.value }),
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
