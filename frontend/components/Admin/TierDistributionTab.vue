<template>
  <section class="rounded-lg border border-primary/30 bg-surface/40 p-5">
    <h2 class="mb-2 text-lg font-semibold">{{ t('gestion.tierDistribution.title') }}</h2>
    <p class="mb-4 text-sm text-text/70">{{ t('gestion.tierDistribution.description') }}</p>
    <p v-if="loading" class="text-sm text-text/70">{{ t('gestion.tierDistribution.loading') }}</p>
    <template v-else>
      <p class="mb-4 rounded border border-accent/60 px-3 py-2 text-sm" role="note">
        {{ t('gestion.tierDistribution.help') }}
      </p>
      <div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label
          v-for="field in TIER_DISTRIBUTION_FIELDS"
          :key="field"
          class="flex flex-col gap-1 text-sm"
        >
          {{ t(`gestion.tierDistribution.fields.${field}`) }}
          <input
            v-model.number="settings[field]"
            type="number"
            min="0"
            :step="field === 'extremeMax' ? 1 : 5"
            class="rounded border border-primary/30 bg-background px-2 py-1"
            :disabled="busy"
          />
          <span class="text-xs text-text/70">{{
            t(`gestion.tierDistribution.notes.${field}`)
          }}</span>
        </label>
      </div>
      <p v-if="!valid" class="mb-3 text-sm text-error" role="alert">
        {{ t('gestion.tierDistribution.invalid') }}
      </p>
      <p
        v-if="message"
        class="mb-3 rounded border px-3 py-2 text-sm"
        :class="message.error ? 'border-error text-error' : 'border-accent/60'"
        role="status"
      >
        {{ message.text }}
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded border border-accent px-4 py-2 text-sm font-semibold hover:bg-surface disabled:opacity-50"
          :disabled="busy || !valid"
          @click="save"
        >
          {{ t('gestion.tierDistribution.save') }}
        </button>
        <button
          type="button"
          class="rounded border border-primary/30 px-4 py-2 text-sm hover:bg-surface disabled:opacity-50"
          :disabled="busy"
          @click="resetDefaults"
        >
          {{ t('gestion.tierDistribution.defaults') }}
        </button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { useAdminAuth } from '~/composables/useAdminAuth'
import { apiUrl } from '~/utils/apiUrl'
import {
  DEFAULT_TIER_DISTRIBUTION,
  TIER_DISTRIBUTION_FIELDS,
  parseTierDistribution,
  tierDistributionValid,
  type TierDistribution,
} from '~/utils/tierDistribution'

const { t } = useI18n()
const { fetchWithAuth } = useAdminAuth()

const loading = ref(true)
const busy = ref(false)
const settings = ref<TierDistribution>({ ...DEFAULT_TIER_DISTRIBUTION })
const message = ref<{ text: string; error: boolean } | null>(null)
const valid = computed(() => tierDistributionValid(settings.value))

async function load() {
  loading.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/tier-distribution'))
    if (!res.ok) throw new Error('load')
    settings.value = parseTierDistribution(await res.json())
  } catch {
    message.value = { text: t('gestion.tierDistribution.loadError'), error: true }
  } finally {
    loading.value = false
  }
}

function resetDefaults() {
  settings.value = { ...DEFAULT_TIER_DISTRIBUTION }
  message.value = null
}

async function save() {
  busy.value = true
  message.value = null
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/tier-distribution'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings.value),
    })
    if (!res.ok) throw new Error('save')
    settings.value = parseTierDistribution(await res.json())
    message.value = { text: t('gestion.tierDistribution.saved'), error: false }
  } catch {
    message.value = { text: t('gestion.tierDistribution.saveError'), error: true }
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>
