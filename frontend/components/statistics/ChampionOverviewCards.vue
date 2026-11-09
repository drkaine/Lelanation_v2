<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type {
  OverviewRoleRow,
  ProfileColumn,
  SkillKey,
} from '~/utils/statistics/overviewBuildSummary'
import { formatCombatNumber } from '~/utils/statistics/combatRolesSummary'

export interface OverviewIconRow {
  id: number
  name: string
  img: string
  pct?: number
  winrate?: number
  games?: number
}

defineProps<{
  mainRole: string
  skill: {
    first: SkillKey[]
    max: SkillKey[]
    winrate: number
    pickrate: number
    games: number
  } | null
  spells: OverviewIconRow[]
  items: OverviewIconRow[]
  roles: Array<OverviewRoleRow & { label: string }>
  damage: { magic: number; phys: number; trueDamage: number; total: number } | null
  profile: ProfileColumn[] | null
  matchupsBest: OverviewIconRow[]
  matchupsWorst: OverviewIconRow[]
  pending: boolean
}>()

const emit = defineEmits<{ (e: 'go-tab', tab: 'spells' | 'items' | 'matchups'): void }>()

const { t } = useI18n()

function pct(v: number, digits = 1): string {
  return `${formatCombatNumber(v, digits)} %`
}
function share(part: number, total: number): string {
  return total > 0 ? pct((100 * part) / total) : '—'
}
</script>

