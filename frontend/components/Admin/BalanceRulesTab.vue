<template>
  <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
    <h2 class="mb-3 text-lg font-semibold text-text">{{ t('gestion.balance.title') }}</h2>
    <p class="mb-3 text-xs text-text/70">{{ t('gestion.balance.description') }}</p>
    <p v-if="loading" class="text-text/70">{{ t('gestion.balance.loading') }}</p>
    <div v-else class="space-y-4">
      <div v-for="row in rows" :key="row.level" :class="['grid gap-3', row.cols]">
        <label v-for="key in row.fields" :key="key" class="text-xs text-text/80">
          {{ t(`gestion.balance.fields.${key}`) }}
          <input
            v-model.number="form[key]"
            type="number"
            step="0.1"
            class="mt-1 w-full rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
          />
        </label>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          :disabled="saving"
          @click="save"
        >
          {{ saving ? '…' : t('gestion.balance.save') }}
        </button>
        <button
          type="button"
          class="rounded border border-primary/40 bg-chrome px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-primary/20"
          @click="load"
        >
          {{ t('gestion.balance.reload') }}
        </button>
      </div>
      <p
        v-if="message"
        :class="message.error ? 'text-sm text-error' : 'text-sm text-green-600 dark:text-green-400'"
      >
        {{ message.text }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAdminAuth } from '~/composables/useAdminAuth'
import { apiUrl } from '~/utils/apiUrl'
import {
  DEFAULT_BALANCE_RULES_FORM,
  balanceRulesPayload,
  parseBalanceRulesForm,
  type BalanceRulesForm,
} from '~/utils/balanceRules'

const { t } = useI18n()
const { fetchWithAuth } = useAdminAuth()

const rows: { level: string; cols: string; fields: (keyof BalanceRulesForm)[] }[] = [
  {
    level: 'average',
    cols: 'md:grid-cols-4',
    fields: [
      'averageWinrateHigh',
      'averageWinrateLow',
      'averageBanrateMultiplier',
      'averageWinrateMax',
    ],
  },
  {
    level: 'skilled',
    cols: 'md:grid-cols-4',
    fields: [
      'skilledWinrateHigh',
      'skilledWinrateLow',
      'skilledBanrateMultiplier',
      'skilledWinrateMax',
    ],
  },
  {
    level: 'elite',
    cols: 'md:grid-cols-5',
    fields: [
      'eliteWinrateHigh',
      'eliteWinrateLow',
      'eliteBanrateMultiplier',
      'eliteBanrateTwoPatchAvgMin',
      'elitePresenceMax',
    ],
  },
]

const loading = ref(true)
const saving = ref(false)
const form = ref<BalanceRulesForm>({ ...DEFAULT_BALANCE_RULES_FORM })
const message = ref<{ text: string; error: boolean } | null>(null)

async function load() {
  loading.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/balance-rules'))
    if (!res.ok) throw new Error('load')
    const data: { rules?: unknown } = await res.json()
    form.value = parseBalanceRulesForm(data.rules)
  } catch {
    message.value = { text: t('gestion.balance.loadError'), error: true }
  } finally {
    loading.value = false
  }
}

async function save() {
  message.value = null
  saving.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/balance-rules'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: balanceRulesPayload(form.value) }),
    })
    const data: { rules?: unknown; error?: string } = await res.json()
    if (!res.ok) {
      message.value = { text: data.error ?? t('gestion.balance.saveError'), error: true }
      return
    }
    form.value = parseBalanceRulesForm(data.rules)
    message.value = { text: t('gestion.balance.saved'), error: false }
  } catch {
    message.value = { text: t('gestion.balance.saveError'), error: true }
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
