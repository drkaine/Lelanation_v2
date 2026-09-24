<template>
  <div class="space-y-6">
    <!-- Section 1: Stats collecte -->
    <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
      <h2 class="mb-4 text-lg font-semibold text-text">{{ t('admin.data.stats.title') }}</h2>
      <p v-if="!dataStatsLoading" class="mb-3 text-xs text-text/70">
        <template v-if="dataStats?.adminDataSource === 'statistiques_db'">
          Indicateurs depuis la base statistiques (<code class="text-[11px]"
            >DATABASE_URL_STATISTIQUES</code
          >) : <code class="text-[11px]">players</code> et compteurs issus de
          <code class="text-[11px]">matchs</code> /
          <code class="text-[11px]">match_aggregated</code> (suivi normalisé + ingérés). Cet écran
          ne lit pas la file Prisma <code class="text-[11px]">tracked_matches</code> ni
          <code class="text-[11px]">match_ingest_raw</code>.
        </template>
        <template v-else-if="dataStats?.adminDataSource === 'stats_db'">
          Mode ingestion Prisma (<code class="text-[11px]">DATABASE_URL</code>) : file
          <code class="text-[11px]">tracked_matches</code> et optionnellement
          <code class="text-[11px]">match_ingest_raw</code>. À utiliser seulement si la collecte
          n’est pas encore exposée via
          <code class="text-[11px]">DATABASE_URL_STATISTIQUES</code> (prioritaire pour l’admin).
        </template>
        <template v-else>
          Aucune base configurée : définissez
          <code class="text-[11px]">DATABASE_URL_STATISTIQUES</code> pour les indicateurs courants.
          <code class="text-[11px]">DATABASE_URL</code> reste optionnel pour la file d’ingestion
          legacy.
        </template>
      </p>
      <p v-if="dataStatsLoading" class="text-text/70">Chargement…</p>
      <p v-else-if="dataStatsError" class="mb-3 text-sm text-error">{{ dataStatsError }}</p>
      <template v-else>
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-text/60">Base (DB)</p>
        <div class="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          <div class="rounded border border-primary/20 bg-background/30 p-3">
            <div class="text-xl font-bold text-text">
              {{ dataStats?.totalPlayers ?? '—' }}
            </div>
            <div class="text-xs text-text/70">{{ t('admin.data.stats.totalPlayers') }}</div>
          </div>
          <div class="rounded border border-primary/20 bg-background/30 p-3">
            <div class="text-xl font-bold text-text">
              {{ dataStats?.playersWrongKeyVersion ?? '—' }}
            </div>
            <div class="text-xs text-text/70">Players clé/version différente de la config</div>
          </div>
          <div class="rounded border border-primary/20 bg-background/30 p-3">
            <div class="text-xl font-bold text-text">
              {{ dataStats?.totalTrackedMatches ?? '—' }}
            </div>
            <div class="text-xs text-text/70">
              {{
                dataStats?.adminDataSource === 'statistiques_db'
                  ? 'Total matchs normalisés'
                  : t('admin.data.stats.totalTrackedMatches')
              }}
            </div>
          </div>
          <div class="rounded border border-primary/20 bg-background/30 p-3">
            <div class="text-xl font-bold text-text">
              {{ dataStats?.trackedMatchesCreatedLast1h ?? '—' }}
            </div>
            <div class="text-xs text-text/70">
              {{
                dataStats?.adminDataSource === 'statistiques_db'
                  ? 'matchs créés (1 h)'
                  : t('admin.data.stats.trackedMatches1h')
              }}
            </div>
          </div>
          <div class="rounded border border-primary/20 bg-background/30 p-3">
            <div class="text-xl font-bold text-text">
              {{ dataStats?.playersCreatedLast1h ?? '—' }}
            </div>
            <div class="text-xs text-text/70">{{ t('admin.data.stats.playersCreated1h') }}</div>
          </div>
          <div class="rounded border border-primary/20 bg-background/30 p-3">
            <div class="text-xl font-bold text-text">
              {{ dataStats?.playersLastSeenLast1h ?? '—' }}
            </div>
            <div class="text-xs text-text/70">
              {{ t('admin.data.stats.playersLastSeen1h') }}
            </div>
          </div>
          <div class="rounded border border-primary/20 bg-background/30 p-3">
            <div class="text-xl font-bold text-text">
              {{ dataStats?.playersUpdatedLast1h ?? '—' }}
            </div>
            <div class="text-xs text-text/70">Players updated_at (1h)</div>
          </div>
          <div class="rounded border border-primary/20 bg-background/30 p-3">
            <div class="text-base font-semibold text-text">
              {{ dataStats?.lastNewPlayerAt ? formatRiotDate(dataStats.lastNewPlayerAt) : '—' }}
            </div>
            <div class="text-xs text-text/70">{{ t('admin.data.stats.lastNewPlayerAt') }}</div>
          </div>
          <div class="rounded border border-primary/20 bg-background/30 p-3">
            <div class="text-base font-semibold text-text">
              {{
                dataStats?.lastPlayerLastSeenAt
                  ? formatRiotDate(dataStats.lastPlayerLastSeenAt)
                  : '—'
              }}
            </div>
            <div class="text-xs text-text/70">
              {{ t('admin.data.stats.lastPlayerLastSeen') }}
            </div>
          </div>
          <div class="rounded border border-primary/20 bg-background/30 p-3">
            <div class="text-base font-semibold text-text">
              {{
                dataStats?.lastPlayerUpdatedAt ? formatRiotDate(dataStats.lastPlayerUpdatedAt) : '—'
              }}
            </div>
            <div class="text-xs text-text/70">Dernier player updated_at</div>
          </div>
          <div class="rounded border border-primary/20 bg-background/30 p-3">
            <div class="text-xl font-bold text-text">
              {{ dataStats?.trackedMatchesPendingNow ?? '—' }}
            </div>
            <div class="text-xs text-text/70">
              {{
                dataStats?.adminDataSource === 'statistiques_db'
                  ? 'En attente agrég. (matchs sans match_aggregated)'
                  : 'Tracked pending (now)'
              }}
            </div>
          </div>
          <div class="rounded border border-primary/20 bg-background/30 p-3">
            <div class="text-xl font-bold text-text">
              {{ dataStats?.trackedMatchesPendingOver1h ?? '—' }}
            </div>
            <div class="text-xs text-text/70">
              {{
                dataStats?.adminDataSource === 'statistiques_db'
                  ? 'En attente agrég. > 1 h'
                  : 'Tracked pending &gt; 1h'
              }}
            </div>
          </div>
          <div class="rounded border border-primary/20 bg-background/30 p-3">
            <div class="text-base font-semibold text-text">
              {{
                dataStats?.trackedOldestPendingCreatedAt
                  ? formatRiotDate(dataStats.trackedOldestPendingCreatedAt)
                  : '—'
              }}
            </div>
            <div class="text-xs text-text/70">
              {{
                dataStats?.adminDataSource === 'statistiques_db'
                  ? 'Plus ancien en attente d’agrégation'
                  : 'Plus ancien tracked pending (created_at)'
              }}
            </div>
          </div>
          <div class="rounded border border-primary/20 bg-background/30 p-3">
            <div class="text-xl font-bold text-text">
              {{ dataStats?.trackedMatchesDeferredRankPending ?? '—' }}
            </div>
            <div class="text-xs text-text/70">
              {{
                dataStats?.adminDataSource === 'statistiques_db'
                  ? 'Différés rank (legacy — toujours 0)'
                  : 'Tracked deferred rank (agrégation en attente de tier)'
              }}
            </div>
          </div>
        </div>
        <template v-if="dataStats?.matchIngestRaw">
          <p class="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-text/60">
            Raw queue (match_ingest_raw)
          </p>
          <div class="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div class="rounded border border-primary/20 bg-background/30 p-3">
              <div class="text-xl font-bold text-text">
                {{ dataStats.matchIngestRaw.pending }}
              </div>
              <div class="text-xs text-text/70">Pending</div>
            </div>
            <div class="rounded border border-primary/20 bg-background/30 p-3">
              <div class="text-xl font-bold text-text">
                {{ dataStats.matchIngestRaw.processing }}
              </div>
              <div class="text-xs text-text/70">Processing</div>
            </div>
            <div class="rounded border border-primary/20 bg-background/30 p-3">
              <div class="text-xl font-bold text-text">
                {{ dataStats.matchIngestRaw.error }}
              </div>
              <div class="text-xs text-text/70">Error (tous motifs)</div>
            </div>
            <div class="rounded border border-primary/20 bg-background/30 p-3">
              <div class="text-xl font-bold text-text">
                {{ dataStats.matchIngestRaw.errorRankPending }}
              </div>
              <div class="text-xs text-text/70">Error tracked_rank_pending</div>
            </div>
          </div>
        </template>
      </template>
    </div>

    <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
      <h2 class="mb-3 text-lg font-semibold text-text">Balance Framework Rules</h2>
      <p class="mb-3 text-xs text-text/70">
        Modifie les seuils utilisés par l'onglet statistiques Balance (Average / Skilled / Elite).
      </p>
      <p v-if="balanceRulesLoading" class="text-text/70">Chargement…</p>
      <div v-else class="space-y-4">
        <div class="grid gap-3 md:grid-cols-4">
          <label class="text-xs text-text/80">
            Average WR high
            <input
              v-model.number="balanceRulesForm.averageWinrateHigh"
              type="number"
              step="0.1"
              class="mt-1 w-full rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
            />
          </label>
          <label class="text-xs text-text/80">
            Average WR low
            <input
              v-model.number="balanceRulesForm.averageWinrateLow"
              type="number"
              step="0.1"
              class="mt-1 w-full rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
            />
          </label>
          <label class="text-xs text-text/80">
            Average ban multiplier
            <input
              v-model.number="balanceRulesForm.averageBanrateMultiplier"
              type="number"
              step="0.1"
              class="mt-1 w-full rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
            />
          </label>
          <label class="text-xs text-text/80">
            Average UP WR max
            <input
              v-model.number="balanceRulesForm.averageWinrateMax"
              type="number"
              step="0.1"
              class="mt-1 w-full rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
            />
          </label>
        </div>
        <div class="grid gap-3 md:grid-cols-4">
          <label class="text-xs text-text/80">
            Skilled WR high
            <input
              v-model.number="balanceRulesForm.skilledWinrateHigh"
              type="number"
              step="0.1"
              class="mt-1 w-full rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
            />
          </label>
          <label class="text-xs text-text/80">
            Skilled WR low
            <input
              v-model.number="balanceRulesForm.skilledWinrateLow"
              type="number"
              step="0.1"
              class="mt-1 w-full rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
            />
          </label>
          <label class="text-xs text-text/80">
            Skilled ban multiplier
            <input
              v-model.number="balanceRulesForm.skilledBanrateMultiplier"
              type="number"
              step="0.1"
              class="mt-1 w-full rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
            />
          </label>
          <label class="text-xs text-text/80">
            Skilled UP WR max
            <input
              v-model.number="balanceRulesForm.skilledWinrateMax"
              type="number"
              step="0.1"
              class="mt-1 w-full rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
            />
          </label>
        </div>
        <div class="grid gap-3 md:grid-cols-5">
          <label class="text-xs text-text/80">
            Elite WR high
            <input
              v-model.number="balanceRulesForm.eliteWinrateHigh"
              type="number"
              step="0.1"
              class="mt-1 w-full rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
            />
          </label>
          <label class="text-xs text-text/80">
            Elite WR low
            <input
              v-model.number="balanceRulesForm.eliteWinrateLow"
              type="number"
              step="0.1"
              class="mt-1 w-full rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
            />
          </label>
          <label class="text-xs text-text/80">
            Elite ban multiplier
            <input
              v-model.number="balanceRulesForm.eliteBanrateMultiplier"
              type="number"
              step="0.1"
              class="mt-1 w-full rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
            />
          </label>
          <label class="text-xs text-text/80">
            Elite 2-patch ban min
            <input
              v-model.number="balanceRulesForm.eliteBanrateTwoPatchAvgMin"
              type="number"
              step="0.1"
              class="mt-1 w-full rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
            />
          </label>
          <label class="text-xs text-text/80">
            Elite UP presence max
            <input
              v-model.number="balanceRulesForm.elitePresenceMax"
              type="number"
              step="0.1"
              class="mt-1 w-full rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
            />
          </label>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            :disabled="balanceRulesSaving"
            @click="saveBalanceRules"
          >
            {{ balanceRulesSaving ? '…' : 'Sauvegarder les règles' }}
          </button>
          <button
            type="button"
            class="rounded border border-primary/40 bg-surface/50 px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-primary/20"
            @click="loadBalanceRules"
          >
            Recharger
          </button>
        </div>
        <p
          v-if="balanceRulesMessage"
          :class="
            balanceRulesError ? 'text-sm text-error' : 'text-sm text-green-600 dark:text-green-400'
          "
        >
          {{ balanceRulesMessage }}
        </p>
      </div>
    </div>

    <!-- Section 2: Statut des crons -->
    <div class="rounded-lg border border-primary/30 bg-surface/30">
      <button
        type="button"
        class="flex w-full items-center justify-between p-4 text-left"
        @click="dataSectionCrons = !dataSectionCrons"
      >
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-semibold text-text">{{ t('admin.data.crons.title') }}</h2>
          <button
            type="button"
            class="rounded border border-primary/40 bg-surface/60 px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-primary/20 disabled:opacity-50"
            :disabled="syncDataBusy"
            @click.stop="triggerSyncData"
          >
            {{ syncDataBusy ? '…' : 'Sync données (DDragon + Community + YouTube)' }}
          </button>
        </div>
        <span class="text-text/60">{{ dataSectionCrons ? '▼' : '▶' }}</span>
      </button>
      <div v-show="dataSectionCrons" class="border-t border-primary/20 px-4 pb-4 pt-2">
        <p v-if="cronLoading" class="text-text/70">Chargement…</p>
        <template v-else>
          <div v-if="(dataTabCronRows?.length ?? 0) > 0" class="overflow-x-auto">
            <table class="w-full min-w-[500px] text-left text-sm">
              <thead class="border-b border-primary/30 bg-surface/50">
                <tr>
                  <th class="px-3 py-2 font-semibold text-text">Job</th>
                  <th class="px-3 py-2 font-semibold text-text">
                    {{ t('admin.cronStatus.lastStart') }}
                  </th>
                  <th class="px-3 py-2 font-semibold text-text">
                    {{ t('admin.cronStatus.lastSuccess') }}
                  </th>
                  <th class="px-3 py-2 font-semibold text-text">
                    {{ t('admin.cronStatus.lastFailure') }}
                  </th>
                  <th class="px-3 py-2 font-semibold text-text">
                    {{ t('admin.data.crons.status') }}
                  </th>
                  <th class="px-3 py-2 font-semibold text-text">
                    {{ t('admin.data.crons.actions') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-primary/20">
                <tr v-for="c in dataTabCronRows" :key="c.script" class="hover:bg-surface/50">
                  <td class="px-3 py-2 font-medium text-text">{{ c.script }}</td>
                  <td class="px-3 py-2 text-text/90">{{ formatRiotDate(c.lastStartAt) }}</td>
                  <td class="px-3 py-2 text-text/90">{{ formatRiotDate(c.lastSuccessAt) }}</td>
                  <td class="px-3 py-2 text-text/90">
                    <span v-if="c.lastFailureAt" :title="c.lastFailureMessage ?? ''">{{
                      formatRiotDate(c.lastFailureAt)
                    }}</span>
                    <span v-else class="text-text/50">—</span>
                  </td>
                  <td class="px-3 py-2">
                    <span
                      :class="cronStatusClass(c)"
                      class="rounded px-2 py-0.5 text-xs font-medium"
                    >
                      {{ cronStatusLabel(c) }}
                    </span>
                  </td>
                  <td class="px-3 py-2">
                    <button
                      type="button"
                      class="rounded border border-primary/40 bg-surface/60 px-2 py-1 text-xs font-medium text-text transition-colors hover:bg-primary/20 disabled:opacity-50"
                      :disabled="cronTriggering[c.script]"
                      @click="triggerCron(c.script)"
                    >
                      {{ cronTriggering[c.script] ? '…' : t('admin.data.crons.runNow') }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <p
              v-if="cronTriggerMessage"
              :class="
                cronTriggerError
                  ? 'mt-2 text-sm text-red-600 dark:text-red-400'
                  : 'mt-2 text-sm text-green-600 dark:text-green-400'
              "
            >
              {{ cronTriggerMessage }}
            </p>
          </div>
          <p v-else class="text-text/70">{{ t('admin.cronStatus.noData') }}</p>
        </template>
      </div>
    </div>

    <!-- Section 3: Poller d’ingestion -->
    <div class="rounded-lg border border-primary/30 bg-surface/30">
      <button
        type="button"
        class="flex w-full items-center justify-between p-4 text-left"
        @click="dataSectionPoller = !dataSectionPoller"
      >
        <h2 class="text-lg font-semibold text-text">Poller d’ingestion</h2>
        <span class="text-text/60">{{ dataSectionPoller ? '▼' : '▶' }}</span>
      </button>
      <div v-show="dataSectionPoller" class="border-t border-primary/20 px-4 pb-4 pt-2">
        <p class="mb-2 text-xs text-text/70">
          Process PM2
          <code class="rounded bg-background px-1">lelanation-poller-v2</code>
          — contrôle :
          <code class="rounded bg-background px-1">pm2 stop|restart lelanation-poller-v2</code>.
          Métriques : <code class="rounded bg-background px-1">poller-observability.json</code>.
        </p>
        <div class="mb-3 rounded border border-primary/20 bg-background/30 p-3">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-semibold text-text">Observabilité poller</h3>
            <span
              class="rounded px-2 py-0.5 text-xs"
              :class="
                pollerObservability?.stale
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                  : 'bg-green-600/20 text-green-700 dark:text-green-400'
              "
            >
              {{ pollerObservability?.stale ? 'stale' : 'live' }}
            </span>
          </div>
          <p
            v-if="pollerObservability?.stale"
            class="mb-2 text-xs text-amber-700 dark:text-amber-400"
          >
            Snapshot &gt; 15 min — process arrêté ou fichier absent.
            <span v-if="pollerObservability?.ageMs != null">
              (âge {{ Math.round(pollerObservability.ageMs / 1000) }} s)
            </span>
          </p>
          <p class="mb-2 text-xs text-text/60">
            Source:
            <code class="rounded bg-background px-1">{{
              pollerObservability?.filePath ?? 'poller-observability.json'
            }}</code>
          </p>
          <p v-if="pollerObservability?.latest10m?.since" class="mb-2 text-xs text-text/70">
            Mode since:
            <strong>{{ pollerObservability.latest10m.since.mode }}</strong>
            ({{ formatPollerSince(pollerObservability.latest10m.since.sinceTimestamp) }})
          </p>
          <div
            v-if="pollerObservability?.live"
            class="mb-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"
          >
            <div class="rounded border border-primary/15 bg-background/50 p-2">
              <div class="text-[10px] text-text/60">Lag données</div>
              <div class="font-semibold text-text">
                {{ pollerObservability.live.dataLagSeconds ?? '—' }} s
              </div>
            </div>
            <div class="rounded border border-primary/15 bg-background/50 p-2">
              <div class="text-[10px] text-text/60">Hydratation (w/a)</div>
              <div class="font-semibold text-text">
                {{ pollerObservability.live.queue.hydration.waiting }}/{{
                  pollerObservability.live.queue.hydration.active
                }}
              </div>
            </div>
            <div class="rounded border border-primary/15 bg-background/50 p-2">
              <div class="text-[10px] text-text/60">Ingestion (w/a)</div>
              <div class="font-semibold text-text">
                {{ pollerObservability.live.queue.ingestion.waiting }}/{{
                  pollerObservability.live.queue.ingestion.active
                }}
              </div>
            </div>
            <div class="rounded border border-primary/15 bg-background/50 p-2">
              <div class="text-[10px] text-text/60">Discovery (w/a)</div>
              <div class="font-semibold text-text">
                {{ pollerObservability.live.queue.discovery.waiting }}/{{
                  pollerObservability.live.queue.discovery.active
                }}
              </div>
            </div>
          </div>
          <div class="grid gap-3 lg:grid-cols-3">
            <div
              v-for="w in pollerMetricWindows"
              :key="w.label"
              class="rounded border border-primary/20 bg-background/40 p-3 text-xs"
            >
              <div class="mb-2 font-semibold text-text">{{ w.label }}</div>
              <template v-if="w.snap">
                <div class="grid grid-cols-2 gap-1.5">
                  <div>HTTP / 429</div>
                  <div class="font-medium text-text">
                    {{ w.snap.gateway?.total_requests ?? 0 }} /
                    {{ w.snap.gateway?.total_429s ?? 0 }}
                  </div>
                  <div>Tokens %</div>
                  <div class="font-medium text-text">
                    {{ formatDashRate(w.snap.gateway?.avg_token_pct_120s) }}%
                  </div>
                  <div>Joueurs</div>
                  <div class="font-medium text-text">
                    {{ w.snap.poll?.players_polled ?? 0 }}
                  </div>
                  <div>Matchs OK</div>
                  <div class="font-medium text-text">
                    {{ w.snap.poll?.matches_fetched_success ?? 0 }}
                  </div>
                  <div>Ingestion</div>
                  <div class="font-medium text-text">
                    {{ w.snap.ingestion?.matches_ingested ?? 0 }}
                    <span class="text-[10px] text-text/55">
                      ({{ w.snap.ingestion?.ingested_processed ?? 0 }}n /
                      {{ w.snap.ingestion?.ingested_already_done ?? 0 }}d)
                    </span>
                  </div>
                </div>
                <ul
                  v-if="w.snap.active_alerts?.length"
                  class="mt-2 list-inside list-disc text-[10px] text-amber-800 dark:text-amber-300"
                >
                  <li v-for="(a, i) in w.snap.active_alerts" :key="i">
                    {{ a.type }} — {{ a.message }}
                  </li>
                </ul>
              </template>
              <p v-else class="text-text/55">Pas encore de rapport.</p>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded border border-primary/40 bg-surface/60 px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-primary/20 disabled:opacity-50"
            :disabled="riotPollerLogsLoading"
            @click="openRiotPollerLogs"
          >
            {{ riotPollerLogsLoading ? '…' : 'Logs unifiés (résumés)' }}
          </button>
          <button
            type="button"
            class="rounded border border-primary/40 bg-surface/60 px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-primary/20 disabled:opacity-50"
            :disabled="riotPollerPm2LogsLoading"
            @click="openRiotPollerPm2Logs"
          >
            {{ riotPollerPm2LogsLoading ? '…' : 'Logs PM2 (stdout/stderr)' }}
          </button>
        </div>
        <p class="mt-2 text-xs text-text/60">
          Démarrage / arrêt du poller d’ingestion : PM2 uniquement (plus de poller intégré au
          backend).
        </p>
      </div>
    </div>

    <AppModal
      :open="riotPollerLogsOpen || riotPollerPm2LogsOpen"
      size="lg"
      scrollable
      body-class="max-h-[60vh] overflow-auto whitespace-pre-wrap break-all p-4 font-mono text-xs text-text/90"
      @close="closeRiotPollerLogModals"
    >
      <template #header>
        <div>
          <h2 class="text-lg font-semibold text-accent md:text-xl">
            {{ riotPollerPm2LogsOpen ? 'Logs PM2 poller' : 'Logs unifiés poller' }}
          </h2>
          <p class="mt-1 text-sm text-text/70">
            {{
              riotPollerPm2LogSource ??
              'Répertoire: logs (lelanation-unified.log — résumés poller_v3_*)'
            }}
          </p>
        </div>
      </template>
      <p v-if="riotPollerLogsLoading || riotPollerPm2LogsLoading" class="text-text/70">
        Chargement…
      </p>
      <p v-else-if="riotPollerLogsError" class="text-error">{{ riotPollerLogsError }}</p>
      <template v-else-if="activeRiotPollerLogLines.length === 0">Aucun log.</template>
      <template v-else>
        <div v-for="(line, i) in activeRiotPollerLogLines" :key="i">{{ line }}</div>
      </template>
    </AppModal>
  </div>

  <!-- Removed: matchups, cronstatus, apikey, seedplayers (merged into Data tab) -->
  <div v-show="false" class="hidden space-y-6">
    <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
      <h2 class="mb-2 text-lg font-semibold text-text">{{ t('admin.matchups.title') }}</h2>
      <p class="mb-4 text-sm text-text/80">{{ t('admin.matchups.description') }}</p>

      <div class="grid gap-3 sm:grid-cols-5">
        <div>
          <label class="mb-1 block text-xs font-medium text-text/70">{{
            t('admin.matchups.patch')
          }}</label>
          <input
            v-model.trim="matchupPatch"
            type="text"
            class="w-full rounded border border-primary/30 bg-background px-3 py-2 text-sm text-text"
            placeholder="16.4"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-text/70">{{
            t('admin.matchups.lane')
          }}</label>
          <select
            v-model="matchupLane"
            class="w-full rounded border border-primary/30 bg-background px-3 py-2 text-sm text-text"
          >
            <option value="">{{ t('admin.matchups.allLanes') }}</option>
            <option value="TOP">TOP</option>
            <option value="JUNGLE">JUNGLE</option>
            <option value="MIDDLE">MIDDLE</option>
            <option value="BOTTOM">BOTTOM</option>
            <option value="SUPPORT">SUPPORT</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-text/70">{{
            t('admin.matchups.rank')
          }}</label>
          <input
            v-model.trim="matchupRankTier"
            type="text"
            class="w-full rounded border border-primary/30 bg-background px-3 py-2 text-sm text-text"
            :placeholder="t('admin.matchups.globalRank')"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-text/70">{{
            t('admin.matchups.minGames')
          }}</label>
          <input
            v-model.number="matchupMinGames"
            type="number"
            min="1"
            max="1000"
            class="w-full rounded border border-primary/30 bg-background px-3 py-2 text-sm text-text"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-text/70">{{
            t('admin.matchups.championId')
          }}</label>
          <input
            v-model.trim="matchupChampionIdInput"
            type="text"
            class="w-full rounded border border-primary/30 bg-background px-3 py-2 text-sm text-text"
            placeholder="266"
          />
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          :disabled="matchupLoading || !matchupPatch"
          @click="loadMatchupTierList"
        >
          {{ matchupLoading ? '…' : t('admin.matchups.loadTier') }}
        </button>
        <button
          type="button"
          class="rounded border border-primary/40 bg-surface/60 px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface/80 disabled:opacity-50"
          :disabled="matchupLoading || !matchupPatch || !matchupChampionIdInput"
          @click="loadMatchupChampionDetails"
        >
          {{ t('admin.matchups.loadChampion') }}
        </button>
        <button
          type="button"
          class="rounded border border-primary/40 bg-background px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-primary/10 disabled:opacity-50"
          :disabled="matchupRebuildLoading || !matchupPatch"
          @click="rebuildMatchupTier"
        >
          {{ matchupRebuildLoading ? '…' : t('admin.matchups.rebuild') }}
        </button>
      </div>

      <p
        v-if="matchupMessage"
        class="mt-3 text-sm"
        :class="matchupError ? 'text-error' : 'text-green-600'"
      >
        {{ matchupMessage }}
      </p>

      <div v-if="matchupTierRows.length" class="mt-4 overflow-x-auto">
        <h3 class="mb-2 text-sm font-semibold text-text">
          {{ t('admin.matchups.tierTable') }}
        </h3>
        <table class="w-full min-w-[720px] text-left text-sm">
          <thead class="border-b border-primary/30 bg-surface/50">
            <tr>
              <th class="px-3 py-2 font-semibold text-text">ChampionId</th>
              <th class="px-3 py-2 font-semibold text-text">Score</th>
              <th class="px-3 py-2 font-semibold text-text">Δ Patch</th>
              <th class="px-3 py-2 font-semibold text-text">WR</th>
              <th class="px-3 py-2 font-semibold text-text">KDA</th>
              <th class="px-3 py-2 font-semibold text-text">Lvl</th>
              <th class="px-3 py-2 font-semibold text-text">Games</th>
              <th class="px-3 py-2 font-semibold text-text">Matchups</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-primary/20">
            <tr v-for="row in matchupTierRows" :key="row.championId" class="hover:bg-surface/50">
              <td class="px-3 py-2 text-text">{{ row.championId }}</td>
              <td class="px-3 py-2 font-semibold text-text">{{ row.avgScore }}</td>
              <td class="px-3 py-2 text-text/80">{{ row.avgDeltaVsPrevPatch ?? '—' }}</td>
              <td class="px-3 py-2 text-text/80">{{ row.avgWinrate }}%</td>
              <td class="px-3 py-2 text-text/80">{{ row.avgKda }}</td>
              <td class="px-3 py-2 text-text/80">{{ row.avgLevel }}</td>
              <td class="px-3 py-2 text-text/80">{{ row.totalGames }}</td>
              <td class="px-3 py-2 text-text/80">{{ row.matchups }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="matchupDetailsRows.length" class="mt-4 overflow-x-auto">
        <h3 class="mb-2 text-sm font-semibold text-text">
          {{ t('admin.matchups.championTable') }}
        </h3>
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead class="border-b border-primary/30 bg-surface/50">
            <tr>
              <th class="px-3 py-2 font-semibold text-text">Lane</th>
              <th class="px-3 py-2 font-semibold text-text">OpponentId</th>
              <th class="px-3 py-2 font-semibold text-text">Score</th>
              <th class="px-3 py-2 font-semibold text-text">Δ Patch</th>
              <th class="px-3 py-2 font-semibold text-text">WR</th>
              <th class="px-3 py-2 font-semibold text-text">KDA</th>
              <th class="px-3 py-2 font-semibold text-text">Lvl</th>
              <th class="px-3 py-2 font-semibold text-text">Games</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-primary/20">
            <tr
              v-for="row in matchupDetailsRows"
              :key="`${row.lane}-${row.opponentChampionId}`"
              class="hover:bg-surface/50"
            >
              <td class="px-3 py-2 text-text">{{ row.lane }}</td>
              <td class="px-3 py-2 text-text">{{ row.opponentChampionId }}</td>
              <td class="px-3 py-2 font-semibold text-text">{{ row.score }}</td>
              <td class="px-3 py-2 text-text/80">{{ row.deltaVsPrevPatch ?? '—' }}</td>
              <td class="px-3 py-2 text-text/80">{{ row.winrate }}%</td>
              <td class="px-3 py-2 text-text/80">{{ row.avgKda }}</td>
              <td class="px-3 py-2 text-text/80">{{ row.avgLevel }}</td>
              <td class="px-3 py-2 text-text/80">{{ row.games }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Removed: cronstatus (merged into Data tab) -->
  <div v-show="false" class="hidden space-y-6">
    <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
      <h2 class="mb-4 text-lg font-semibold text-text">
        {{ t('admin.cronStatus.title') }}
      </h2>
      <p v-if="cronLoading" class="text-text/70">{{ t('admin.loading') }}</p>
      <template v-else-if="cron?.cronJobs">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[520px] text-left text-sm">
            <thead class="border-b border-primary/30 bg-surface/50">
              <tr>
                <th class="px-3 py-2 font-semibold text-text">
                  {{ t('admin.cronStatus.job') }}
                </th>
                <th class="px-3 py-2 font-semibold text-text">
                  {{ t('admin.cronStatus.lastStart') }}
                </th>
                <th class="px-3 py-2 font-semibold text-text">
                  {{ t('admin.cronStatus.lastSuccess') }}
                </th>
                <th class="px-3 py-2 font-semibold text-text">
                  {{ t('admin.cronStatus.lastFailure') }}
                </th>
                <th class="px-3 py-2 font-semibold text-text">
                  {{ t('admin.cronStatus.lastFailureMessage') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-primary/20">
              <tr v-for="(job, jobId) in cron.cronJobs" :key="jobId" class="hover:bg-surface/50">
                <td class="px-3 py-2 font-medium text-text">{{ jobId }}</td>
                <td class="px-3 py-2 text-text/90">{{ formatRiotDate(job?.lastStartAt) }}</td>
                <td class="px-3 py-2 text-text/90">{{ formatRiotDate(job?.lastSuccessAt) }}</td>
                <td class="px-3 py-2 text-text/90">{{ formatRiotDate(job?.lastFailureAt) }}</td>
                <td
                  class="max-w-[200px] truncate px-3 py-2 text-text/80 sm:max-w-[280px]"
                  :title="job?.lastFailureMessage ?? ''"
                >
                  {{ job?.lastFailureMessage ?? '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <p v-else class="text-text/70">{{ t('admin.cronStatus.noData') }}</p>
    </div>
  </div>

  <!-- Removed: apikey (merged into Data tab) -->
  <div v-show="false" class="hidden space-y-6">
    <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
      <h2 class="mb-4 text-lg font-semibold text-text">{{ t('admin.riotApikey.title') }}</h2>
      <p class="mb-4 text-sm text-text/80">{{ t('admin.riotApikey.description') }}</p>
      <p v-if="riotApikeyLoading" class="text-text/70">Chargement…</p>
      <template v-else>
        <div class="mb-4">
          <h3 class="mb-1 text-sm font-medium text-text">
            {{ t('admin.riotApikey.currentKey') }}
          </h3>
          <p class="text-sm text-text/80">
            {{ riotApikeyMasked ?? t('admin.riotApikey.notSet') }}
          </p>
        </div>
        <form class="flex flex-wrap items-end gap-2" @submit.prevent="saveRiotApikey">
          <div class="min-w-[200px]">
            <label for="riot-apikey-input" class="sr-only">{{
              t('admin.riotApikey.placeholder')
            }}</label>
            <input
              id="riot-apikey-input"
              v-model="riotApikeyValue"
              type="password"
              autocomplete="off"
              :placeholder="t('admin.riotApikey.placeholder')"
              class="w-full rounded border border-primary/50 bg-background px-3 py-2 text-text"
            />
          </div>
          <button
            type="submit"
            class="rounded bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            :disabled="riotApikeySaving"
          >
            {{ riotApikeySaving ? '…' : t('admin.riotApikey.save') }}
          </button>
          <button
            type="button"
            class="rounded border border-primary/50 bg-background px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-primary/10 disabled:opacity-50"
            :disabled="riotApikeyTesting"
            @click="testRiotApikey"
          >
            {{ riotApikeyTesting ? t('admin.riotApikey.testing') : t('admin.riotApikey.testKey') }}
          </button>
        </form>
        <p
          v-if="riotApikeyMessage"
          :class="riotApikeyError ? 'text-error' : 'text-green-600'"
          class="mt-2 text-sm"
        >
          {{ riotApikeyMessage }}
        </p>
      </template>
    </div>
  </div>

  <!-- Removed: seedplayers (merged into Data tab) -->
  <div v-show="false" class="hidden space-y-6">
    <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
      <h2 class="mb-4 text-lg font-semibold text-text">{{ t('admin.seedPlayers.title') }}</h2>
      <p class="mb-4 text-sm text-text/80">{{ t('admin.seedPlayers.description') }}</p>
      <p v-if="seedPlayersLoading" class="text-text/70">Chargement…</p>
      <template v-else>
        <form class="mb-4 flex flex-wrap items-end gap-2" @submit.prevent="addSeedPlayer">
          <div class="min-w-[200px]">
            <label for="seed-player-label" class="mb-1 block text-sm text-text/80">{{
              t('admin.seedPlayers.labelPlaceholder')
            }}</label>
            <input
              id="seed-player-label"
              v-model="seedPlayerLabel"
              type="text"
              :placeholder="t('admin.seedPlayers.labelPlaceholder')"
              class="w-full rounded border border-primary/50 bg-background px-3 py-2 text-text"
            />
          </div>
          <div>
            <label for="seed-player-platform" class="mb-1 block text-sm text-text/80">{{
              t('admin.seedPlayers.platform')
            }}</label>
            <select
              id="seed-player-platform"
              v-model="seedPlayerPlatform"
              class="rounded border border-primary/50 bg-background px-3 py-2 text-text"
            >
              <option value="euw1">EUW</option>
              <option value="eun1">EUNE</option>
            </select>
          </div>
          <button
            type="submit"
            class="rounded bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            :disabled="seedPlayersAdding || !(seedPlayerLabel ?? '').trim()"
          >
            {{ seedPlayersAdding ? '…' : t('admin.seedPlayers.add') }}
          </button>
        </form>
        <p
          v-if="seedPlayersMessage"
          :class="seedPlayersError ? 'text-error' : 'text-green-600'"
          class="mb-4 text-sm"
        >
          {{ seedPlayersMessage }}
        </p>
        <!-- <p v-if="seedPlayersList.length === 0" class="text-text/70">
          {{ t('admin.seedPlayers.empty') }}
        </p>
        <ul v-else class="space-y-2">
          <li
            v-for="p in seedPlayersList"
            :key="p.id"
            class="flex flex-wrap items-center justify-between gap-2 rounded border border-primary/20 bg-background/50 px-3 py-2"
          >
            <span class="font-medium text-text">{{ p.label }}</span>
            <span class="text-sm text-text/70">{{
              p.platform === 'eun1' ? 'EUNE' : 'EUW'
            }}</span>
            <button
              type="button"
              class="rounded border border-primary/50 px-2 py-1 text-sm text-error transition-colors hover:bg-error/10"
              :disabled="seedPlayerDeleting === p.id"
              @click="deleteSeedPlayer(p.id)"
            >
              {{ seedPlayerDeleting === p.id ? '…' : t('admin.seedPlayers.delete') }}
            </button>
          </li>
        </ul> -->

        <div class="mt-6 border-t border-primary/20 pt-4">
          <h3 class="mb-2 text-sm font-medium text-text">
            {{ t('admin.seedPlayers.allPlayersTitle') }}
          </h3>
          <p class="mb-2 text-xs text-text/70">
            {{ t('admin.seedPlayers.allPlayersDescription') }}
          </p>
          <button
            type="button"
            class="rounded border border-primary/50 bg-background px-3 py-2 text-sm text-text transition-colors hover:bg-primary/10 disabled:opacity-50"
            :disabled="allPlayersLoading"
            @click="toggleAllPlayers"
          >
            {{
              allPlayersLoading
                ? t('admin.loading')
                : allPlayersVisible
                  ? t('admin.seedPlayers.hideAllPlayers')
                  : t('admin.seedPlayers.viewAllPlayers')
            }}
          </button>
          <div v-if="allPlayersVisible" class="mt-3 space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <label for="all-players-search" class="sr-only">{{
                t('admin.seedPlayers.searchPlayers')
              }}</label>
              <input
                id="all-players-search"
                v-model.trim="allPlayersSearchQuery"
                type="text"
                :placeholder="t('admin.seedPlayers.searchPlayersPlaceholder')"
                class="min-w-0 flex-1 rounded border border-primary/50 bg-background px-3 py-2 text-sm text-text placeholder:text-text/50"
                @keyup.enter="onAllPlayersSearch"
              />
              <button
                type="button"
                class="rounded border border-primary/50 bg-background px-3 py-2 text-sm text-text transition-colors hover:bg-primary/10"
                @click="onAllPlayersSearch"
              >
                {{ t('admin.seedPlayers.searchPlayers') }}
              </button>
            </div>
            <div
              class="max-h-[400px] overflow-auto rounded border border-primary/20 bg-background/50"
            >
              <p v-if="allPlayersLoading" class="p-4 text-text/70">{{ t('admin.loading') }}</p>
              <p v-else-if="allPlayersList.length === 0" class="p-4 text-text/70">
                {{
                  allPlayersSearchQuery.trim()
                    ? t('admin.seedPlayers.noSearchResults')
                    : t('admin.seedPlayers.allPlayersEmpty')
                }}
              </p>
              <div v-else class="overflow-x-auto">
                <table class="w-full min-w-[500px] text-left text-sm">
                  <thead class="sticky top-0 border-b border-primary/30 bg-surface/80">
                    <tr>
                      <th class="px-3 py-2 font-semibold text-text">
                        {{ t('admin.seedPlayers.colName') }}
                      </th>
                      <th class="px-3 py-2 font-semibold text-text">
                        {{ t('admin.seedPlayers.colPuuid') }}
                      </th>
                      <th class="px-3 py-2 font-semibold text-text">
                        {{ t('admin.seedPlayers.colRegion') }}
                      </th>
                      <th class="px-3 py-2 font-semibold text-text">
                        {{ t('admin.seedPlayers.colRank') }}
                      </th>
                      <th class="px-3 py-2 font-semibold text-text">
                        {{ t('admin.seedPlayers.colGames') }}
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-primary/20">
                    <tr v-for="p in allPlayersList" :key="p.puuid" class="hover:bg-surface/30">
                      <td class="min-w-[120px] px-3 py-2 font-medium text-text" :title="p.puuid">
                        {{ p.summonerName || t('admin.seedPlayers.noName') }}
                      </td>
                      <td class="px-3 py-2 font-mono text-xs text-text/60" :title="p.puuid">
                        {{ p.puuid.slice(0, 16) }}…
                      </td>
                      <td class="px-3 py-2 text-text/80">{{ p.region }}</td>
                      <td class="px-3 py-2 text-text/80">{{ p.rankTier || '—' }}</td>
                      <td class="px-3 py-2 text-text/80">
                        {{ p.totalGames }} {{ t('admin.seedPlayers.games') }}, {{ p.winrate }}% WR
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div
              v-if="allPlayersTotalPages > 1 || allPlayersTotal > 0"
              class="flex flex-wrap items-center justify-between gap-2 rounded border border-primary/20 bg-background/30 px-3 py-2 text-sm text-text/80"
            >
              <span>{{ allPlayersRangeText }}</span>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="rounded border border-primary/40 bg-background px-2 py-1 text-text transition-colors hover:bg-primary/10 disabled:opacity-50"
                  :disabled="allPlayersPage <= 1 || allPlayersLoading"
                  @click="goToAllPlayersPage(allPlayersPage - 1)"
                >
                  {{ t('admin.pagination.prev') }}
                </button>
                <span class="px-2">
                  {{ t('admin.pagination.page') }} {{ allPlayersPage }} /
                  {{ allPlayersTotalPages }}
                </span>
                <button
                  type="button"
                  class="rounded border border-primary/40 bg-background px-2 py-1 text-text transition-colors hover:bg-primary/10 disabled:opacity-50"
                  :disabled="allPlayersPage >= allPlayersTotalPages || allPlayersLoading"
                  @click="goToAllPlayersPage(allPlayersPage + 1)"
                >
                  {{ t('admin.pagination.next') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { apiUrl } from '~/utils/apiUrl'
import { useAdminAuth } from '~/composables/useAdminAuth'

const emit = defineEmits<{ 'auth-error': [message: string | null] }>()
const { t } = useI18n()
const localePath = useLocalePath()
const { fetchWithAuth, clearAuth } = useAdminAuth()

// Data tab: collecte + poller v2
// Data tab: collapsible sections
const dataSectionCrons = ref(true)
const dataSectionPoller = ref(true)
type AdminDataCollectStatsClient = {
  adminDataSource?: 'stats_db' | 'statistiques_db'
  totalPlayers: number
  playersWrongKeyVersion: number
  lastNewPlayerAt: string | null
  lastPlayerLastSeenAt: string | null
  lastPlayerUpdatedAt: string | null
  totalTrackedMatches: number
  trackedMatchesCreatedLast1h: number
  trackedMatchesPendingNow: number
  trackedMatchesPendingOver1h: number
  trackedOldestPendingCreatedAt: string | null
  playersCreatedLast1h: number
  playersLastSeenLast1h: number
  playersUpdatedLast1h: number
  matchIngestRaw: {
    pending: number
    processing: number
    error: number
    errorRankPending: number
  } | null
  trackedMatchesDeferredRankPending: number
}
const dataStats = ref<AdminDataCollectStatsClient | null>(null)
const dataStatsLoading = ref(false)
const dataStatsError = ref<string | null>(null)

const balanceRulesLoading = ref(false)
const balanceRulesSaving = ref(false)
const balanceRulesMessage = ref('')
const balanceRulesError = ref(false)
type BalanceRulesForm = {
  averageWinrateHigh: number
  averageWinrateLow: number
  averageBanrateMultiplier: number
  averageWinrateMax: number
  skilledWinrateHigh: number
  skilledWinrateLow: number
  skilledBanrateMultiplier: number
  skilledWinrateMax: number
  eliteWinrateHigh: number
  eliteWinrateLow: number
  eliteBanrateMultiplier: number
  eliteBanrateTwoPatchAvgMin: number
  elitePresenceMax: number
}
const balanceRulesForm = ref<BalanceRulesForm>({
  averageWinrateHigh: 54,
  averageWinrateLow: 52.5,
  averageBanrateMultiplier: 5,
  averageWinrateMax: 49,
  skilledWinrateHigh: 53.5,
  skilledWinrateLow: 52,
  skilledBanrateMultiplier: 5,
  skilledWinrateMax: 49,
  eliteWinrateHigh: 54,
  eliteWinrateLow: 52.5,
  eliteBanrateMultiplier: 5,
  eliteBanrateTwoPatchAvgMin: 50,
  elitePresenceMax: 7.5,
})
type PollerSnapshotClient = {
  ts?: number
  window?: string
  since?: { mode?: string; sinceTimestamp?: number; reason?: string }
  gateway?: {
    total_requests?: number
    total_429s?: number
    avg_token_pct_120s?: number
    latency_p95_ms?: number
  }
  poll?: {
    players_polled?: number
    players_new_added?: number
    matches_fetched_success?: number
    match_ids_discovered?: number
  }
  ingestion?: {
    matches_ingested?: number
    ingested_processed?: number
    ingested_already_done?: number
    matches_failed?: number
  }
  ratios?: Record<string, number>
  active_alerts?: Array<{ type?: string; severity?: string; message?: string }>
}

const pollerObservability = ref<{
  ok: boolean
  stale: boolean
  ageMs: number | null
  filePath: string | null
  latest10m: PollerSnapshotClient | null
  latest30m: PollerSnapshotClient | null
  latest1h: PollerSnapshotClient | null
  live: {
    dataLagSeconds: number | null
    queue: {
      discovery: { waiting: number; active: number; failed: number }
      hydration: { waiting: number; active: number; failed: number }
      ingestion: { waiting: number; active: number; failed: number }
      rank: { waiting: number; active: number; failed: number }
    }
  } | null
} | null>(null)

const pollerMetricWindows = computed(() => {
  const p = pollerObservability.value
  if (!p) return []
  return [
    { label: '10 min', snap: p.latest10m },
    { label: '30 min', snap: p.latest30m },
    { label: '1 h', snap: p.latest1h },
  ]
})

function formatPollerSince(ts: number | undefined): string {
  if (ts == null || !Number.isFinite(ts)) return '—'
  const ms = ts > 1e12 ? ts : ts * 1000
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
}

function formatDashRate(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const x = Math.round(n * 10) / 10
  return Number.isInteger(x) ? String(x) : x.toFixed(1)
}

const riotPollerLogsOpen = ref(false)
const riotPollerPm2LogsOpen = ref(false)
const riotPollerLogs = ref<string[]>([])
const riotPollerPm2Logs = ref<string[]>([])
const riotPollerPm2LogSource = ref<string | null>(null)
const riotPollerLogsLoading = ref(false)
const riotPollerPm2LogsLoading = ref(false)
const riotPollerLogsError = ref<string | null>(null)

const activeRiotPollerLogLines = computed(() =>
  riotPollerPm2LogsOpen.value ? riotPollerPm2Logs.value : riotPollerLogs.value
)

function closeRiotPollerLogModals() {
  riotPollerLogsOpen.value = false
  riotPollerPm2LogsOpen.value = false
}

async function loadDataStats() {
  dataStatsLoading.value = true
  dataStatsError.value = null
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/data-stats'))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const body = await res.json()
    if (!res.ok) {
      dataStats.value = null
      dataStatsError.value =
        typeof body?.error === 'string' ? body.error : 'Failed to load data stats'
      return
    }
    dataStats.value = body
  } catch {
    dataStats.value = null
    dataStatsError.value = 'Network error while loading data stats'
  } finally {
    dataStatsLoading.value = false
  }
}

function applyBalanceRulesForm(rules: any) {
  const avg = rules?.levels?.average
  const sk = rules?.levels?.skilled
  const el = rules?.levels?.elite
  balanceRulesForm.value = {
    averageWinrateHigh: Number(avg?.overpowered?.winrateHigh ?? 54),
    averageWinrateLow: Number(avg?.overpowered?.winrateLow ?? 52.5),
    averageBanrateMultiplier: Number(avg?.overpowered?.banrateMultiplier ?? 5),
    averageWinrateMax: Number(avg?.underpowered?.winrateMax ?? 49),
    skilledWinrateHigh: Number(sk?.overpowered?.winrateHigh ?? 53.5),
    skilledWinrateLow: Number(sk?.overpowered?.winrateLow ?? 52),
    skilledBanrateMultiplier: Number(sk?.overpowered?.banrateMultiplier ?? 5),
    skilledWinrateMax: Number(sk?.underpowered?.winrateMax ?? 49),
    eliteWinrateHigh: Number(el?.overpowered?.winrateHigh ?? 54),
    eliteWinrateLow: Number(el?.overpowered?.winrateLow ?? 52.5),
    eliteBanrateMultiplier: Number(el?.overpowered?.banrateMultiplier ?? 5),
    eliteBanrateTwoPatchAvgMin: Number(el?.overpowered?.banrateTwoPatchAvgMin ?? 50),
    elitePresenceMax: Number(el?.underpowered?.presenceMax ?? 7.5),
  }
}

function buildBalanceRulesPayload() {
  const f = balanceRulesForm.value
  return {
    levels: {
      average: {
        tiers: ['IRON', 'BRONZE', 'SILVER', 'GOLD'],
        overpowered: {
          winrateHigh: f.averageWinrateHigh,
          winrateLow: f.averageWinrateLow,
          banrateMultiplier: f.averageBanrateMultiplier,
          minGames: 50,
        },
        underpowered: {
          winrateMax: f.averageWinrateMax,
        },
      },
      skilled: {
        tiers: ['PLATINUM', 'EMERALD', 'DIAMOND'],
        overpowered: {
          winrateHigh: f.skilledWinrateHigh,
          winrateLow: f.skilledWinrateLow,
          banrateMultiplier: f.skilledBanrateMultiplier,
          minGames: 50,
        },
        underpowered: {
          winrateMax: f.skilledWinrateMax,
        },
      },
      elite: {
        tiers: ['DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'],
        overpowered: {
          winrateHigh: f.eliteWinrateHigh,
          winrateLow: f.eliteWinrateLow,
          banrateMultiplier: f.eliteBanrateMultiplier,
          minGames: 30,
          banrateTwoPatchAvgMin: f.eliteBanrateTwoPatchAvgMin,
        },
        underpowered: {
          presenceMax: f.elitePresenceMax,
        },
      },
    },
  }
}

async function loadBalanceRules() {
  balanceRulesLoading.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/balance-rules'))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    applyBalanceRulesForm(data?.rules ?? {})
  } catch {
    // keep defaults
  } finally {
    balanceRulesLoading.value = false
  }
}

async function saveBalanceRules() {
  balanceRulesMessage.value = ''
  balanceRulesError.value = false
  balanceRulesSaving.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/balance-rules'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: buildBalanceRulesPayload() }),
    })
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    if (!res.ok) {
      balanceRulesError.value = true
      balanceRulesMessage.value = data?.error ?? 'Erreur'
      return
    }
    applyBalanceRulesForm(data?.rules ?? {})
    balanceRulesMessage.value = 'Règles balance sauvegardées.'
  } catch {
    balanceRulesError.value = true
    balanceRulesMessage.value = 'Erreur réseau'
  } finally {
    balanceRulesSaving.value = false
  }
}

// Videos / Cron
const cron = ref<any>(null)
const cronLoading = ref(false)

type CronJobRowUi = {
  script: string
  type: 'cron'
  lastStartAt: string | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
  lastFailureMessage: string | null
}

const DATA_TAB_CRON_KEYS = ['dataDragonSync', 'youtubeSync', 'communityDragonSync'] as const

const dataTabCronRows = computed((): CronJobRowUi[] => {
  const jobs = cron.value?.cronJobs as
    | Record<
        string,
        {
          lastStartAt?: string | null
          lastSuccessAt?: string | null
          lastFailureAt?: string | null
          lastFailureMessage?: string | null
        }
      >
    | undefined
  if (!jobs || typeof jobs !== 'object') return []
  return DATA_TAB_CRON_KEYS.map(key => {
    const job = jobs[key]
    return {
      script: key,
      type: 'cron',
      lastStartAt: job?.lastStartAt ?? null,
      lastSuccessAt: job?.lastSuccessAt ?? null,
      lastFailureAt: job?.lastFailureAt ?? null,
      lastFailureMessage: job?.lastFailureMessage ?? null,
    }
  })
})

const cronTriggering = ref<Record<string, boolean>>({})
const cronTriggerMessage = ref('')
const cronTriggerError = ref(false)
const syncDataBusy = ref(false)
// Riot API key
const riotApikeyMasked = ref<string | null>(null)
const riotApikeyLoading = ref(false)
const riotApikeyValue = ref('')
const riotApikeySaving = ref(false)
const riotApikeyTesting = ref(false)
const riotApikeyMessage = ref('')
const riotApikeyError = ref(false)

// Seed players (for match collection)
const seedPlayerLabel = ref('')
const seedPlayerPlatform = ref<'euw1' | 'eun1'>('euw1')
const seedPlayersList = ref<Array<{ id: string; label: string; platform: string }>>([])
const seedPlayersLoading = ref(false)
const seedPlayersAdding = ref(false)
const seedPlayersMessage = ref('')
const seedPlayersError = ref(false)
const seedPlayerDeleting = ref<string | null>(null)

const ALL_PLAYERS_PAGE_SIZE = 15
const allPlayersVisible = ref(false)
const allPlayersSearchQuery = ref('')
const allPlayersPage = ref(1)
const allPlayersTotal = ref(0)
const allPlayersList = ref<
  Array<{
    puuid: string
    summonerName: string | null
    region: string
    rankTier?: string | null
    totalGames: number
    totalWins: number
    winrate: number
  }>
>([])
const allPlayersLoading = ref(false)

// Matchup tier (admin)
const matchupPatch = ref('')
const matchupLane = ref<'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'SUPPORT' | ''>('')
const matchupRankTier = ref('')
const matchupMinGames = ref(20)
const matchupChampionIdInput = ref('')
const matchupLoading = ref(false)
const matchupRebuildLoading = ref(false)
const matchupError = ref(false)
const matchupMessage = ref('')
const matchupTierRows = ref<
  Array<{
    championId: number
    matchups: number
    totalGames: number
    avgScore: number
    avgWinrate: number
    avgKda: number
    avgLevel: number
    avgConfidence: number
    avgDeltaVsPrevPatch: number | null
  }>
>([])
const matchupDetailsRows = ref<
  Array<{
    opponentChampionId: number
    lane: string
    games: number
    wins: number
    winrate: number
    avgKda: number
    avgLevel: number
    score: number
    confidence: number
    prevPatchScore: number | null
    deltaVsPrevPatch: number | null
  }>
>([])

const allPlayersTotalPages = computed(() =>
  Math.max(1, Math.ceil(allPlayersTotal.value / ALL_PLAYERS_PAGE_SIZE))
)
const allPlayersRangeText = computed(() => {
  const total = allPlayersTotal.value
  if (total === 0) return '0'
  const start = (allPlayersPage.value - 1) * ALL_PLAYERS_PAGE_SIZE + 1
  const end = Math.min(allPlayersPage.value * ALL_PLAYERS_PAGE_SIZE, total)
  return `${start}–${end} / ${total}`
})

async function loadAllPlayers() {
  allPlayersLoading.value = true
  try {
    const offset = (allPlayersPage.value - 1) * ALL_PLAYERS_PAGE_SIZE
    const params = new URLSearchParams({
      limit: String(ALL_PLAYERS_PAGE_SIZE),
      offset: String(offset),
    })
    if (allPlayersSearchQuery.value.trim()) params.set('search', allPlayersSearchQuery.value.trim())
    const res = await fetchWithAuth(apiUrl(`/api/admin/players?${params.toString()}`))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    allPlayersList.value = data?.players ?? []
    allPlayersTotal.value = data?.total ?? 0
  } catch {
    allPlayersList.value = []
    allPlayersTotal.value = 0
  } finally {
    allPlayersLoading.value = false
  }
}

function goToAllPlayersPage(page: number) {
  const p = Math.max(1, Math.min(page, allPlayersTotalPages.value))
  if (p === allPlayersPage.value) return
  allPlayersPage.value = p
  loadAllPlayers()
}

function toggleAllPlayers() {
  if (!allPlayersVisible.value) {
    allPlayersPage.value = 1
    loadAllPlayers()
  }
  allPlayersVisible.value = !allPlayersVisible.value
}

function onAllPlayersSearch() {
  allPlayersPage.value = 1
  loadAllPlayers()
}

async function addSeedPlayer() {
  const label = (seedPlayerLabel.value ?? '').trim()
  if (!label) return
  seedPlayersMessage.value = ''
  seedPlayersError.value = false
  seedPlayersAdding.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/seed-players'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, platform: seedPlayerPlatform.value }),
    })
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    if (res.ok && data?.player) {
      seedPlayersMessage.value = t('admin.seedPlayers.addSuccess')
      seedPlayerLabel.value = ''
      seedPlayersList.value = [...seedPlayersList.value, data.player]
    } else {
      seedPlayersError.value = true
      if (res.status === 409 && data?.code === 'ALREADY_SEED') {
        seedPlayersMessage.value = t('admin.seedPlayers.alreadyInSeedList')
      } else if (res.status === 409 && data?.code === 'ALREADY_PLAYER') {
        seedPlayersMessage.value = data?.summonerName
          ? t('admin.seedPlayers.playerAlreadyInDatabaseName', { name: data.summonerName })
          : t('admin.seedPlayers.playerAlreadyInDatabase')
      } else {
        seedPlayersMessage.value = (data?.error as string) ?? t('admin.seedPlayers.addError')
      }
    }
  } catch {
    seedPlayersError.value = true
    seedPlayersMessage.value = t('admin.seedPlayers.addError')
  } finally {
    seedPlayersAdding.value = false
  }
}

