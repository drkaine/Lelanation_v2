<template>
  <div class="space-y-2">
    <div v-if="p.overviewPending || p.infosMatrixPending" class="text-text/70">
      {{ p.t('statisticsPage.loading') }}
    </div>
    <div v-else-if="p.overviewError" class="rounded border border-error bg-surface p-3 text-error">
      {{ p.overviewError }}
    </div>
    <div
      v-else-if="p.infosMatrixError"
      class="rounded border border-error bg-surface p-3 text-error"
    >
      {{ p.infosMatrixError }}
    </div>
    <div v-else class="space-y-3">
      <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
        <h3 class="text-sm font-semibold text-text">
          {{ p.t('statisticsPage.balanceRulesTitle') }}
        </h3>
        <p class="mt-1 text-xs text-text/70">
          {{
            p.t('statisticsPage.balanceRulesSubtitle', {
              patch: p.balanceFrameworkData?.currentPatch || '—',
            })
          }}
        </p>
        <div
          v-if="p.balanceFrameworkData?.rules"
          class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3"
        >
          <div class="rounded border border-primary/20 bg-background/40 p-3 text-xs text-text/80">
            <div class="font-semibold text-text">Average</div>
            <div class="mt-1">
              OP: WR ≥ {{ p.balanceFrameworkData.rules.levels.average.overpowered.winrateHigh }}%
              (ou {{ p.balanceFrameworkData.rules.levels.average.overpowered.winrateLow }}% si
              banrate ≥
              {{ p.balanceFrameworkData.rules.levels.average.overpowered.banrateMultiplier }}x ABR)
            </div>
            <div>
              UP: WR &lt; {{ p.balanceFrameworkData.rules.levels.average.underpowered.winrateMax }}%
            </div>
          </div>
          <div class="rounded border border-primary/20 bg-background/40 p-3 text-xs text-text/80">
            <div class="font-semibold text-text">Skilled</div>
            <div class="mt-1">
              OP: WR ≥ {{ p.balanceFrameworkData.rules.levels.skilled.overpowered.winrateHigh }}%
              (ou {{ p.balanceFrameworkData.rules.levels.skilled.overpowered.winrateLow }}% si
              banrate ≥
              {{ p.balanceFrameworkData.rules.levels.skilled.overpowered.banrateMultiplier }}x ABR)
            </div>
            <div>
              UP: WR &lt; {{ p.balanceFrameworkData.rules.levels.skilled.underpowered.winrateMax }}%
            </div>
          </div>
          <div class="rounded border border-primary/20 bg-background/40 p-3 text-xs text-text/80">
            <div class="font-semibold text-text">Elite</div>
            <div class="mt-1">
              OP: WR ≥ {{ p.balanceFrameworkData.rules.levels.elite.overpowered.winrateHigh }}% (ou
              {{ p.balanceFrameworkData.rules.levels.elite.overpowered.winrateLow }}% si banrate ≥
              {{ p.balanceFrameworkData.rules.levels.elite.overpowered.banrateMultiplier }}x ABR)
            </div>
            <div>
              OP: banrate moyen (patch courant + précédent) ≥
              {{ p.balanceFrameworkData.rules.levels.elite.overpowered.banrateTwoPatchAvgMin }}%
            </div>
            <div>
              UP: présence (pick + ban) &lt;
              {{ p.balanceFrameworkData.rules.levels.elite.underpowered.presenceMax }}%
            </div>
          </div>
        </div>
      </div>
      <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
        <h3 class="text-sm font-semibold text-text">
          {{ p.t('statisticsPage.balanceAbbreviationsTitle') }}
        </h3>
        <div class="mt-2 grid grid-cols-1 gap-1 text-xs text-text/80 md:grid-cols-2">
          <p>
            <span class="font-semibold text-text">OP</span>:
            {{ p.t('statisticsPage.balanceAbbrevOp') }}
          </p>
          <p>
            <span class="font-semibold text-text">UP</span>:
            {{ p.t('statisticsPage.balanceAbbrevUp') }}
          </p>
          <p>
            <span class="font-semibold text-text">WR</span>:
            {{ p.t('statisticsPage.balanceAbbrevWr') }}
          </p>
          <p>
            <span class="font-semibold text-text">BR</span>:
            {{ p.t('statisticsPage.balanceAbbrevBr') }}
          </p>
          <p>
            <span class="font-semibold text-text">PR</span>:
            {{ p.t('statisticsPage.balanceAbbrevPr') }}
          </p>
          <p>
            <span class="font-semibold text-text">PRÉS</span>:
            {{ p.t('statisticsPage.balanceAbbrevPresence') }}
          </p>
          <p>
            <span class="font-semibold text-text">ABR</span>:
            {{ p.t('statisticsPage.balanceAbbrevAbr') }}
          </p>
          <p>
            <span class="font-semibold text-text">Δ</span>:
            {{ p.t('statisticsPage.balanceAbbrevDelta') }}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-2 md:grid-cols-3">
        <div class="rounded-lg border border-primary/30 bg-surface/30 p-3">
          <div class="text-xs text-text/70">{{ p.t('statisticsPage.overviewTotalMatches') }}</div>
          <div class="text-lg font-semibold text-text">
            {{
              (p.infosMetaData?.totalMatches ?? p.overviewData?.totalMatches ?? 0).toLocaleString()
            }}
          </div>
        </div>
        <div class="rounded-lg border border-primary/30 bg-surface/30 p-3">
          <div class="text-xs text-text/70">
            {{ p.t('statisticsPage.overviewPlayerCountDistinct') }}
          </div>
          <div class="text-lg font-semibold text-text">
            {{
              (p.infosMetaData?.totalPlayers ?? p.overviewData?.playerCount ?? 0).toLocaleString()
            }}
          </div>
        </div>
        <div class="rounded-lg border border-primary/30 bg-surface/30 p-3">
          <div class="text-xs text-text/70">
            {{ p.t('statisticsPage.overviewPlayersWithoutLastSeen') }}
          </div>
          <div class="text-lg font-semibold text-text">
            {{ (p.infosMetaData?.playersWithoutLastSeen ?? 0).toLocaleString() }}
          </div>
        </div>
      </div>

      <div class="overflow-x-auto rounded-lg border border-primary/30 bg-surface/30 p-1">
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead class="border-b border-primary/30 bg-surface/50">
            <tr>
              <th
                scope="col"
                class="w-12 px-2 py-1.5 text-center font-semibold text-text"
                :title="p.t('statisticsPage.infosMatrixPatchHeader')"
              >
                {{ p.t('statisticsPage.infosMatrixPatchHeader') }}
              </th>
              <th
                v-for="division in p.infosMatrixColumns ?? []"
                :key="'infos-col-' + division"
                scope="col"
                class="px-2 py-1.5 text-center font-semibold text-text"
                :title="
                  division === 'ALL'
                    ? p.t('statisticsPage.overviewVersionAll')
                    : p.formatDivisionLabel(division)
                "
              >
                <span class="sr-only">{{
                  division === 'ALL'
                    ? p.t('statisticsPage.overviewVersionAll')
                    : p.formatDivisionLabel(division)
                }}</span>
                <div class="flex justify-center">
                  <img
                    v-if="division !== 'ALL' && p.getRankedEmblemUrl(division)"
                    :src="p.getRankedEmblemUrl(division)!"
                    alt=""
                    class="h-5 w-5 object-contain"
                  />
                  <span
                    v-else
                    class="text-[11px] font-semibold uppercase tracking-wide text-text/85"
                  >
                    {{ p.t('statisticsPage.overviewVersionAll') }}
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-primary/20">
            <tr v-for="row in p.infosMatrixRows ?? []" :key="'infos-row-' + row.version">
              <td class="px-3 py-1 font-medium text-text">{{ row.version }}</td>
              <td
                v-for="division in p.infosMatrixColumns ?? []"
                :key="'infos-cell-' + row.version + '-' + division"
                class="px-2 py-1 text-center tabular-nums text-text/90"
              >
                {{ Number(p.infosMatrixCell(row, division)).toLocaleString() }}
              </td>
            </tr>
            <tr v-if="(p.infosMatrixRows ?? []).length === 0">
              <td
                :colspan="(p.infosMatrixColumns ?? []).length + 1"
                class="px-3 py-2 text-center text-text/70"
              >
                {{ p.t('statisticsPage.noData') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'

const p = inject('statisticsPageCtx') as any
</script>
