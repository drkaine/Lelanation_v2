<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { statsRoleLabel } from '~/utils/statsRoleDisplay'
import { LOW_SAMPLE_MIN_GAMES } from '~/utils/statistics/lowSample'
import {
  combatKpis,
  combatRoleRows,
  formatCombatNumber,
  type CombatRoleInput,
} from '~/utils/statistics/combatRolesSummary'

const props = defineProps<{
  metrics: Partial<Record<string, number>> | null | undefined
  roles: readonly CombatRoleInput[] | null | undefined
  pending?: boolean
}>()

const { t } = useI18n()
const kpis = computed(() => combatKpis(props.metrics ?? {}))
const rows = computed(() => combatRoleRows(props.roles ?? [], LOW_SAMPLE_MIN_GAMES))
const f = formatCombatNumber
</script>

<template>
  <section class="cr">
    <h2 class="cr-title">{{ t('statisticsPage.combatRolesTitle') }}</h2>
    <p v-if="pending && !metrics" class="cr-muted">{{ t('statisticsPage.loading') }}</p>
    <template v-else>
      <div class="cr-kpis">
        <div v-for="k in kpis" :key="k.key" class="cr-kpi">
          <span class="cr-kpi-label">{{ t(k.labelKey) }}</span>
          <span class="cr-kpi-value">{{ k.value }}</span>
        </div>
      </div>
      <div v-if="rows.length" class="cr-table-wrap">
        <table class="cr-table">
          <thead>
            <tr>
              <th class="l">{{ t('statisticsPage.championDashboardRole') }}</th>
              <th>{{ t('statisticsPage.championDashboardGamesShort') }}</th>
              <th>Winrate</th>
              <th>K / D / A</th>
              <th>KDA</th>
              <th>{{ t('statisticsPage.combatKpiGold') }}</th>
              <th>CS / min</th>
              <th>{{ t('statisticsPage.combatKpiDamage') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.role" :class="{ low: r.lowSample }">
              <td class="l">
                <span class="cr-role">{{ statsRoleLabel(r.role) }}</span>
                <span v-if="r.lowSample" class="cr-badge">{{
                  t('statisticsPage.lowSampleBadge')
                }}</span>
              </td>
              <td>{{ f(r.games, 0) }}</td>
              <td class="b">{{ f(r.winrate, 1) }} %</td>
              <td>{{ f(r.kills, 1) }} / {{ f(r.deaths, 1) }} / {{ f(r.assists, 1) }}</td>
              <td>{{ f(r.kda, 2) }}</td>
              <td>{{ f(r.gold, 0) }}</td>
              <td>{{ f(r.csPerMin, 1) }}</td>
              <td>{{ f(r.damage, 0) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<style scoped>
.cr-title {
  margin: 0 0 12px;
  font-size: 20px;
  font-weight: 600;
  color: #f0e6d2;
}
.cr-muted {
  color: #a09b8c;
  font-size: 13px;
}
.cr-kpis {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
.cr-kpi {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border: 1px solid #463714;
  border-radius: 10px;
  background: #0a1428;
}
.cr-kpi-label {
  font-size: 12px;
  color: #a09b8c;
}
.cr-kpi-value {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: 26px;
  line-height: 1.1;
  color: #f0e6d2;
  font-variant-numeric: tabular-nums;
}
.cr-table-wrap {
  overflow-x: auto;
  border: 1px solid #463714;
  border-radius: 10px;
  background: #0a1428;
}
.cr-table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.cr-table th {
  padding: 12px 20px;
  font-size: 12px;
  font-weight: 600;
  color: #a09b8c;
  text-align: right;
  border-bottom: 1px solid #463714;
}
.cr-table td {
  padding: 11px 20px;
  text-align: right;
  color: #f0e6d2;
  border-bottom: 1px solid rgba(70, 55, 20, 0.45);
}
.cr-table tr:last-child td {
  border-bottom: 0;
}
.cr-table .l {
  text-align: left;
}
.cr-table td.b {
  font-weight: 700;
}
.cr-table tr.low td {
  color: #a09b8c;
}
.cr-role {
  font-weight: 600;
}
.cr-badge {
  margin-left: 8px;
  padding: 1px 6px;
  font-size: 11px;
  color: #a09b8c;
  border: 1px solid #463714;
  border-radius: 4px;
}
@media (max-width: 1023px) {
  .cr-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .cr-kpi-value {
    font-size: 22px;
  }
  .cr-table th,
  .cr-table td {
    padding: 10px 12px;
  }
}
</style>