// Used in seed players list (currently commented in template)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function deleteSeedPlayer(id: string) {
  seedPlayerDeleting.value = id
  try {
    const res = await fetchWithAuth(apiUrl(`/api/admin/seed-players/${id}`), { method: 'DELETE' })
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    if (res.ok) seedPlayersList.value = seedPlayersList.value.filter(p => p.id !== id)
  } finally {
    seedPlayerDeleting.value = null
  }
}

async function testRiotApikey() {
  riotApikeyMessage.value = ''
  riotApikeyError.value = false
  riotApikeyTesting.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/riot-apikey/test'))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    if (data.valid) {
      riotApikeyMessage.value = t('admin.riotApikey.testKeySuccess')
    } else {
      riotApikeyError.value = true
      let msg = data?.error ?? t('admin.riotApikey.testKeyError')
      if (data.keySource != null && data.keyLength != null) {
        msg += ` (source: ${data.keySource}, longueur clé: ${data.keyLength})`
      }
      riotApikeyMessage.value = msg
    }
  } catch {
    riotApikeyError.value = true
    riotApikeyMessage.value = t('admin.riotApikey.testKeyError')
  } finally {
    riotApikeyTesting.value = false
  }
}

async function loadRiotApikey() {
  riotApikeyLoading.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/riot-apikey'))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    riotApikeyMasked.value = data.maskedKey ?? null
  } catch {
    emit('auth-error', t('admin.login.error'))
  } finally {
    riotApikeyLoading.value = false
  }
}