<template>
  <div class="ov-cards">
    <div class="ov-row">
      <article class="ov-card">
        <header class="ov-head">
          <h3>{{ t('statisticsPage.ovBuildTitle', { role: mainRole }) }}</h3>
          <button type="button" class="ov-link" @click="emit('go-tab', 'spells')">
            {{ t('statisticsPage.ovAllVariants') }} →
          </button>
        </header>
        <template v-if="skill">
          <p class="ov-label">{{ t('statisticsPage.ovSkillOrder') }}</p>
          <div class="ov-skills">
            <span class="ov-muted">{{ t('statisticsPage.ovLevels13') }}</span>
            <b v-for="(k, i) in skill.first" :key="`f${i}`" class="ov-key">{{ k }}</b>
            <span class="ov-muted ov-gap">Max</span>
            <template v-for="(k, i) in skill.max" :key="`m${i}`">
              <span v-if="i > 0" class="ov-muted">›</span>
              <b class="ov-key is-max" :class="`is-max-${i}`">{{ k }}</b>
            </template>
          </div>
          <p class="ov-skill-stats">
            <b>{{ pct(skill.winrate) }}</b> WR · {{ pct(skill.pickrate) }}
            {{ t('statisticsPage.ovOfGames') }} · {{ formatCombatNumber(skill.games, 0) }}
            {{ t('statisticsPage.ovGames') }}
          </p>
        </template>
        <template v-if="spells.length">
          <p class="ov-label">{{ t('statisticsPage.ovSummonerSpells') }}</p>
          <ul class="ov-bars">
            <li v-for="s in spells" :key="s.id">
              <img :src="s.img" alt="" width="24" height="24" loading="lazy" />
              <span class="ov-name">{{ s.name }}</span>
              <span class="ov-track"><span :style="{ width: `${s.pct ?? 0}%` }" /></span>
              <b class="ov-val">{{ formatCombatNumber(s.pct ?? 0, 0) }} %</b>
            </li>
          </ul>
        </template>
        <template v-if="items.length">
          <p class="ov-label">{{ t('statisticsPage.ovTopItems') }}</p>
          <ul class="ov-chips">
            <li v-for="it in items" :key="it.id">
              <img :src="it.img" alt="" width="24" height="24" loading="lazy" />
              {{ it.name }}
            </li>
          </ul>
        </template>
        <p v-if="!skill && !spells.length && !items.length" class="ov-muted">
          {{ pending ? t('statisticsPage.loading') : t('statisticsPage.noData') }}
        </p>
      </article>

      <article class="ov-card">
        <h3>{{ t('statisticsPage.championOvByRole') }}</h3>
        <table class="ov-roles">
          <thead>
            <tr>
              <th>{{ t('statisticsPage.ovRole') }}</th>
              <th>{{ t('statisticsPage.ovShare') }}</th>
              <th class="num">{{ t('statisticsPage.ovGamesCol') }}</th>
              <th class="num">Winrate</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in roles" :key="r.role" :class="{ 'is-low': r.lowSample }">
              <td :class="{ 'is-main': i === 0 }">{{ r.label }}</td>
              <td class="bar">
                <span class="ov-track"><span :style="{ width: `${r.pct}%` }" /></span>
              </td>
              <td class="num">{{ formatCombatNumber(r.games, 0) }}</td>
              <td class="num">
                <b>{{ pct(r.winrate) }}</b>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="roles.some(r => r.lowSample)" class="ov-note">
          {{ t('statisticsPage.ovLowSampleNote') }}
        </p>
        <template v-if="damage && damage.total > 0">
          <h4>{{ t('statisticsPage.championOvDamageType') }}</h4>
          <div class="ov-stack" role="img" :aria-label="t('statisticsPage.championOvDamageType')">
            <span class="is-magic" :style="{ width: `${(100 * damage.magic) / damage.total}%` }" />
            <span class="is-phys" :style="{ width: `${(100 * damage.phys) / damage.total}%` }" />
            <span
              class="is-true"
              :style="{ width: `${(100 * damage.trueDamage) / damage.total}%` }"
            />
          </div>
          <p class="ov-legend">
            <span
              ><i class="is-magic" />{{ t('statisticsPage.championOvMagic') }}
              {{ share(damage.magic, damage.total) }}</span
            >
            <span
              ><i class="is-phys" />{{ t('statisticsPage.championOvPhys') }}
              {{ share(damage.phys, damage.total) }}</span
            >
            <span
              ><i class="is-true" />{{ t('statisticsPage.championOvTrue') }}
              {{ share(damage.trueDamage, damage.total) }}</span
            >
          </p>
        </template>
      </article>
    </div>

    <article class="ov-card">
      <slot name="evolution" />
    </article>

    <div class="ov-row">
      <article class="ov-card">
        <h3>{{ t('statisticsPage.ovProfileTitle') }}</h3>
        <div v-if="profile" class="ov-profile">
          <div v-for="col in profile" :key="col.id">
            <p class="ov-label">{{ t(`statisticsPage.ovProfileCol_${col.id}`) }}</p>
            <dl>
              <template v-for="row in col.rows" :key="row.labelKey">
                <dt>{{ t(row.labelKey) }}</dt>
                <dd>{{ row.value }}</dd>
              </template>
            </dl>
          </div>
        </div>
        <p v-else class="ov-muted">
          {{ pending ? t('statisticsPage.loading') : t('statisticsPage.noData') }}
        </p>
      </article>

      <article
        class="ov-card"
        :class="{ 'is-empty': !matchupsBest.length && !matchupsWorst.length }"
      >
        <h3>{{ t('statisticsPage.championGroupMatchups') }}</h3>
        <template v-if="matchupsBest.length || matchupsWorst.length">
          <div class="ov-mu">
            <div>
              <p class="ov-label">{{ t('statisticsPage.ovBestMatchups') }}</p>
              <ul>
                <li v-for="m in matchupsBest" :key="m.id">
                  <img :src="m.img" alt="" width="24" height="24" loading="lazy" />
                  <span class="ov-name">{{ m.name }}</span>
                  <b class="is-up">{{ pct(m.winrate ?? 0) }}</b>
                </li>
              </ul>
            </div>
            <div>
              <p class="ov-label">{{ t('statisticsPage.ovWorstMatchups') }}</p>
              <ul>
                <li v-for="m in matchupsWorst" :key="m.id">
                  <img :src="m.img" alt="" width="24" height="24" loading="lazy" />
                  <span class="ov-name">{{ m.name }}</span>
                  <b class="is-down">{{ pct(m.winrate ?? 0) }}</b>
                </li>
              </ul>
            </div>
          </div>
        </template>
        <p v-else class="ov-text">{{ t('statisticsPage.ovMatchupsEmpty') }}</p>
        <button type="button" class="ov-btn" @click="emit('go-tab', 'matchups')">
          {{ t('statisticsPage.ovSeeMatchups') }}
        </button>
      </article>
    </div>
  </div>
</template>

