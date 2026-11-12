<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  PING_METRIC_KEYS,
  type PingMetricKey,
  type PingsNumericKey,
  type PingsTableRow,
} from '~/composables/statistics/useStatisticsPingsTab'
import { onPingIconError, pingIconSrc } from '~/utils/pingIcons'
import { pingBarRows } from '~/utils/statistics/pingBarRows'

export type ChampionPingsSummary = PingsTableRow

const props = defineProps<{
  data: ChampionPingsSummary | null
  baseline: ChampionPingsSummary | null
  pending: boolean
}>()

const { t } = useI18n()

const hasData = computed(() => Number(props.data?.games ?? 0) > 0)

const bars = computed(() => pingBarRows(props.data, PING_METRIC_KEYS))

function formatOne(value: number): string {
  return Number(value).toLocaleString('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

function metricValue(key: PingsNumericKey): number {
  return Number(props.data?.[key] ?? 0)
}

function metricLabel(key: PingMetricKey): string {
  return t(`statisticsPage.pingsMetric.${key}`)
}
</script>

<template>
  <div class="champion-pings-tab w-full min-w-0 max-w-full space-y-4">
    <div v-if="pending" class="text-sm text-text/70">
      {{ t('statisticsPage.loading') }}
    </div>
    <div v-else-if="!hasData" class="statistics-empty-panel p-4">
      {{ t('statisticsPage.noData') }}
    </div>
    <template v-else>
      <div class="pb-card">
        <div class="pb-head">
          <h3>{{ t('statisticsPage.pingsPerGameTitle') }}</h3>
          <span>
            {{ t('statisticsPage.pingsColTotal') }}
            <b>{{ formatOne(metricValue('totalPerGame')) }}</b>
          </span>
        </div>
        <ul class="pb-list">
          <li v-for="row in bars" :key="row.key">
            <img
              :src="pingIconSrc(row.key)"
              alt=""
              class="pb-icon"
              loading="lazy"
              @error="onPingIconError($event, row.key)"
            />
            <span class="pb-name">{{ metricLabel(row.key) }}</span>
            <span class="pb-track"><span :style="{ width: `${row.pct}%` }" /></span>
            <span class="pb-val">{{ formatOne(row.value) }}</span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<style scoped>
.pb-card {
  padding: 20px;
  border: 1px solid #463714;
  border-radius: 10px;
  background: #0a1428;
}
.pb-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
}
.pb-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #f0e6d2;
}
.pb-head span {
  font-size: 13px;
  color: #a09b8c;
}
.pb-head b {
  color: #f0e6d2;
}
.pb-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pb-list li {
  display: grid;
  grid-template-columns: 24px 130px 1fr 44px;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #f0e6d2;
}
.pb-icon {
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  background: #0d2a33;
  object-fit: contain;
}
.pb-track {
  height: 6px;
  border-radius: 3px;
  background: #1e2328;
  overflow: hidden;
}
.pb-track > span {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: #c89b3c;
}
.pb-val {
  text-align: right;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
</style>
