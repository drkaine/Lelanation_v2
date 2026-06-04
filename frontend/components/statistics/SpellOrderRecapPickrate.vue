<template>
  <div class="champion-spell-order-pickrate-block min-w-[4.5rem] text-right">
    <div class="text-[9px] font-semibold uppercase tracking-wide text-text/50">
      {{ t('statisticsPage.pickrate') }}
    </div>
    <div class="text-base font-bold tabular-nums leading-tight text-sky-300">
      {{ pickrate.toFixed(1) }}%
    </div>
    <div class="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-black/35" role="presentation">
      <div
        class="h-full rounded-full bg-sky-400/85 transition-[width]"
        :style="{ width: `${Math.min(100, Math.max(0, pickrate))}%` }"
      />
    </div>
    <div class="mt-0.5 text-[9px] tabular-nums text-text/45">
      {{ t('statisticsPage.championSpellOrderGames', { count: games }) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  pickrate: number
  games: number
}>()

const { t } = useI18n()
</script>
