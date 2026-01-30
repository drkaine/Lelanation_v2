<template>
  <div class="theorycraft min-h-screen p-4 text-text">
    <div class="mx-auto max-w-6xl space-y-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 class="text-2xl font-bold text-text-accent">{{ t('theorycraft.title') }}</h1>
        <NuxtLink
          :to="localePath('/builds/create/champion')"
          class="rounded border border-accent/70 px-4 py-2 text-sm text-text transition-colors hover:bg-accent/10"
        >
          {{ t('menu-build.champion') }} →
        </NuxtLink>
      </div>

      <p class="text-text/80">{{ t('theorycraft.configurePrompt') }}</p>

      <!-- Build card (editable) + right column: stats & spell damage -->
      <div class="flex flex-col gap-6 lg:flex-row">
        <div class="flex-shrink-0">
          <BuildCard :readonly="false" />
        </div>
        <div class="min-w-0 flex-1 space-y-6">
          <!-- Item stacks -->
          <div
            v-if="stackableItems.length > 0"
            class="rounded-lg border border-primary/30 bg-surface/30 p-4"
          >
            <h2 class="mb-4 text-lg font-semibold text-text">{{ t('theorycraft.itemStacks') }}</h2>
            <p class="mb-3 text-sm text-text/70">{{ t('theorycraft.itemStacksDescription') }}</p>
            <div class="space-y-3">
              <div
                v-for="item in stackableItems"
                :key="item.id"
                class="flex items-center justify-between gap-3 rounded border border-primary/20 bg-background/50 p-2"
              >
                <span class="text-sm text-text">{{ item.name }}</span>
                <label class="flex items-center gap-2 text-sm">
                  <span class="text-text/70">{{ t('theorycraft.rank') }}</span>
                  <input
                    v-model.number="itemStacks[item.id]"
                    type="number"
                    :min="0"
                    :max="getItemMaxStacks(item.id)"
                    class="w-20 rounded border border-primary/50 bg-background px-2 py-1 text-text"
                  />
                </label>
              </div>
            </div>
          </div>

          <!-- Passive stacks -->
          <div
            v-if="championPassiveStacks.length > 0"
            class="rounded-lg border border-primary/30 bg-surface/30 p-4"
          >
            <h2 class="mb-4 text-lg font-semibold text-text">
              {{ t('theorycraft.passiveStacks') }}
            </h2>
            <p class="mb-3 text-sm text-text/70">{{ t('theorycraft.passiveStacksDescription') }}</p>
            <div class="space-y-3">
              <div
                v-for="stackDef in championPassiveStacks"
                :key="stackDef.stackType"
                class="flex items-center justify-between gap-3 rounded border border-primary/20 bg-background/50 p-2"
              >
                <span class="text-sm text-text"
                  >{{ stackDef.championName }} ({{ stackDef.stackType }})</span
                >
                <label class="flex items-center gap-2 text-sm">
                  <span class="text-text/70">{{ t('theorycraft.rank') }}</span>
                  <input
                    v-model.number="passiveStacks[`${champion?.id || ''}:${stackDef.stackType}`]"
                    type="number"
                    :min="0"
                    :max="stackDef.maxStacks"
                    class="w-24 rounded border border-primary/50 bg-background px-2 py-1 text-text"
                  />
                </label>
              </div>
            </div>
          </div>

          <!-- Stats table (includes level selector 1-18) -->
          <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
            <h2 class="mb-4 text-lg font-semibold text-text">{{ t('stats.title') }}</h2>
            <StatsTable :build="buildStore.currentBuild" />
          </div>

          <!-- Enemy target -->
          <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
            <h2 class="mb-4 text-lg font-semibold text-text">{{ t('theorycraft.enemyTarget') }}</h2>
            <p class="mb-3 text-sm text-text/70">{{ t('theorycraft.enemyTargetDescription') }}</p>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label class="flex flex-col gap-1 text-sm">
                <span class="text-text/70">{{ t('theorycraft.enemyHealth') }}</span>
                <input
                  v-model.number="enemyTarget.health"
                  type="number"
                  min="0"
                  class="rounded border border-primary/50 bg-background px-3 py-2 text-text"
                />
              </label>
              <label class="flex flex-col gap-1 text-sm">
                <span class="text-text/70">{{ t('theorycraft.enemyArmor') }}</span>
                <input
                  v-model.number="enemyTarget.armor"
                  type="number"
                  min="0"
                  class="rounded border border-primary/50 bg-background px-3 py-2 text-text"
                />
              </label>
              <label class="flex flex-col gap-1 text-sm">
                <span class="text-text/70">{{ t('theorycraft.enemyMagicResist') }}</span>
                <input
                  v-model.number="enemyTarget.magicResist"
                  type="number"
                  min="0"
                  class="rounded border border-primary/50 bg-background px-3 py-2 text-text"
                />
              </label>
            </div>
          </div>

          <!-- Spell damage by rank -->
          <div
            v-if="champion && buildStats"
            class="rounded-lg border border-primary/30 bg-surface/30 p-4"
          >
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 class="text-lg font-semibold text-text">{{ t('theorycraft.spellDamage') }}</h2>
              <label class="flex items-center gap-2 text-sm text-text/80">
                <span>{{ t('stats.level') }}</span>
                <select
                  v-model.number="theorycraftLevel"
                  class="rounded border border-primary/50 bg-background px-2 py-1 text-text"
                >
                  <option v-for="n in 18" :key="n" :value="n">{{ n }}</option>
                </select>
              </label>
            </div>
            <p class="mb-3 text-sm text-text/70">
              {{ t('theorycraft.spellDamageByRank') }}
            </p>
            <div class="space-y-4">
              <div
                v-for="(spell, idx) in champion.spells"
                :key="spell.id"
                class="rounded border border-primary/20 bg-background/50 p-3"
              >
                <div class="mb-2 flex items-center gap-2">
                  <span class="font-semibold text-text"
                    >{{ ['Q', 'W', 'E', 'R'][idx] }}: {{ spell.name }}</span
                  >
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="border-b border-primary/20 text-left">
                        <th class="py-1 pr-4 text-text/70">{{ t('theorycraft.rank') }}</th>
                        <th class="py-1 text-text/70">{{ t('theorycraft.rawDamage') }}</th>
                        <th v-if="enemyTarget.health > 0" class="py-1 text-text/70">
                          {{ t('theorycraft.realDamage') }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="row in spellDamageBySpell[idx]"
                        :key="row.rank"
                        class="border-b border-primary/10"
                      >
                        <td class="py-1 pr-4 text-text">{{ row.rank }}</td>
                        <td class="py-1 font-mono text-text">{{ row.damage }}</td>
                        <td v-if="enemyTarget.health > 0" class="py-1 font-mono text-text">
                          {{ getRealDamageForSpell(spell, row.rank, row.damage) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <!-- Save build -->
          <div class="flex flex-wrap gap-3">
            <button
              type="button"
              class="rounded bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              :disabled="!buildStore.isBuildValid"
              @click="goToSaveBuild"
            >
              {{ t('theorycraft.saveBuild') }}
            </button>
            <p v-if="!buildStore.isBuildValid" class="text-sm text-text/60">
              {{ t('stats.selectChampionAndItems') }} (champion, items, runes, sorts, ordre de
              montée).
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useBuildStore } from '~/stores/BuildStore'
import { calculateStats } from '~/utils/statsCalculator'
import { getSpellDamageByRank } from '~/utils/spellDamage'
import { isStackableItem, getItemStackFormula } from '~/utils/itemStacks'
import { getChampionPassiveStacks } from '~/utils/passiveStacks'
import { calculateMagicDamage, type EnemyTarget } from '~/utils/realDamage'
import type { Spell } from '~/types/build'

definePageMeta({
  layout: true,
})

const { t } = useI18n()
const localePath = useLocalePath()
const buildStore = useBuildStore()

useHead({
  title: () => t('theorycraft.metaTitle'),
  meta: [{ name: 'description', content: () => t('theorycraft.metaDescription') }],
})

onMounted(() => {
  if (!buildStore.currentBuild) {
    buildStore.createNewBuild()
  }
})

const champion = computed(() => buildStore.currentBuild?.champion ?? null)
const theorycraftLevel = ref(18)
const itemStacks = ref<Record<string, number>>({})
const passiveStacks = ref<Record<string, number>>({})
const enemyTarget = ref<EnemyTarget>({
  health: 2000,
  armor: 100,
  magicResist: 50,
})

const stackableItems = computed(() => {
  const items = buildStore.currentBuild?.items || []
  return items.filter(item => isStackableItem(item.id))
})

const championPassiveStacks = computed(() => {
  if (!champion.value) return []
  return getChampionPassiveStacks(champion.value.id)
})

function getItemMaxStacks(itemId: string): number {
  const formula = getItemStackFormula(itemId)
  return formula?.maxStacks || 0
}

const normalizedPassiveStacks = computed(() => {
  const result: Record<string, number> = {}
  if (!champion.value) return result
  for (const [key, value] of Object.entries(passiveStacks.value)) {
    const [champId, stackType] = key.split(':')
    if (champId === champion.value.id) {
      result[stackType] = value || 0
    }
  }
  return result
})

const buildStats = computed(() => {
  const b = buildStore.currentBuild
  if (!b?.champion || !b.items || !b.runes || !b.shards) return null
  return calculateStats(
    b.champion,
    b.items,
    b.runes,
    b.shards,
    theorycraftLevel.value,
    itemStacks.value,
    normalizedPassiveStacks.value
  )
})

const championBaseAdAtLevel = computed(() => {
  if (!champion.value) return 0
  const base = champion.value.stats
  const l = theorycraftLevel.value - 1
  return base.attackdamage + base.attackdamageperlevel * l
})

const spellDamageBySpell = computed(() => {
  const ch = champion.value
  const stats = buildStats.value
  const baseAd = championBaseAdAtLevel.value
  if (!ch?.spells || !stats) return [[], [], [], []]
  return ch.spells.map(spell => getSpellDamageByRank(spell, stats, baseAd))
})

function getRealDamageForSpell(_spell: Spell, _rank: number, rawDamage: number): number {
  if (!buildStats.value || enemyTarget.value.health <= 0) return rawDamage
  // Simplification: on considère que les sorts sont magiques ou physiques selon le champion
  // En réalité, il faudrait parser le type de dégât depuis les données du sort
  // Pour MVP, on utilise magic damage par défaut (la plupart des sorts sont magiques)
  return calculateMagicDamage(rawDamage, enemyTarget.value, buildStats.value)
}

function goToSaveBuild() {
  if (!buildStore.isBuildValid) return
  navigateTo(localePath('/builds/create/info'))
}
</script>