async function saveRiotApikey() {
  riotApikeyMessage.value = ''
  riotApikeyError.value = false
  riotApikeySaving.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/riot-apikey'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ riotApiKey: riotApikeyValue.value }),
    })
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    if (res.ok) {
      riotApikeyMessage.value = t('admin.riotApikey.saveSuccess')
      riotApikeyMasked.value = data.maskedKey ?? null
      riotApikeyValue.value = ''
      await loadRiotApikey()
    } else {
      riotApikeyError.value = true
      riotApikeyMessage.value = data?.error ?? t('admin.riotApikey.saveError')
    }
  } catch {
    riotApikeyError.value = true
    riotApikeyMessage.value = t('admin.riotApikey.saveError')
  } finally {
    riotApikeySaving.value = false
  }
}

function formatRiotDate(iso: string | null | undefined): string {
  if (!iso || typeof iso !== 'string') return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const now = Date.now()
  const diffMs = now - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  if (diffMin < 1) return 'à l’instant'
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffH < 24) return `il y a ${diffH} h`
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function loadCron() {
  cronLoading.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/cron'))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    cron.value = await res.json()
  } catch {
    emit('auth-error', t('admin.login.error'))
  } finally {
    cronLoading.value = false
  }
}

async function refreshDataTabPoller() {
  await Promise.all([loadDataStats(), loadPollerObservability()])
}