<style scoped>
.ov-cards {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.ov-row {
  display: grid;
  grid-template-columns: 7fr 6fr;
  gap: 20px;
  align-items: start;
}
@media (max-width: 1023px) {
  .ov-row {
    grid-template-columns: 1fr;
  }
}
.ov-card {
  min-width: 0;
  padding: 22px 24px;
  border: 1px solid #463714;
  border-radius: 10px;
  background: #0a1428;
  color: #f0e6d2;
}
.ov-card.is-empty {
  border-style: dashed;
}
.ov-card h3 {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
}
.ov-card h4 {
  margin: 20px 0 10px;
  font-size: 15px;
  font-weight: 600;
}
.ov-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}
.ov-link {
  font-size: 13px;
  font-weight: 600;
  color: #c89b3c;
}
.ov-link:hover {
  color: #f0e6d2;
}
.ov-label {
  margin: 18px 0 10px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #a09b8c;
}
.ov-muted {
  font-size: 12px;
  color: #a09b8c;
}
.ov-gap {
  margin-left: 18px;
}
.ov-skills {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ov-key {
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: #0d2a33;
  color: #f0e6d2;
  font-size: 14px;
}
.ov-key.is-max-0 {
  background: #c89b3c;
  color: #010a13;
}
.ov-key.is-max-1 {
  background: #785a28;
}
.ov-key.is-max-2 {
  background: #463714;
}
.ov-skill-stats {
  margin: 12px 0 0;
  text-align: right;
  font-size: 13px;
  color: #a09b8c;
}
.ov-skill-stats b {
  color: #f0e6d2;
}
.ov-bars {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ov-bars li {
  display: grid;
  grid-template-columns: 26px 110px 1fr 48px;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}
.ov-bars img,
.ov-chips img,
.ov-mu img {
  border-radius: 4px;
  background: #0d2a33;
}
.ov-track {
  display: block;
  height: 6px;
  border-radius: 3px;
  background: #1e2328;
  overflow: hidden;
}
.ov-track > span {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: #c89b3c;
}
.ov-val {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.ov-chips {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ov-chips li {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 6px;
  border: 1px solid #463714;
  border-radius: 6px;
  font-size: 13px;
}
.ov-roles {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.ov-roles th {
  padding: 0 0 8px;
  text-align: left;
  font-size: 12px;
  font-weight: 500;
  color: #a09b8c;
}
.ov-roles td {
  padding: 6px 0;
  color: #a09b8c;
}
.ov-roles td.is-main {
  color: #f0e6d2;
  font-weight: 600;
}
.ov-roles td.bar {
  width: 50%;
  padding-right: 24px;
}
.ov-roles .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  padding-left: 12px;
}
.ov-roles tr:not(.is-low) td.num b {
  color: #f0e6d2;
}
.ov-roles tr.is-low td {
  opacity: 0.6;
}
.ov-note {
  margin: 8px 0 0;
  font-size: 12px;
  color: #a09b8c;
}
.ov-stack {
  display: flex;
  gap: 2px;
  height: 10px;
  border-radius: 5px;
  overflow: hidden;
  background: #1e2328;
}
.ov-stack span,
.ov-legend i {
  background: #f0e6d2;
}
.ov-stack .is-magic,
.ov-legend i.is-magic {
  background: #0397ab;
}
.ov-stack .is-phys,
.ov-legend i.is-phys {
  background: #e2665a;
}
.ov-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin: 10px 0 0;
  font-size: 12px;
  color: #f0e6d2;
}
.ov-legend i {
  display: inline-block;
  width: 9px;
  height: 9px;
  margin-right: 6px;
  border-radius: 2px;
}
.ov-profile {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
@media (max-width: 639px) {
  .ov-profile {
    grid-template-columns: 1fr;
  }
}
.ov-profile .ov-label {
  margin-top: 4px;
}
.ov-profile dl {
  margin: 0;
  display: grid;
  grid-template-columns: 1fr auto;
}
.ov-profile dt,
.ov-profile dd {
  margin: 0;
  padding: 7px 0;
  border-bottom: 1px solid #1e2328;
  font-size: 13px;
}
.ov-profile dd {
  text-align: right;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.ov-mu {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.ov-mu ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ov-mu li {
  display: grid;
  grid-template-columns: 24px 1fr auto;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.is-up {
  color: #0ac8b9;
}
.is-down {
  color: #e2665a;
}
.ov-text {
  margin: 0;
  font-size: 14px;
}
.ov-btn {
  margin-top: 16px;
  padding: 9px 14px;
  border: 1px solid #c89b3c;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #f0e6d2;
}
.ov-btn:hover {
  background: rgba(200, 155, 60, 0.12);
}
</style>
