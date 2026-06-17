<template>
  <div class="statistics-filters-fields flex flex-col gap-3">
    <div>
      <div class="mb-1 text-sm font-medium text-text">
        {{ t('statisticsPage.overviewMatchesByDivision') }}
      </div>
      <div class="flex flex-wrap gap-1">
        <button
          type="button"
          class="stats-division-btn rounded p-0.5 transition-colors"
          :class="
            filterRank.length === 0
              ? 'bg-blue-500/20 ring-1 ring-blue-400/60'
              : 'bg-black/20 hover:bg-white/10'
          "
          :title="t('statisticsPage.allRanks')"
          :aria-pressed="filterRank.length === 0"
          @mousedown.prevent
          @click.stop="selectAllDivisions()"
        >
          <img
            src="/data/community-dragon/ranked-emblem/Unranked.png"
            :alt="t('statisticsPage.allRanks')"
            class="h-3 w-3 object-contain"
            :class="
              filterRank.length === 0 ? 'saturate-110 opacity-100' : 'brightness-125 grayscale'
            "
            width="12"
            height="12"
          />
        </button>
        <button
          v-for="tier in RANK_TIERS"
          :key="tier"
          type="button"
          class="stats-division-btn rounded p-0.5 transition-colors"
          :class="
            filterRank.includes(tier)
              ? 'bg-blue-500/20 ring-1 ring-blue-400/60'
              : 'bg-black/20 hover:bg-white/10'
          "
          :title="formatDivisionLabel(tier)"
          :aria-pressed="filterRank.includes(tier)"
          @mousedown.prevent
          @click.stop="toggleRankFilter(tier)"
        >
          <img
            v-if="getRankedEmblemUrl(tier)"
            :src="getRankedEmblemUrl(tier)!"
            :alt="tier"
            class="h-3 w-3 object-contain"
            :class="
              filterRank.includes(tier) ? 'saturate-110 opacity-100' : 'brightness-125 grayscale'
            "
            width="12"
            height="12"
          />
        </button>
      </div>
    </div>
    <div>
      <div class="mb-1 text-sm font-medium text-text">
        {{ t('statisticsPage.filterRole') }}
      </div>
      <div class="flex flex-wrap gap-1">
        <button
          type="button"
          class="stats-role-btn rounded p-0.5 transition-colors"
          :class="!filterRole ? 'bg-blue-500/20' : 'bg-black/20 hover:bg-white/10'"
          :title="t('statisticsPage.allRoles')"
          @click="selectAllRoles()"
        >
          <img
            src="/icons/roles/all-role.png"
            :alt="t('statisticsPage.allRoles')"
            class="h-3 w-3 object-contain"
            :class="!filterRole ? 'saturate-110 opacity-100' : 'brightness-125 grayscale'"
            width="12"
            height="12"
          />
        </button>
        <button
          v-for="r in roleOptions"
          :key="r.value"
          type="button"
          class="stats-role-btn rounded p-0.5 transition-colors"
          :class="filterRole === r.value ? 'bg-blue-500/20' : 'bg-black/20 hover:bg-white/10'"
          :title="r.label"
          @click="toggleRoleFilter(r)"
        >
          <img
            :src="r.icon"
            :alt="r.label"
            class="h-3 w-3 object-contain"
            :class="
              filterRole === r.value ? 'saturate-110 opacity-100' : 'brightness-125 grayscale'
            "
            width="12"
            height="12"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RANK_TIERS } from '~/utils/rankTiers'
import { getRankedEmblemUrl } from '~/utils/rankedEmblem'

const filterRank = defineModel<string[]>('filterRank', { required: true })
const filterRole = defineModel<string>('filterRole', { required: true })

const { t } = useI18n()

const roleOptions = [
  { value: 'TOP', label: 'Top', icon: '/icons/roles/top.png' },
  { value: 'JUNGLE', label: 'Jungle', icon: '/icons/roles/jungle.png' },
  { value: 'MIDDLE', label: 'Mid', icon: '/icons/roles/mid.png' },
  { value: 'BOTTOM', label: 'ADC', icon: '/icons/roles/bot.png' },
  { value: 'SUPPORT', label: 'Support', icon: '/icons/roles/support.png' },
]

function formatDivisionLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()
}

function toggleRankFilter(tier: string): void {
  const arr = filterRank.value
  const idx = arr.indexOf(tier)
  filterRank.value = idx >= 0 ? arr.filter((_, i) => i !== idx) : [...arr, tier]
}

function selectAllDivisions(): void {
  filterRank.value = []
}

function selectAllRoles(): void {
  filterRole.value = ''
}

function toggleRoleFilter(r: (typeof roleOptions)[number]): void {
  filterRole.value = filterRole.value === r.value ? '' : r.value
}
</script>