async function triggerSyncData() {
  syncDataBusy.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/sync-data'), { method: 'POST' })
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    if (data?.success) {
      cronTriggerError.value = false
      cronTriggerMessage.value = data?.message ?? 'Sync lancé.'
    } else {
      cronTriggerError.value = true
      cronTriggerMessage.value = data?.error ?? 'Erreur'
    }
  } catch {
    cronTriggerError.value = true
    cronTriggerMessage.value = 'Erreur réseau'
  } finally {
    syncDataBusy.value = false
  }
}

async function loadPollerObservability() {
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/poller/observability'))
    if (res.status === 401) return
    const data = await res.json().catch(() => null)
    pollerObservability.value = data
  } catch {
    // keep previous value
  }
}

async function openRiotPollerPm2Logs() {
  riotPollerPm2LogsOpen.value = true
  riotPollerLogsOpen.value = false
  riotPollerPm2LogsLoading.value = true
  riotPollerLogsError.value = null
  riotPollerPm2Logs.value = []
  riotPollerPm2LogSource.value = null
  try {
    const res = await fetchWithAuth(
      apiUrl('/api/admin/riot-poller/process-logs?lines=400&stream=both')
    )
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json().catch(() => ({}))
    if (Array.isArray(data?.log)) {
      riotPollerPm2Logs.value = data.log
      riotPollerPm2LogSource.value = Array.isArray(data?.files)
        ? data.files.join(', ')
        : 'logs/poller-v2-out.log'
    } else {
      riotPollerLogsError.value = res.ok ? 'Format de réponse inattendu' : `Erreur ${res.status}`
    }
  } catch (e) {
    riotPollerLogsError.value =
      e instanceof Error ? e.message : 'Impossible de charger les logs PM2'
  } finally {
    riotPollerPm2LogsLoading.value = false
  }
}

