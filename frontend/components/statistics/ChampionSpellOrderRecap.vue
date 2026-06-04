<template>
  <section
    class="champion-spell-order-recap rounded-lg border border-primary/30 bg-surface/40 p-3 sm:p-4"
  >
    <h3 class="mb-3 text-sm font-semibold text-text">
      {{ t('statisticsPage.championSpellOrderRecapTitle') }}
    </h3>
    <div class="grid gap-4 md:grid-cols-2">
      <div>
        <h4 class="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text/55">
          {{ t('statisticsPage.championSpellOrderRecapFirstThree') }}
        </h4>
        <ul v-if="recap.topFirstThree.length" class="space-y-2">
          <li
            v-for="(entry, idx) in recap.topFirstThree"
            :key="'f3-' + entry.key"
            class="flex items-center gap-2 rounded-md bg-background/40 px-2 py-1.5"
          >
            <span
              class="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/25 text-[10px] font-bold tabular-nums text-text/80"
              >{{ idx + 1 }}</span
            >
            <div class="flex shrink-0 items-center gap-0.5">
              <img
                v-for="(skill, si) in entry.skills"
                :key="'f3s-' + entry.key + '-' + si"
                :src="skillIconUrl(skill) ?? undefined"
                :alt="skillLabel(skill)"
                class="h-7 w-7 rounded-sm border border-primary/30 object-cover"
                width="28"
                height="28"
              />
            </div>
            <SpellOrderRecapPickrate
              :pickrate="entry.pickrate"
              :games="entry.games"
              class="ml-auto"
            />
          </li>
        </ul>
        <p v-else class="text-xs text-text/50">{{ t('statisticsPage.noData') }}</p>
      </div>
      <div>
        <h4 class="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text/55">
          {{ t('statisticsPage.championSpellOrderRecapMaxOrder') }}
        </h4>
        <ul v-if="recap.topMaxOrder.length" class="space-y-2">
          <li
            v-for="(entry, idx) in recap.topMaxOrder"
            :key="'max-' + entry.key"
            class="flex items-center gap-2 rounded-md bg-background/40 px-2 py-1.5"
          >
            <span
              class="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent/25 text-[10px] font-bold tabular-nums text-text/80"
              >{{ idx + 1 }}</span
            >
            <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              <template v-for="(skill, si) in entry.skills" :key="'maxs-' + entry.key + '-' + si">
                <img
                  v-if="skillIconUrl(skill)"
                  :src="skillIconUrl(skill)!"
                  :alt="skillLabel(skill)"
                  class="h-7 w-7 shrink-0 rounded-sm border border-primary/30 object-cover"
                  width="28"
                  height="28"
                />
                <span
                  v-if="si < entry.skills.length - 1"
                  class="text-[10px] font-bold text-text/40"
                  aria-hidden="true"
                  >›</span
                >
              </template>
            </div>
            <SpellOrderRecapPickrate
              :pickrate="entry.pickrate"
              :games="entry.games"
              class="shrink-0"
            />
          </li>
        </ul>
        <p v-else class="text-xs text-text/50">{{ t('statisticsPage.noData') }}</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { getChampionSpellImageUrl } from '~/utils/imageUrl'
import type { SpellOrderRecapEntry, SpellOrderSkillKey } from '~/utils/championSpellOrderMerge'
import SpellOrderRecapPickrate from '~/components/statistics/SpellOrderRecapPickrate.vue'

const props = defineProps<{
  recap: {
    topFirstThree: SpellOrderRecapEntry[]
    topMaxOrder: SpellOrderRecapEntry[]
  }
  championId: number
  gameVersion: string
  spells?: Array<{ name?: string; image?: { full?: string } }>
}>()

const { t } = useI18n()

function skillIndex(key: SpellOrderSkillKey): number {
  if (key === 'Q') return 0
  if (key === 'W') return 1
  if (key === 'E') return 2
  return 3
}

function skillLabel(key: SpellOrderSkillKey): string {
  return props.spells?.[skillIndex(key)]?.name ?? t(`skills.key.${key}`)
}

function skillIconUrl(key: SpellOrderSkillKey): string | null {
  if (props.championId <= 0) return null
  const file = props.spells?.[skillIndex(key)]?.image?.full
  if (!file || !props.gameVersion) return null
  return getChampionSpellImageUrl(props.gameVersion, String(props.championId), file)
}
</script>
