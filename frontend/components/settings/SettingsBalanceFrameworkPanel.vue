<template>
  <section class="space-y-4">
    <div class="space-y-1">
      <h2 class="text-sm font-semibold text-text">
        {{ t('statisticsPage.settingsBalanceRulesTitle') }}
      </h2>
      <p class="max-w-3xl text-xs text-text/60">
        {{ t('statisticsPage.settingsBalanceRulesReadOnly') }}
      </p>
    </div>

    <div v-if="pending" class="text-sm text-text/70">
      {{ t('statisticsPage.loading') }}
    </div>
    <div v-else-if="error" class="rounded border border-error/50 p-3 text-sm text-error">
      {{ t('statisticsPage.settingsBalanceRulesLoadError') }}
    </div>
    <div v-else-if="rules" class="grid gap-2 md:grid-cols-3">
      <article
        v-for="level in levelCards"
        :key="level.key"
        class="ui-build-card-surface space-y-2 rounded-lg p-2.5"
      >
        <h3 class="text-xs font-semibold uppercase tracking-wide text-accent">
          {{ level.label }}
        </h3>
        <p class="text-[10px] leading-snug text-text/60">
          <span class="font-medium text-text/75">
            {{ t('statisticsPage.settingsBalanceTiersLabel') }} :
          </span>
          {{ level.tiers.join(', ') }}
        </p>
        <dl class="space-y-1.5">
          <div
            v-for="field in level.fields"
            :key="level.key + '-' + field.key"
            class="flex items-baseline justify-between gap-2 text-[11px]"
          >
            <dt class="min-w-0 text-text/65">{{ field.label }}</dt>
            <dd class="shrink-0 font-medium tabular-nums text-text">{{ field.value }}</dd>
          </div>
        </dl>
      </article>
    </div>

    <div class="space-y-3 border-t border-primary/15 pt-4">
      <p class="max-w-3xl text-sm leading-relaxed text-text/80">
        {{ t('statisticsPage.settingsBalanceFrameworkDescription') }}
      </p>
      <div class="statistics-panel-surface p-2">
        <img
          src="/images/champion-balance-framework.png"
          :alt="t('statisticsPage.settingsBalanceFrameworkImageAlt')"
          class="mx-auto w-full max-w-3xl rounded object-contain"
          loading="lazy"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiUrl } from '~/utils/apiUrl'

type BalanceLevelKey = 'average' | 'skilled' | 'elite'

type BalanceRulesConfig = {
  levels: Record<
    BalanceLevelKey,
    {
      tiers: string[]
      overpowered: {
        winrateHigh: number
        winrateLow: number
        banrateMultiplier: number
        minGames: number
        banrateTwoPatchAvgMin?: number
      }
      underpowered: {
        winrateMax?: number
        presenceMax?: number
      }
    }
  >
}

type RuleField = {
  key: string
  label: string
  value: string
}

const { t } = useI18n()
const pending = ref(true)
const error = ref(false)
const rules = ref<BalanceRulesConfig | null>(null)

function pct(value: number | undefined | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value}%`
}

function num(value: number | undefined | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return String(value)
}

function fieldsForLevel(
  key: BalanceLevelKey,
  level: BalanceRulesConfig['levels'][BalanceLevelKey]
): RuleField[] {
  const op = level.overpowered
  const up = level.underpowered
  const out: RuleField[] = [
    {
      key: 'winrateHigh',
      label: t('statisticsPage.settingsBalanceOpWinrateHigh'),
      value: pct(op.winrateHigh),
    },
    {
      key: 'winrateLow',
      label: t('statisticsPage.settingsBalanceOpWinrateLow'),
      value: pct(op.winrateLow),
    },
    {
      key: 'banrateMultiplier',
      label: t('statisticsPage.settingsBalanceOpBanrateMultiplier'),
      value: `×${num(op.banrateMultiplier)}`,
    },
    {
      key: 'minGames',
      label: t('statisticsPage.settingsBalanceOpMinGames'),
      value: num(op.minGames),
    },
  ]
  if (key === 'elite') {
    out.push({
      key: 'banrateTwoPatchAvgMin',
      label: t('statisticsPage.settingsBalanceOpBanrateTwoPatchAvgMin'),
      value: pct(op.banrateTwoPatchAvgMin),
    })
    out.push({
      key: 'presenceMax',
      label: t('statisticsPage.settingsBalanceUpPresenceMax'),
      value: pct(up.presenceMax),
    })
  } else {
    out.push({
      key: 'winrateMax',
      label: t('statisticsPage.settingsBalanceUpWinrateMax'),
      value: pct(up.winrateMax),
    })
  }
  return out
}

const levelCards = computed(() => {
  if (!rules.value) return []
  return (['average', 'skilled', 'elite'] as const).map(key => {
    const level = rules.value!.levels[key]
    return {
      key,
      label: t(`statisticsPage.settingsBalanceLevel${key.charAt(0).toUpperCase()}${key.slice(1)}`),
      tiers: level.tiers,
      fields: fieldsForLevel(key, level),
    }
  })
})

async function loadRules(): Promise<void> {
  pending.value = true
  error.value = false
  try {
    const res = await fetch(apiUrl('/api/stats/balance-rules'))
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as { rules?: BalanceRulesConfig }
    if (!data.rules?.levels) throw new Error('missing rules')
    rules.value = data.rules
  } catch {
    rules.value = null
    error.value = true
  } finally {
    pending.value = false
  }
}

onMounted(() => {
  loadRules()
})
</script>