async function openRiotPollerLogs() {
  riotPollerLogsOpen.value = true
  riotPollerPm2LogsOpen.value = false
  riotPollerLogsLoading.value = true
  riotPollerLogsError.value = null
  riotPollerLogs.value = []
  riotPollerPm2LogSource.value = null
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/riot-poller/logs?lines=300&sort=desc'))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json().catch(() => ({}))
    if (Array.isArray(data?.log)) {
      riotPollerLogs.value = data.log
    } else {
      riotPollerLogsError.value = res.ok ? 'Format de réponse inattendu' : `Erreur ${res.status}`
    }
  } catch (e) {
    riotPollerLogsError.value = e instanceof Error ? e.message : 'Impossible de charger les logs'
  } finally {
    riotPollerLogsLoading.value = false
  }
}

function cronStatusClass(c: { lastSuccessAt: string | null; lastFailureAt: string | null }) {
  if (
    c.lastFailureAt &&
    (!c.lastSuccessAt || new Date(c.lastFailureAt) > new Date(c.lastSuccessAt))
  )
    return 'bg-red-600/20 text-red-700 dark:text-red-400'
  if (c.lastSuccessAt) return 'bg-green-600/20 text-green-700 dark:text-green-400'
  return 'bg-text/10 text-text/70'
}

