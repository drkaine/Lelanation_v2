<template>
  <div class="statistics-otp-players-filter mb-3">
    <div class="mb-1 text-sm font-medium text-text" :title="t('statisticsPage.otpPlayersHint')">
      {{ t('statisticsPage.otpPlayers') }}
    </div>
    <div class="flex flex-wrap gap-1">
      <button
        v-for="seg in STATS_OTP_PLAYERS_SEGMENTS"
        :key="seg.value"
        type="button"
        class="rounded px-1.5 py-0.5 text-xs font-semibold transition-colors"
        :class="selected === seg.value ? ACTIVE : INACTIVE"
        :aria-pressed="selected === seg.value"
        @mousedown.prevent
        @click.stop="apply(seg.value)"
      >
        {{ t(seg.labelKey) }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  STATS_OTP_PLAYERS_COOKIE,
  STATS_OTP_PLAYERS_SEGMENTS,
  type StatsOtpPlayers,
  parseStatsOtpPlayers,
} from '~/utils/statsOtpPlayers'

const ACTIVE = 'bg-info/20 ring-1 ring-info/60 text-text'
const INACTIVE = 'bg-chrome text-text/80 hover:bg-white/10'

const { t } = useI18n()
const cookie = useCookie<string | null>(STATS_OTP_PLAYERS_COOKIE, {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
  path: '/',
})
const selected = ref<StatsOtpPlayers>(parseStatsOtpPlayers(cookie.value))

/** Toutes les données stats dépendent du filtre : cookie puis rechargement pour tout refetch. */
async function apply(value: StatsOtpPlayers) {
  if (value === selected.value) return
  selected.value = value
  cookie.value = value === 'all' ? null : value
  await nextTick()
  reloadNuxtApp({ persistState: false })
}
</script>
