<script setup lang="ts">
import { inject } from 'vue'

const p = inject('statisticsPageCtx') as any
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
        class="tier-list-lolalytics champion-global-table text-[11px] text-text-primary/90"
        :style="{ minWidth: p.championGlobalTableMinWidthPx + 'px' }"
      >
        <div
          class="tier-list-lolalytics-head sticky top-0 z-10 flex h-auto min-h-8 w-full flex-nowrap items-stretch justify-start border-b border-black bg-[var(--color-grey-300)] text-text-primary/85"
        >
          <button
            type="button"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-[220px] shrink-0 cursor-pointer items-center justify-start border-b border-black px-2 hover:bg-primary/25"
            @click="p.setChampionGlobalSort('champion')"
          >
            {{ p.t('statisticsPage.tierListColChampion')
            }}{{ p.championGlobalSortIcon('champion') }}
          </button>
          <template v-if="p.championGlobalExpandBlue">
            <button
              type="button"
              class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 w-7 shrink-0 cursor-pointer items-center justify-center border-b border-l border-black border-sky-400/45 text-[11px] hover:bg-primary/30"
              :title="p.t('statisticsPage.championTableCollapseGroup')"
              @click="p.championGlobalExpandBlue = false"
            >
              ◀
            </button>
            <div
              class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex w-12 shrink-0 flex-col justify-stretch border-b border-black py-0.5"
            >
              <button
                type="button"
                class="flex flex-1 flex-col items-center justify-center px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
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
                class="border-p.t flex flex-1 flex-col items-center justify-center border-black/20 px-0.5 pt-0.5 text-center text-[8px] leading-tight text-text/75 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('blueWinrateDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('blueWinrateDelta') }}
              </button>
            </div>
            <div
              class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex w-12 shrink-0 flex-col justify-stretch border-b border-black py-0.5"
            >
              <button
                type="button"
                class="flex flex-1 flex-col items-center justify-center px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
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
                class="border-p.t flex flex-1 flex-col items-center justify-center border-black/20 px-0.5 pt-0.5 text-center text-[8px] leading-tight text-text/75 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('bluePickrateDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('bluePickrateDelta') }}
              </button>
            </div>
          </template>
          <button
            v-else
            type="button"
            class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex h-8 w-[68px] shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-l border-black border-sky-400/45 px-0.5 text-center text-[9px] font-semibold leading-tight text-sky-200/90 hover:bg-primary/25"
            :title="p.t('statisticsPage.championTableExpandGroup')"
            @click="p.championGlobalExpandBlue = true"
          >
            <span>{{ p.t('statisticsPage.championTableGroupBlue') }}</span>
            <span class="text-[10px] text-text/80">▶</span>
          </button>
          <template v-if="p.championGlobalExpandRed">
            <button
              type="button"
              class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 w-7 shrink-0 cursor-pointer items-center justify-center border-b border-l border-black border-red-400/45 text-[11px] hover:bg-primary/30"
              :title="p.t('statisticsPage.championTableCollapseGroup')"
              @click="p.championGlobalExpandRed = false"
            >
              ◀
            </button>
            <div
              class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex w-12 shrink-0 flex-col justify-stretch border-b border-black py-0.5"
            >
              <button
                type="button"
                class="flex flex-1 flex-col items-center justify-center px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
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
                class="border-p.t flex flex-1 flex-col items-center justify-center border-black/20 px-0.5 pt-0.5 text-center text-[8px] leading-tight text-text/75 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('redWinrateDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('redWinrateDelta') }}
              </button>
            </div>
            <div
              class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex w-12 shrink-0 flex-col justify-stretch border-b border-black py-0.5"
            >
              <button
                type="button"
                class="flex flex-1 flex-col items-center justify-center px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
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
                class="border-p.t flex flex-1 flex-col items-center justify-center border-black/20 px-0.5 pt-0.5 text-center text-[8px] leading-tight text-text/75 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('redPickrateDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('redPickrateDelta') }}
              </button>
            </div>
          </template>
          <button
            v-else
            type="button"
            class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex h-8 w-[68px] shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-l border-black border-red-400/45 px-0.5 text-center text-[9px] font-semibold leading-tight text-red-200/90 hover:bg-primary/25"
            :title="p.t('statisticsPage.championTableExpandGroup')"
            @click="p.championGlobalExpandRed = true"
          >
            <span>{{ p.t('statisticsPage.championTableGroupRed') }}</span>
            <span class="text-[10px] text-text/80">▶</span>
          </button>
          <template v-if="p.championGlobalExpandDealt">
            <button
              type="button"
              class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex h-8 w-7 shrink-0 cursor-pointer items-center justify-center border-b border-l border-black border-white/25 text-[11px] hover:bg-primary/30"
              :title="p.t('statisticsPage.championTableCollapseGroup')"
              @click="p.championGlobalExpandDealt = false"
            >
              ◀
            </button>
            <button
              type="button"
              class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex h-8 w-10 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-black px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
              :title="p.t('statisticsPage.championTableTooltipDealt')"
              @click="p.setChampionGlobalSort('dmgTotal')"
            >
              {{ p.t('statisticsPage.championTableColTotal')
              }}{{ p.championGlobalSortIcon('dmgTotal') }}
            </button>
            <button
              type="button"
              class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex h-8 w-10 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-black px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
              :title="p.t('statisticsPage.championTableDealtPhys')"
              @click="p.setChampionGlobalSort('dmgPhys')"
            >
              {{ p.t('statisticsPage.championTableColPhys')
              }}{{ p.championGlobalSortIcon('dmgPhys') }}
            </button>
            <button
              type="button"
              class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex h-8 w-10 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-black px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
              :title="p.t('statisticsPage.championTableDealtMagic')"
              @click="p.setChampionGlobalSort('dmgMagic')"
            >
              {{ p.t('statisticsPage.championTableColMagic')
              }}{{ p.championGlobalSortIcon('dmgMagic') }}
            </button>
            <button
              type="button"
              class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex h-8 w-10 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-black px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
              :title="p.t('statisticsPage.championTableDealtTrue')"
              @click="p.setChampionGlobalSort('dmgTrue')"
            >
              {{ p.t('statisticsPage.championTableColBrut')
              }}{{ p.championGlobalSortIcon('dmgTrue') }}
            </button>
          </template>
          <button
            v-else
            type="button"
            class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex h-8 w-[68px] shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-l border-black border-white/25 px-0.5 text-center text-[9px] font-semibold leading-tight hover:bg-primary/25"
            :title="p.t('statisticsPage.championTableExpandGroup')"
            @click="p.championGlobalExpandDealt = true"
          >
            <span>{{ p.t('statisticsPage.championTableGroupDealt') }}</span>
            <span class="text-[10px] text-text/80">▶</span>
          </button>
          <template v-if="p.championGlobalExpandTaken">
            <button
              type="button"
              class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex h-8 w-7 shrink-0 cursor-pointer items-center justify-center border-b border-l border-black border-white/25 text-[11px] hover:bg-primary/30"
              :title="p.t('statisticsPage.championTableCollapseGroup')"
              @click="p.championGlobalExpandTaken = false"
            >
              ◀
            </button>
            <button
              type="button"
              class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex h-8 w-10 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-black px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
              :title="p.t('statisticsPage.championTableTooltipTaken')"
              @click="p.setChampionGlobalSort('takenTotal')"
            >
              {{ p.t('statisticsPage.championTableColTotal')
              }}{{ p.championGlobalSortIcon('takenTotal') }}
            </button>
            <button
              type="button"
              class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex h-8 w-10 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-black px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
              :title="p.t('statisticsPage.championTableTakenPhys')"
              @click="p.setChampionGlobalSort('takenPhys')"
            >
              {{ p.t('statisticsPage.championTableColPhys')
              }}{{ p.championGlobalSortIcon('takenPhys') }}
            </button>
            <button
              type="button"
              class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex h-8 w-10 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-black px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
              :title="p.t('statisticsPage.championTableTakenMagic')"
              @click="p.setChampionGlobalSort('takenMagic')"
            >
              {{ p.t('statisticsPage.championTableColMagic')
              }}{{ p.championGlobalSortIcon('takenMagic') }}
            </button>
            <button
              type="button"
              class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex h-8 w-10 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-black px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
              :title="p.t('statisticsPage.championTableTakenTrue')"
              @click="p.setChampionGlobalSort('takenTrue')"
            >
              {{ p.t('statisticsPage.championTableColBrut')
              }}{{ p.championGlobalSortIcon('takenTrue') }}
            </button>
          </template>
          <button
            v-else
            type="button"
            class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex h-8 w-[68px] shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-l border-black border-white/25 px-0.5 text-center text-[9px] font-semibold leading-tight hover:bg-primary/25"
            :title="p.t('statisticsPage.championTableExpandGroup')"
            @click="p.championGlobalExpandTaken = true"
          >
            <span>{{ p.t('statisticsPage.championTableGroupTaken') }}</span>
            <span class="text-[10px] text-text/80">▶</span>
          </button>
          <template v-if="p.championGlobalExpandKda">
            <button
              type="button"
              class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex h-8 w-7 shrink-0 cursor-pointer items-center justify-center border-b border-l border-black border-white/25 text-[11px] hover:bg-primary/30"
              :title="p.t('statisticsPage.championTableCollapseGroup')"
              @click="p.championGlobalExpandKda = false"
            >
              ◀
            </button>
            <button
              type="button"
              class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex h-8 w-9 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-black px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
              :title="p.t('statisticsPage.championTableTooltipKda')"
              @click="p.setChampionGlobalSort('kills')"
            >
              {{ p.t('statisticsPage.championTableColKill')
              }}{{ p.championGlobalSortIcon('kills') }}
            </button>
            <button
              type="button"
              class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex h-8 w-9 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-black px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
              @click="p.setChampionGlobalSort('deaths')"
            >
              {{ p.t('statisticsPage.championTableColDeath')
              }}{{ p.championGlobalSortIcon('deaths') }}
            </button>
            <button
              type="button"
              class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex h-8 w-9 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-black px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
              @click="p.setChampionGlobalSort('assists')"
            >
              {{ p.t('statisticsPage.championTableColAssist')
              }}{{ p.championGlobalSortIcon('assists') }}
            </button>
          </template>
          <button
            v-else
            type="button"
            class="tier-list-lolalytics-th border-p.t border-p.t-[var(--color-grey-300)] flex h-8 w-[68px] shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-l border-black border-white/25 px-0.5 text-center text-[9px] font-semibold leading-tight hover:bg-primary/25"
            :title="p.t('statisticsPage.championTableExpandGroup')"
            @click="p.championGlobalExpandKda = true"
          >
            <span>{{ p.t('statisticsPage.championTableGroupKda') }}</span>
            <span class="text-[10px] text-text/80">▶</span>
          </button>
        </div>
        <div
          v-for="row in p.championGlobalSortedRows"
          :key="row.championId"
          class="tier-list-lolalytics-row flex min-h-[72px] w-full flex-nowrap items-center justify-start py-0.5 odd:bg-white/[0.04] even:bg-black/25"
        >
          <div class="tier-list-lolalytics-td flex w-[220px] shrink-0 items-center gap-2 px-2">
            <img
              v-if="p.gameVersion && p.championByKey(row.championId)"
              :src="
                p.getChampionImageUrl(p.gameVersion, p.championByKey(row.championId)!.image.full)
              "
              :alt="p.championName(row.championId) || ''"
              class="h-[50px] w-[50px] shrink-0 border-2 border-black object-cover"
              width="50"
              height="50"
            />
            <span class="min-w-0 truncate text-left font-medium text-accent">{{
              p.championName(row.championId) || row.championId
            }}</span>
          </div>
          <template v-if="p.championGlobalExpandBlue">
            <div
              class="tier-list-lolalytics-td w-7 shrink-0 border-l border-sky-400/35"
              aria-hidden="true"
            />
            <div
              class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
            >
              <span
                :class="row.blue.games ? p.tierListWinrateClass(row.blue.winrate) : 'text-text/55'"
                >{{ row.blue.games ? row.blue.winrate.toFixed(2) : '—' }}</span
              >
              <span
                v-if="
                  p.championGlobalPatchDeltaRefLabel &&
                  p.championGlobalSideStatDeltaPp(row.championId, 'blue', 'winrate') != null
                "
                class="text-[10px] leading-none"
                :class="
                  p.tierListPatchDeltaClass(
                    p.championGlobalSideStatDeltaPp(row.championId, 'blue', 'winrate')!
                  )
                "
                :title="
                  p.t('statisticsPage.tierListPatchDeltaTitle', {
                    ref: p.championGlobalPatchDeltaRefLabel,
                  })
                "
                >{{
                  p.formatTierListPatchDeltaPp(
                    p.championGlobalSideStatDeltaPp(row.championId, 'blue', 'winrate')!
                  )
                }}</span
              >
            </div>
            <div
              class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
            >
              <span
                :class="
                  row.blue.games ? p.championGlobalPickrateClass(row.blue.pickrate) : 'text-text/55'
                "
                >{{ row.blue.games ? row.blue.pickrate.toFixed(2) : '—' }}</span
              >
              <span
                v-if="
                  p.championGlobalPatchDeltaRefLabel &&
                  p.championGlobalSideStatDeltaPp(row.championId, 'blue', 'pickrate') != null
                "
                class="text-[10px] leading-none"
                :class="
                  p.tierListPatchDeltaClass(
                    p.championGlobalSideStatDeltaPp(row.championId, 'blue', 'pickrate')!
                  )
                "
                :title="
                  p.t('statisticsPage.tierListPatchDeltaTitle', {
                    ref: p.championGlobalPatchDeltaRefLabel,
                  })
                "
                >{{
                  p.formatTierListPatchDeltaPp(
                    p.championGlobalSideStatDeltaPp(row.championId, 'blue', 'pickrate')!
                  )
                }}</span
              >
            </div>
          </template>
          <div
            v-else
            class="tier-list-lolalytics-td w-[68px] shrink-0 border-l border-sky-400/35"
            aria-hidden="true"
          />
          <template v-if="p.championGlobalExpandRed">
            <div
              class="tier-list-lolalytics-td w-7 shrink-0 border-l border-red-400/40"
              aria-hidden="true"
            />
            <div
              class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
            >
              <span
                :class="row.red.games ? p.tierListWinrateClass(row.red.winrate) : 'text-text/55'"
                >{{ row.red.games ? row.red.winrate.toFixed(2) : '—' }}</span
              >
              <span
                v-if="
                  p.championGlobalPatchDeltaRefLabel &&
                  p.championGlobalSideStatDeltaPp(row.championId, 'red', 'winrate') != null
                "
                class="text-[10px] leading-none"
                :class="
                  p.tierListPatchDeltaClass(
                    p.championGlobalSideStatDeltaPp(row.championId, 'red', 'winrate')!
                  )
                "
                :title="
                  p.t('statisticsPage.tierListPatchDeltaTitle', {
                    ref: p.championGlobalPatchDeltaRefLabel,
                  })
                "
                >{{
                  p.formatTierListPatchDeltaPp(
                    p.championGlobalSideStatDeltaPp(row.championId, 'red', 'winrate')!
                  )
                }}</span
              >
            </div>
            <div
              class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
            >
              <span
                :class="
                  row.red.games ? p.championGlobalPickrateClass(row.red.pickrate) : 'text-text/55'
                "
                >{{ row.red.games ? row.red.pickrate.toFixed(2) : '—' }}</span
              >
              <span
                v-if="
                  p.championGlobalPatchDeltaRefLabel &&
                  p.championGlobalSideStatDeltaPp(row.championId, 'red', 'pickrate') != null
                "
                class="text-[10px] leading-none"
                :class="
                  p.tierListPatchDeltaClass(
                    p.championGlobalSideStatDeltaPp(row.championId, 'red', 'pickrate')!
                  )
                "
                :title="
                  p.t('statisticsPage.tierListPatchDeltaTitle', {
                    ref: p.championGlobalPatchDeltaRefLabel,
                  })
                "
                >{{
                  p.formatTierListPatchDeltaPp(
                    p.championGlobalSideStatDeltaPp(row.championId, 'red', 'pickrate')!
                  )
                }}</span
              >
            </div>
          </template>
          <div
            v-else
            class="tier-list-lolalytics-td w-[68px] shrink-0 border-l border-red-400/40"
            aria-hidden="true"
          />
          <template v-if="p.championGlobalExpandDealt">
            <div
              class="tier-list-lolalytics-td w-7 shrink-0 border-l border-white/20"
              aria-hidden="true"
            />
            <div
              class="tier-list-lolalytics-td flex w-10 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
            >
              <span>{{ p.formatChampionGlobalNum(row.avgDamageToChamps) }}</span>
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
              class="tier-list-lolalytics-td flex w-10 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
            >
              <span>{{ p.formatChampionGlobalNum(row.avgDamageToChampsPhys) }}</span>
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
              class="tier-list-lolalytics-td flex w-10 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
            >
              <span>{{ p.formatChampionGlobalNum(row.avgDamageToChampsMagic) }}</span>
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
              class="tier-list-lolalytics-td flex w-10 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
            >
              <span>{{ p.formatChampionGlobalNum(row.avgDamageToChampsTrue) }}</span>
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
          </template>
          <div
            v-else
            class="tier-list-lolalytics-td w-[68px] shrink-0 border-l border-white/20"
            aria-hidden="true"
          />
          <template v-if="p.championGlobalExpandTaken">
            <div
              class="tier-list-lolalytics-td w-7 shrink-0 border-l border-white/20"
              aria-hidden="true"
            />
            <div
              class="tier-list-lolalytics-td flex w-10 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
            >
              <span>{{ p.formatChampionGlobalNum(row.avgDamageTakenTotal) }}</span>
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
              class="tier-list-lolalytics-td flex w-10 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
            >
              <span>{{ p.formatChampionGlobalNum(row.avgDamageTakenPhys) }}</span>
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
              class="tier-list-lolalytics-td flex w-10 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
            >
              <span>{{ p.formatChampionGlobalNum(row.avgDamageTakenMagic) }}</span>
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
              class="tier-list-lolalytics-td flex w-10 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
            >
              <span>{{ p.formatChampionGlobalNum(row.avgDamageTakenTrue) }}</span>
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
          </template>
          <div
            v-else
            class="tier-list-lolalytics-td w-[68px] shrink-0 border-l border-white/20"
            aria-hidden="true"
          />
          <template v-if="p.championGlobalExpandKda">
            <div
              class="tier-list-lolalytics-td w-7 shrink-0 border-l border-white/20"
              aria-hidden="true"
            />
            <div
              class="tier-list-lolalytics-td flex w-9 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
            >
              <span>{{ p.formatChampionGlobalNum(row.avgKills) }}</span>
              <span
                v-if="
                  p.championGlobalPatchDeltaRefLabel &&
                  p.championGlobalNumericDelta(row.championId, 'avgKills') != null
                "
                class="text-[10px] leading-none"
                :class="
                  p.championGlobalNumericDeltaClass(
                    p.championGlobalNumericDelta(row.championId, 'avgKills')!
                  )
                "
                :title="
                  p.t('statisticsPage.tierListPatchDeltaTitle', {
                    ref: p.championGlobalPatchDeltaRefLabel,
                  })
                "
                >{{
                  p.formatChampionGlobalNumericDelta(
                    p.championGlobalNumericDelta(row.championId, 'avgKills')!
                  )
                }}</span
              >
            </div>
            <div
              class="tier-list-lolalytics-td flex w-9 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
            >
              <span>{{ p.formatChampionGlobalNum(row.avgDeaths) }}</span>
              <span
                v-if="
                  p.championGlobalPatchDeltaRefLabel &&
                  p.championGlobalNumericDelta(row.championId, 'avgDeaths') != null
                "
                class="text-[10px] leading-none"
                :class="
                  p.championGlobalNumericDeltaClass(
                    p.championGlobalNumericDelta(row.championId, 'avgDeaths')!,
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
                    p.championGlobalNumericDelta(row.championId, 'avgDeaths')!
                  )
                }}</span
              >
            </div>
            <div
              class="tier-list-lolalytics-td flex w-9 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
            >
              <span>{{ p.formatChampionGlobalNum(row.avgAssists) }}</span>
              <span
                v-if="
                  p.championGlobalPatchDeltaRefLabel &&
                  p.championGlobalNumericDelta(row.championId, 'avgAssists') != null
                "
                class="text-[10px] leading-none"
                :class="
                  p.championGlobalNumericDeltaClass(
                    p.championGlobalNumericDelta(row.championId, 'avgAssists')!
                  )
                "
                :title="
                  p.t('statisticsPage.tierListPatchDeltaTitle', {
                    ref: p.championGlobalPatchDeltaRefLabel,
                  })
                "
                >{{
                  p.formatChampionGlobalNumericDelta(
                    p.championGlobalNumericDelta(row.championId, 'avgAssists')!
                  )
                }}</span
              >
            </div>
          </template>
          <div
            v-else
            class="tier-list-lolalytics-td w-[68px] shrink-0 border-l border-white/20"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  </div>
</template>