function cronStatusLabel(c: { lastSuccessAt: string | null; lastFailureAt: string | null }) {
  if (
    c.lastFailureAt &&
    (!c.lastSuccessAt || new Date(c.lastFailureAt) > new Date(c.lastSuccessAt))
  )
    return t('admin.data.crons.statusFailed')
  if (c.lastSuccessAt) return t('admin.data.crons.statusSuccess')
  return t('admin.data.crons.statusUnknown')
}

async function triggerCron(script: string) {
  cronTriggerMessage.value = ''
  cronTriggerError.value = false
  cronTriggering.value = { ...cronTriggering.value, [script]: true }
  try {
    const res = await fetchWithAuth(apiUrl(`/api/admin/cron/trigger/${script}`), { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data?.success) {
      cronTriggerMessage.value = t('admin.data.crons.runSuccess')
      await Promise.all([loadCron(), refreshDataTabPoller()])
    } else {
      cronTriggerError.value = true
      cronTriggerMessage.value = data?.error ?? t('admin.data.crons.runError')
    }
  } catch {
    cronTriggerError.value = true
    cronTriggerMessage.value = t('admin.data.crons.runError')
  } finally {
    cronTriggering.value = { ...cronTriggering.value, [script]: false }
  }
}

function matchupQueryParams(extra?: Record<string, string>): string {
  const p = new URLSearchParams()
  p.set('patch', matchupPatch.value.trim())
  if (matchupLane.value) p.set('lane', matchupLane.value)
  if (matchupRankTier.value.trim()) p.set('rankTier', matchupRankTier.value.trim().toUpperCase())
  p.set('minGames', String(matchupMinGames.value || 20))
  p.set('limit', '150')
  for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v)
  return p.toString()
}

