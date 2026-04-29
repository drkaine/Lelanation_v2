<script setup lang="ts">
import { inject, ref, unref } from 'vue'

const p = inject('statisticsPageCtx') as any
const showChampionDealtBreakdown = ref(false)
const showChampionTakenBreakdown = ref(false)

function onChampionPageSizeChange(event: Event): void {
  const target = event.target as HTMLSelectElement | null
  const fallback = unref(p.championsPageSize)
  p.onChampionGlobalPageSizeUpdated(Number(target?.value ?? fallback))
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="p.championGlobalTablePending" class="text-text/70">
      {{ p.t('statisticsPage.loading') }}
    </div>
    <div
      v-else-if="p.championGlobalTableError"
      class="rounded border border-error bg-surface p-3 text-error"
    >
      {{ p.championGlobalTableError }}
    </div>
    <div
      v-else-if="p.championGlobalSortedRows.length === 0"
      class="statistics-overview-surface rounded-lg border border-primary/30 p-4 text-text/70"
    >
      {{ p.t('statisticsPage.championTableNoData') }}
    </div>
    <div
      v-else
      class="statistics-overview-surface w-full overflow-x-auto rounded-lg border border-primary/30"
    >
      <div
        class="tier-list-lolalytics champion-global-table w-full min-w-0 text-[13px] text-text-primary/90"
        :style="{ minWidth: p.championGlobalTableMinWidthPx + 'px' }"
      >
        <div
          class="tier-list-lolalytics-head sticky top-0 z-10 flex h-auto min-h-8 w-full items-stretch justify-between border-b border-black bg-[var(--color-grey-300)] text-text-primary/85"
        >
          <div
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-[110px] shrink-0 items-center justify-start border-b border-black px-1.5"
            :title="p.t('statisticsPage.championTableTooltipChampion')"
          >
            {{ p.t('statisticsPage.tierListColChampion') }}
          </div>
          <!-- Bleu : couleur uniquement sur le texte des titres -->
          <div
            v-show="p.showChampionSideColumns"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 w-12 shrink-0 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
          >
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[11px] font-medium leading-tight text-sky-300 hover:bg-primary/25"
              :title="
                p.t('statisticsPage.championTableTooltipBlue') +
                ' — ' +
                p.t('statisticsPage.tierListWinrateTooltip')
              "
              @click="p.setChampionGlobalSort('blueWinrate')"
            >
              {{ p.t('statisticsPage.winrate') }}{{ p.championGlobalSortIcon('blueWinrate') }}
            </button>
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
              :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
              @click="p.setChampionGlobalSort('blueWinrateDelta')"
            >
              {{ p.t('statisticsPage.championTableDeltaSymbol')
              }}{{ p.championGlobalSortIcon('blueWinrateDelta') }}
            </button>
          </div>
          <div
            v-show="p.showChampionSideColumns"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 w-12 shrink-0 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
          >
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[11px] font-medium leading-tight text-sky-300 hover:bg-primary/25"
              :title="
                p.t('statisticsPage.championTableTooltipBlue') +
                ' — ' +
                p.t('statisticsPage.tierListPickrateTooltip')
              "
              @click="p.setChampionGlobalSort('bluePickrate')"
            >
              {{ p.t('statisticsPage.pickrate') }}{{ p.championGlobalSortIcon('bluePickrate') }}
            </button>
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
              :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
              @click="p.setChampionGlobalSort('bluePickrateDelta')"
            >
              {{ p.t('statisticsPage.championTableDeltaSymbol')
              }}{{ p.championGlobalSortIcon('bluePickrateDelta') }}
            </button>
          </div>
          <!-- Rouge -->
          <div
            v-show="p.showChampionSideColumns"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 w-12 shrink-0 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
          >
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[11px] font-medium leading-tight text-red-300 hover:bg-primary/25"
              :title="
                p.t('statisticsPage.championTableTooltipRed') +
                ' — ' +
                p.t('statisticsPage.tierListWinrateTooltip')
              "
              @click="p.setChampionGlobalSort('redWinrate')"
            >
              {{ p.t('statisticsPage.winrate') }}{{ p.championGlobalSortIcon('redWinrate') }}
            </button>
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
              :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
              @click="p.setChampionGlobalSort('redWinrateDelta')"
            >
              {{ p.t('statisticsPage.championTableDeltaSymbol')
              }}{{ p.championGlobalSortIcon('redWinrateDelta') }}
            </button>
          </div>
          <div
            v-show="p.showChampionSideColumns"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 w-12 shrink-0 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
          >
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[11px] font-medium leading-tight text-red-300 hover:bg-primary/25"
              :title="
                p.t('statisticsPage.championTableTooltipRed') +
                ' — ' +
                p.t('statisticsPage.tierListPickrateTooltip')
              "
              @click="p.setChampionGlobalSort('redPickrate')"
            >
              {{ p.t('statisticsPage.pickrate') }}{{ p.championGlobalSortIcon('redPickrate') }}
            </button>
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
              :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
              @click="p.setChampionGlobalSort('redPickrateDelta')"
            >
              {{ p.t('statisticsPage.championTableDeltaSymbol')
              }}{{ p.championGlobalSortIcon('redPickrateDelta') }}
            </button>
          </div>
          <!-- Dégâts infligés -->
          <div
            v-show="p.showChampionDealtColumns"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 w-12 shrink-0 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
          >
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
              :title="p.t('statisticsPage.championTableTooltipDealt')"
              @click="p.setChampionGlobalSort('dmgTotal')"
            >
              {{ p.t('statisticsPage.championTableColTotal')
              }}{{ p.championGlobalSortIcon('dmgTotal') }}
            </button>
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
              :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
              @click="p.setChampionGlobalSort('dmgTotalDelta')"
            >
              {{ p.t('statisticsPage.championTableDeltaSymbol')
              }}{{ p.championGlobalSortIcon('dmgTotalDelta') }}
            </button>
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[10px] leading-tight text-text/80 hover:bg-primary/20"
              :title="showChampionDealtBreakdown ? 'Masquer le détail' : 'Afficher le détail'"
              @click="showChampionDealtBreakdown = !showChampionDealtBreakdown"
            >
              {{ showChampionDealtBreakdown ? '▴' : '▾' }}
            </button>
          </div>
          <div
            v-show="p.showChampionDealtColumns && showChampionDealtBreakdown"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 w-12 shrink-0 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
          >
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-amber-300 hover:bg-primary/25"
              :title="p.t('statisticsPage.championTableDealtPhys')"
              @click="p.setChampionGlobalSort('dmgPhys')"
            >
              {{ p.t('statisticsPage.championTableColPhys')
              }}{{ p.championGlobalSortIcon('dmgPhys') }}
            </button>
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
              :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
              @click="p.setChampionGlobalSort('dmgPhysDelta')"
            >
              {{ p.t('statisticsPage.championTableDeltaSymbol')
              }}{{ p.championGlobalSortIcon('dmgPhysDelta') }}
            </button>
          </div>
          <div
            v-show="p.showChampionDealtColumns && showChampionDealtBreakdown"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 w-12 shrink-0 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
          >
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-violet-300 hover:bg-primary/25"
              :title="p.t('statisticsPage.championTableDealtMagic')"
              @click="p.setChampionGlobalSort('dmgMagic')"
            >
              {{ p.t('statisticsPage.championTableColMagic')
              }}{{ p.championGlobalSortIcon('dmgMagic') }}
            </button>
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
              :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
              @click="p.setChampionGlobalSort('dmgMagicDelta')"
            >
              {{ p.t('statisticsPage.championTableDeltaSymbol')
              }}{{ p.championGlobalSortIcon('dmgMagicDelta') }}
            </button>
          </div>
          <div
            v-show="p.showChampionDealtColumns && showChampionDealtBreakdown"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 w-12 shrink-0 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
          >
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-slate-200 hover:bg-primary/25"
              :title="p.t('statisticsPage.championTableDealtTrue')"
              @click="p.setChampionGlobalSort('dmgTrue')"
            >
              {{ p.t('statisticsPage.championTableColBrut')
              }}{{ p.championGlobalSortIcon('dmgTrue') }}
            </button>
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
              :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
              @click="p.setChampionGlobalSort('dmgTrueDelta')"
            >
              {{ p.t('statisticsPage.championTableDeltaSymbol')
              }}{{ p.championGlobalSortIcon('dmgTrueDelta') }}
            </button>
          </div>
          <!-- Dégâts subis -->
          <div
            v-show="p.showChampionTakenColumns"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 w-12 shrink-0 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
          >
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
              :title="p.t('statisticsPage.championTableTooltipTaken')"
              @click="p.setChampionGlobalSort('takenTotal')"
            >
              {{ p.t('statisticsPage.championTableColTotal')
              }}{{ p.championGlobalSortIcon('takenTotal') }}
            </button>
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
              :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
              @click="p.setChampionGlobalSort('takenTotalDelta')"
            >
              {{ p.t('statisticsPage.championTableDeltaSymbol')
              }}{{ p.championGlobalSortIcon('takenTotalDelta') }}
            </button>
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[10px] leading-tight text-text/80 hover:bg-primary/20"
              :title="showChampionTakenBreakdown ? 'Masquer le détail' : 'Afficher le détail'"
              @click="showChampionTakenBreakdown = !showChampionTakenBreakdown"
            >
              {{ showChampionTakenBreakdown ? '▴' : '▾' }}
            </button>
          </div>
          <div
            v-show="p.showChampionTakenColumns && showChampionTakenBreakdown"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 w-12 shrink-0 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
          >
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-amber-300 hover:bg-primary/25"
              :title="p.t('statisticsPage.championTableTakenPhys')"
              @click="p.setChampionGlobalSort('takenPhys')"
            >
              {{ p.t('statisticsPage.championTableColPhys')
              }}{{ p.championGlobalSortIcon('takenPhys') }}
            </button>
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
              :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
              @click="p.setChampionGlobalSort('takenPhysDelta')"
            >
              {{ p.t('statisticsPage.championTableDeltaSymbol')
              }}{{ p.championGlobalSortIcon('takenPhysDelta') }}
            </button>
          </div>
          <div
            v-show="p.showChampionTakenColumns && showChampionTakenBreakdown"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 w-12 shrink-0 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
          >
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-violet-300 hover:bg-primary/25"
              :title="p.t('statisticsPage.championTableTakenMagic')"
              @click="p.setChampionGlobalSort('takenMagic')"
            >
              {{ p.t('statisticsPage.championTableColMagic')
              }}{{ p.championGlobalSortIcon('takenMagic') }}
            </button>
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
              :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
              @click="p.setChampionGlobalSort('takenMagicDelta')"
            >
              {{ p.t('statisticsPage.championTableDeltaSymbol')
              }}{{ p.championGlobalSortIcon('takenMagicDelta') }}
            </button>
          </div>
          <div
            v-show="p.showChampionTakenColumns && showChampionTakenBreakdown"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 w-12 shrink-0 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
          >
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-slate-200 hover:bg-primary/25"
              :title="p.t('statisticsPage.championTableTakenTrue')"
              @click="p.setChampionGlobalSort('takenTrue')"
            >
              {{ p.t('statisticsPage.championTableColBrut')
              }}{{ p.championGlobalSortIcon('takenTrue') }}
            </button>
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
              :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
              @click="p.setChampionGlobalSort('takenTrueDelta')"
            >
              {{ p.t('statisticsPage.championTableDeltaSymbol')
              }}{{ p.championGlobalSortIcon('takenTrueDelta') }}
            </button>
          </div>
          <!-- KDA compact -->
          <div
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 w-40 shrink-0 flex-col items-stretch justify-center border-b border-black px-1 py-1"
          >
            <div class="text-center text-[10px] font-semibold leading-tight text-text/90">
              K / D / A
            </div>
            <div class="mt-0.5 flex items-center justify-center gap-1 text-[9px] leading-tight">
              <button
                type="button"
                class="rounded px-1 hover:bg-primary/20"
                :title="p.t('statisticsPage.championTableColKill')"
                @click="p.setChampionGlobalSort('kills')"
              >
                K{{ p.championGlobalSortIcon('kills') }}
              </button>
              <button
                type="button"
                class="rounded px-1 hover:bg-primary/20"
                :title="p.t('statisticsPage.championTableColDeath')"
                @click="p.setChampionGlobalSort('deaths')"
              >
                D{{ p.championGlobalSortIcon('deaths') }}
              </button>
              <button
                type="button"
                class="rounded px-1 hover:bg-primary/20"
                :title="p.t('statisticsPage.championTableColAssist')"
                @click="p.setChampionGlobalSort('assists')"
              >
                A{{ p.championGlobalSortIcon('assists') }}
              </button>
            </div>
          </div>
        </div>

        <div
          v-for="row in p.paginatedChampionGlobalRows"
          :key="row.championId"
          class="tier-list-lolalytics-row flex min-h-[60px] w-full flex-nowrap items-center justify-between py-0.5 text-text-primary/90 odd:bg-white/[0.04] even:bg-black/25"
        >
          <div
            class="tier-list-lolalytics-td flex w-[110px] shrink-0 flex-col items-center justify-center gap-0.5 px-1 py-0.5 text-center"
          >
            <NuxtLink
              v-if="p.gameVersion && p.championByKey(row.championId)"
              :to="
                p.localePath(`/statistics/champion/${encodeURIComponent(String(row.championId))}`)
              "
              class="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              :title="p.championName(row.championId) || String(row.championId)"
            >
              <img
                :src="
                  p.getChampionImageUrl(p.gameVersion, p.championByKey(row.championId)!.image.full)
                "
                :alt="p.championName(row.championId) || ''"
                class="h-8 w-8 shrink-0 cursor-pointer border border-black object-cover transition-opacity hover:opacity-85"
                width="32"
                height="32"
              />
            </NuxtLink>
            <span
              class="line-clamp-2 max-w-full text-[10px] font-medium leading-tight text-accent"
              :title="p.championName(row.championId) || String(row.championId)"
              >{{ p.championName(row.championId) || row.championId }}</span
            >
          </div>
          <div
            v-show="p.showChampionSideColumns"
            class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
          >
            <span
              :class="row.blue.games ? p.tierListWinrateClass(row.blue.winrate) : 'text-text/55'"
              >{{ row.blue.games ? row.blue.winrate.toFixed(2) : '—' }}</span
            >
            <span
              v-if="row.blue.games"
              class="text-[10px] leading-none"
              :class="
                p.tierListPatchDeltaClass(
                  p.championGlobalSideStatDeltaPp(row.championId, 'blue', 'winrate') ?? 0
                )
              "
              :title="
                p.t('statisticsPage.tierListPatchDeltaTitle', {
                  ref: p.championGlobalPatchDeltaRefLabel ?? 'ref',
                })
              "
              >{{
                p.formatTierListPatchDeltaPp(
                  p.championGlobalSideStatDeltaPp(row.championId, 'blue', 'winrate') ?? 0
                )
              }}</span
            >
          </div>
          <div
            v-show="p.showChampionSideColumns"
            class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
          >
            <span
              :class="
                row.blue.games ? p.championGlobalPickrateClass(row.blue.pickrate) : 'text-text/55'
              "
              >{{ row.blue.games ? row.blue.pickrate.toFixed(2) : '—' }}</span
            >
            <span
              v-if="row.blue.games"
              class="text-[10px] leading-none"
              :class="
                p.tierListPatchDeltaClass(
                  p.championGlobalSideStatDeltaPp(row.championId, 'blue', 'pickrate') ?? 0
                )
              "
              :title="
                p.t('statisticsPage.tierListPatchDeltaTitle', {
                  ref: p.championGlobalPatchDeltaRefLabel ?? 'ref',
                })
              "
              >{{
                p.formatTierListPatchDeltaPp(
                  p.championGlobalSideStatDeltaPp(row.championId, 'blue', 'pickrate') ?? 0
                )
              }}</span
            >
          </div>
          <div
            v-show="p.showChampionSideColumns"
            class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
          >
            <span
              :class="row.red.games ? p.tierListWinrateClass(row.red.winrate) : 'text-text/55'"
              >{{ row.red.games ? row.red.winrate.toFixed(2) : '—' }}</span
            >
            <span
              v-if="row.red.games"
              class="text-[10px] leading-none"
              :class="
                p.tierListPatchDeltaClass(
                  p.championGlobalSideStatDeltaPp(row.championId, 'red', 'winrate') ?? 0
                )
              "
              :title="
                p.t('statisticsPage.tierListPatchDeltaTitle', {
                  ref: p.championGlobalPatchDeltaRefLabel ?? 'ref',
                })
              "
              >{{
                p.formatTierListPatchDeltaPp(
                  p.championGlobalSideStatDeltaPp(row.championId, 'red', 'winrate') ?? 0
                )
              }}</span
            >
          </div>
          <div
            v-show="p.showChampionSideColumns"
            class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
          >
            <span
              :class="
                row.red.games ? p.championGlobalPickrateClass(row.red.pickrate) : 'text-text/55'
              "
              >{{ row.red.games ? row.red.pickrate.toFixed(2) : '—' }}</span
            >
            <span
              v-if="row.red.games"
              class="text-[10px] leading-none"
              :class="
                p.tierListPatchDeltaClass(
                  p.championGlobalSideStatDeltaPp(row.championId, 'red', 'pickrate') ?? 0
                )
              "
              :title="
                p.t('statisticsPage.tierListPatchDeltaTitle', {
                  ref: p.championGlobalPatchDeltaRefLabel ?? 'ref',
                })
              "
              >{{
                p.formatTierListPatchDeltaPp(
                  p.championGlobalSideStatDeltaPp(row.championId, 'red', 'pickrate') ?? 0
                )
              }}</span
            >
          </div>
          <div
            v-show="p.showChampionDealtColumns"
            class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
          >
            <span class="font-medium">{{ p.formatChampionGlobalNum(row.avgDamageToChamps) }}</span>
            <span
              v-if="
                p.championGlobalPatchDeltaRefLabel &&
                p.championGlobalNumericDelta(row.championId, 'avgDamageToChamps') != null
              "
              class="text-[10px] leading-none"
              :class="
                p.championGlobalNumericDeltaClass(
                  p.championGlobalNumericDelta(row.championId, 'avgDamageToChamps')!
                )
              "
              :title="
                p.t('statisticsPage.tierListPatchDeltaTitle', {
                  ref: p.championGlobalPatchDeltaRefLabel,
                })
              "
              >{{
                p.formatChampionGlobalNumericDelta(
                  p.championGlobalNumericDelta(row.championId, 'avgDamageToChamps')!
                )
              }}</span
            >
          </div>
          <div
            v-show="p.showChampionDealtColumns && showChampionDealtBreakdown"
            class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
          >
            <span class="font-medium text-amber-300">{{
              p.formatChampionGlobalNum(row.avgDamageToChampsPhys)
            }}</span>
            <span
              v-if="
                p.championGlobalPatchDeltaRefLabel &&
                p.championGlobalNumericDelta(row.championId, 'avgDamageToChampsPhys') != null
              "
              class="text-[10px] leading-none"
              :class="
                p.championGlobalNumericDeltaClass(
                  p.championGlobalNumericDelta(row.championId, 'avgDamageToChampsPhys')!
                )
              "
              :title="
                p.t('statisticsPage.tierListPatchDeltaTitle', {
                  ref: p.championGlobalPatchDeltaRefLabel,
                })
              "
              >{{
                p.formatChampionGlobalNumericDelta(
                  p.championGlobalNumericDelta(row.championId, 'avgDamageToChampsPhys')!
                )
              }}</span
            >
          </div>
          <div
            v-show="p.showChampionDealtColumns && showChampionDealtBreakdown"
            class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
          >
            <span class="font-medium text-violet-300">{{
              p.formatChampionGlobalNum(row.avgDamageToChampsMagic)
            }}</span>
            <span
              v-if="
                p.championGlobalPatchDeltaRefLabel &&
                p.championGlobalNumericDelta(row.championId, 'avgDamageToChampsMagic') != null
              "
              class="text-[10px] leading-none"
              :class="
                p.championGlobalNumericDeltaClass(
                  p.championGlobalNumericDelta(row.championId, 'avgDamageToChampsMagic')!
                )
              "
              :title="
                p.t('statisticsPage.tierListPatchDeltaTitle', {
                  ref: p.championGlobalPatchDeltaRefLabel,
                })
              "
              >{{
                p.formatChampionGlobalNumericDelta(
                  p.championGlobalNumericDelta(row.championId, 'avgDamageToChampsMagic')!
                )
              }}</span
            >
          </div>
          <div
            v-show="p.showChampionDealtColumns && showChampionDealtBreakdown"
            class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
          >
            <span class="font-medium text-slate-200">{{
              p.formatChampionGlobalNum(row.avgDamageToChampsTrue)
            }}</span>
            <span
              v-if="
                p.championGlobalPatchDeltaRefLabel &&
                p.championGlobalNumericDelta(row.championId, 'avgDamageToChampsTrue') != null
              "
              class="text-[10px] leading-none"
              :class="
                p.championGlobalNumericDeltaClass(
                  p.championGlobalNumericDelta(row.championId, 'avgDamageToChampsTrue')!
                )
              "
              :title="
                p.t('statisticsPage.tierListPatchDeltaTitle', {
                  ref: p.championGlobalPatchDeltaRefLabel,
                })
              "
              >{{
                p.formatChampionGlobalNumericDelta(
                  p.championGlobalNumericDelta(row.championId, 'avgDamageToChampsTrue')!
                )
              }}</span
            >
          </div>
          <div
            v-show="p.showChampionTakenColumns"
            class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
          >
            <span class="font-medium">{{
              p.formatChampionGlobalNum(row.avgDamageTakenTotal)
            }}</span>
            <span
              v-if="
                p.championGlobalPatchDeltaRefLabel &&
                p.championGlobalNumericDelta(row.championId, 'avgDamageTakenTotal') != null
              "
              class="text-[10px] leading-none"
              :class="
                p.championGlobalNumericDeltaClass(
                  p.championGlobalNumericDelta(row.championId, 'avgDamageTakenTotal')!,
                  true
                )
              "
              :title="
                p.t('statisticsPage.tierListPatchDeltaTitle', {
                  ref: p.championGlobalPatchDeltaRefLabel,
                })
              "
              >{{
                p.formatChampionGlobalNumericDelta(
                  p.championGlobalNumericDelta(row.championId, 'avgDamageTakenTotal')!
                )
              }}</span
            >
          </div>
          <div
            v-show="p.showChampionTakenColumns && showChampionTakenBreakdown"
            class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
          >
            <span class="font-medium text-amber-300">{{
              p.formatChampionGlobalNum(row.avgDamageTakenPhys)
            }}</span>
            <span
              v-if="
                p.championGlobalPatchDeltaRefLabel &&
                p.championGlobalNumericDelta(row.championId, 'avgDamageTakenPhys') != null
              "
              class="text-[10px] leading-none"
              :class="
                p.championGlobalNumericDeltaClass(
                  p.championGlobalNumericDelta(row.championId, 'avgDamageTakenPhys')!,
                  true
                )
              "
              :title="
                p.t('statisticsPage.tierListPatchDeltaTitle', {
                  ref: p.championGlobalPatchDeltaRefLabel,
                })
              "
              >{{
                p.formatChampionGlobalNumericDelta(
                  p.championGlobalNumericDelta(row.championId, 'avgDamageTakenPhys')!
                )
              }}</span
            >
          </div>
          <div
            v-show="p.showChampionTakenColumns && showChampionTakenBreakdown"
            class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
          >
            <span class="font-medium text-violet-300">{{
              p.formatChampionGlobalNum(row.avgDamageTakenMagic)
            }}</span>
            <span
              v-if="
                p.championGlobalPatchDeltaRefLabel &&
                p.championGlobalNumericDelta(row.championId, 'avgDamageTakenMagic') != null
              "
              class="text-[10px] leading-none"
              :class="
                p.championGlobalNumericDeltaClass(
                  p.championGlobalNumericDelta(row.championId, 'avgDamageTakenMagic')!,
                  true
                )
              "
              :title="
                p.t('statisticsPage.tierListPatchDeltaTitle', {
                  ref: p.championGlobalPatchDeltaRefLabel,
                })
              "
              >{{
                p.formatChampionGlobalNumericDelta(
                  p.championGlobalNumericDelta(row.championId, 'avgDamageTakenMagic')!
                )
              }}</span
            >
          </div>
          <div
            v-show="p.showChampionTakenColumns && showChampionTakenBreakdown"
            class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
          >
            <span class="font-medium text-slate-200">{{
              p.formatChampionGlobalNum(row.avgDamageTakenTrue)
            }}</span>
            <span
              v-if="
                p.championGlobalPatchDeltaRefLabel &&
                p.championGlobalNumericDelta(row.championId, 'avgDamageTakenTrue') != null
              "
              class="text-[10px] leading-none"
              :class="
                p.championGlobalNumericDeltaClass(
                  p.championGlobalNumericDelta(row.championId, 'avgDamageTakenTrue')!,
                  true
                )
              "
              :title="
                p.t('statisticsPage.tierListPatchDeltaTitle', {
                  ref: p.championGlobalPatchDeltaRefLabel,
                })
              "
              >{{
                p.formatChampionGlobalNumericDelta(
                  p.championGlobalNumericDelta(row.championId, 'avgDamageTakenTrue')!
                )
              }}</span
            >
          </div>
          <div
            class="tier-list-lolalytics-td flex w-40 shrink-0 flex-col items-center justify-center gap-0.5 font-mono text-[13px] leading-tight"
          >
            <span class="font-semibold">
              {{ p.formatChampionGlobalNum(row.avgKills) }} /
              {{ p.formatChampionGlobalNum(row.avgDeaths) }} /
              {{ p.formatChampionGlobalNum(row.avgAssists) }}
            </span>
            <span
              v-if="p.championGlobalPatchDeltaRefLabel"
              class="text-[10px] leading-none text-text/75"
            >
              <span
                :class="
                  p.championGlobalNumericDeltaClass(
                    p.championGlobalNumericDelta(row.championId, 'avgKills') ?? 0
                  )
                "
                >K
                {{
                  p.formatChampionGlobalNumericDelta(
                    p.championGlobalNumericDelta(row.championId, 'avgKills') ?? 0
                  )
                }}</span
              >
              <span class="px-1 text-text/45">|</span>
              <span
                :class="
                  p.championGlobalNumericDeltaClass(
                    p.championGlobalNumericDelta(row.championId, 'avgDeaths') ?? 0,
                    true
                  )
                "
                >D
                {{
                  p.formatChampionGlobalNumericDelta(
                    p.championGlobalNumericDelta(row.championId, 'avgDeaths') ?? 0
                  )
                }}</span
              >
              <span class="px-1 text-text/45">|</span>
              <span
                :class="
                  p.championGlobalNumericDeltaClass(
                    p.championGlobalNumericDelta(row.championId, 'avgAssists') ?? 0
                  )
                "
                >A
                {{
                  p.formatChampionGlobalNumericDelta(
                    p.championGlobalNumericDelta(row.championId, 'avgAssists') ?? 0
                  )
                }}</span
              >
            </span>
            <span v-else class="text-[10px] leading-none text-text/55">—</span>
          </div>
        </div>
        <div
          v-if="p.totalChampionGlobalCount > 0"
          class="border-p.t flex flex-wrap items-center justify-between gap-2 border-primary/20 px-4 py-2 text-sm text-text/80"
        >
          <span>{{ p.t('statisticsPage.showing') }} {{ p.totalChampionGlobalCount }}</span>
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-1.5">
              <span class="text-text/70">{{ p.t('statisticsPage.perPage') }}</span>
              <select
                :value="p.championsPageSize"
                class="rounded border border-primary/40 bg-background px-2 py-1 text-text"
                @change="onChampionPageSizeChange"
              >
                <option v-for="n in p.PAGE_SIZE_OPTIONS" :key="n" :value="n">{{ n }}</option>
              </select>
            </label>
            <span class="text-text/70">
              {{ (p.championGlobalPage - 1) * p.championsPageSize + 1 }}-{{
                Math.min(p.championGlobalPage * p.championsPageSize, p.totalChampionGlobalCount)
              }}
              / {{ p.totalChampionGlobalCount }}
            </span>
            <div class="flex gap-1">
              <button
                type="button"
                class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                :disabled="p.championGlobalPage <= 1"
                @click="p.onChampionGlobalPageUpdated(Math.max(1, p.championGlobalPage - 1))"
              >
                ‹
              </button>
              <button
                type="button"
                class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                :disabled="p.championGlobalPage >= p.totalChampionGlobalPages"
                @click="
                  p.onChampionGlobalPageUpdated(
                    Math.min(p.totalChampionGlobalPages, p.championGlobalPage + 1)
                  )
                "
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