async function loadMatchupTierList() {
  matchupMessage.value = ''
  matchupError.value = false
  matchupLoading.value = true
  matchupDetailsRows.value = []
  try {
    const query = matchupQueryParams()
    const res = await fetchWithAuth(apiUrl(`/api/admin/matchup-tier-list?${query}`))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    if (res.ok) {
      matchupTierRows.value = Array.isArray(data?.tierList) ? data.tierList : []
      matchupMessage.value = t('admin.matchups.loaded', { count: matchupTierRows.value.length })
      return
    }
    matchupError.value = true
    matchupMessage.value = data?.error ?? t('admin.matchups.loadError')
  } catch {
    matchupError.value = true
    matchupMessage.value = t('admin.matchups.loadError')
  } finally {
    matchupLoading.value = false
  }
}

async function loadMatchupChampionDetails() {
  const championId = Number(matchupChampionIdInput.value)
  if (!Number.isFinite(championId) || championId <= 0) return
  matchupMessage.value = ''
  matchupError.value = false
  matchupLoading.value = true
  try {
    const query = matchupQueryParams()
    const res = await fetchWithAuth(apiUrl(`/api/admin/matchup-tier/${championId}?${query}`))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    if (res.ok) {
      matchupDetailsRows.value = Array.isArray(data?.matchups) ? data.matchups : []
      matchupMessage.value = t('admin.matchups.championLoaded', {
        count: matchupDetailsRows.value.length,
      })
      return
    }
    matchupError.value = true
    matchupMessage.value = data?.error ?? t('admin.matchups.loadError')
  } catch {
    matchupError.value = true
    matchupMessage.value = t('admin.matchups.loadError')
  } finally {
    matchupLoading.value = false
  }
}

async function rebuildMatchupTier() {
  matchupMessage.value = ''
  matchupError.value = false
  matchupRebuildLoading.value = true
  try {
    const payload: { patch: string; rankTier?: string } = { patch: matchupPatch.value.trim() }
    if (matchupRankTier.value.trim()) payload.rankTier = matchupRankTier.value.trim().toUpperCase()
    const res = await fetchWithAuth(apiUrl('/api/admin/matchup-tier/rebuild'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    if (res.ok) {
      matchupMessage.value = t('admin.matchups.rebuildSuccess', { rows: data?.rows ?? 0 })
      await loadMatchupTierList()
      return
    }
    matchupError.value = true
    matchupMessage.value = data?.error ?? t('admin.matchups.rebuildError')
  } catch {
    matchupError.value = true
    matchupMessage.value = t('admin.matchups.rebuildError')
  } finally {
    matchupRebuildLoading.value = false
  }
}

const DATA_TAB_POLL_INTERVAL_MS = 10 * 1000
let dataTabPollTimer: ReturnType<typeof setInterval> | null = null

function loadAll() {
  return Promise.all([
    loadCron(),
    refreshDataTabPoller(),
    loadRiotApikey(),
    loadDataStats(),
    loadBalanceRules(),
  ])
}

function deactivate() {
  if (dataTabPollTimer) {
    clearInterval(dataTabPollTimer)
    dataTabPollTimer = null
  }
}

function activate() {
  deactivate()
  if (!cron.value && !cronLoading.value) loadCron()
  refreshDataTabPoller()
  loadDataStats()
  loadBalanceRules()
  dataTabPollTimer = setInterval(() => {
    refreshDataTabPoller()
  }, DATA_TAB_POLL_INTERVAL_MS)
}

onUnmounted(deactivate)

defineExpose({ loadAll, activate, deactivate })
</script>
