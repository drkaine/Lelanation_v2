<template>
  <div class="admin-dashboard min-h-screen p-4 text-text">
    <div :class="activeTab === 'logs' ? 'w-full max-w-none' : 'mx-auto max-w-6xl'">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-text-accent">Admin</h1>
          <p class="mt-1 hidden text-sm text-text/70 sm:block">
            {{ t('admin.tabs.contact') }} · {{ t('admin.tabs.videos') }} ·
            {{ t('admin.tabs.data') }} · {{ t('admin.tabs.logs') }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-lg border border-primary bg-surface px-4 py-2 text-sm text-text transition-colors hover:bg-primary hover:text-white"
            @click="logout"
          >
            {{ t('admin.logout') }}
          </button>
        </div>
      </div>

      <div
        v-if="authError"
        class="mb-4 rounded-lg border border-error bg-surface p-3 text-sm text-error"
      >
        {{ authError }}
      </div>

      <!-- Tabs (responsive: wrap + scroll on small, select on mobile) -->
      <div class="mb-4 border-b border-primary/30 pb-2">
        <select
          v-model="activeTab"
          class="mb-2 w-full rounded border border-primary/50 bg-surface px-3 py-2 text-sm text-text sm:hidden"
          aria-label="Onglet admin"
        >
          <option v-for="tab in adminTabs" :key="tab.id" :value="tab.id">
            {{ tab.label }}
          </option>
        </select>
        <div class="flex flex-wrap gap-2 overflow-x-auto pb-1 sm:flex-nowrap">
          <button
            v-for="tab in adminTabs"
            :key="tab.id"
            type="button"
            :class="[
              'shrink-0 rounded px-3 py-2 text-sm font-medium transition-colors sm:px-4',
              activeTab === tab.id
                ? 'bg-accent text-background'
                : 'bg-surface/50 text-text/80 hover:bg-primary/20 hover:text-text',
            ]"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <!-- Tab: Contact -->
      <div v-show="activeTab === 'contact'" class="space-y-6">
        <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
          <h2 class="mb-4 text-lg font-semibold text-text">{{ t('admin.contact.title') }}</h2>
          <p v-if="contactLoading" class="text-text/70">Chargement…</p>
          <template v-else>
            <p v-if="contactEmpty" class="text-text/70">{{ t('admin.contact.empty') }}</p>
            <div v-else class="space-y-6">
              <div
                v-for="(entries, type) in contactByCategory"
                :key="type"
                class="rounded border border-primary/20 bg-background/50 p-3"
              >
                <h3 class="mb-2 font-semibold capitalize text-text">{{ type }}</h3>
                <ul class="space-y-2">
                  <li
                    v-for="(entry, idx) in entries"
                    :key="`${type}-${idx}`"
                    class="flex flex-wrap items-start justify-between gap-2 rounded border border-primary/10 bg-surface/50 p-2"
                  >
                    <div class="min-w-0 flex-1 text-sm">
                      <span class="font-medium text-text">{{ entry.name }}</span>
                      <span v-if="entry.contact" class="ml-2 text-text/70"
                        >· {{ entry.contact }}</span
                      >
                      <p class="mt-1 text-text/80">{{ entry.message }}</p>
                      <p class="mt-1 text-xs text-text/60">{{ entry.date }}</p>
                    </div>
                    <button
                      type="button"
                      class="rounded border border-primary/50 px-2 py-1 text-sm text-error transition-colors hover:bg-error/20"
                      :disabled="contactDeleting === `${type}-${idx}`"
                      @click="deleteContact(type, idx)"
                    >
                      {{ contactDeleting === `${type}-${idx}` ? '…' : t('admin.contact.delete') }}
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Tab: Data (Crons + stats) -->
      <div v-show="activeTab === 'data'" class="space-y-6">
        <!-- Section 1: Stats collecte -->
        <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
          <h2 class="mb-4 text-lg font-semibold text-text">{{ t('admin.data.stats.title') }}</h2>
          <p class="mb-3 text-xs text-text/70">
            Totaux et fenêtre 1 h : <code class="text-[11px]">players</code> (created_at, last_seen)
            et <code class="text-[11px]">tracked_matches</code>. Débit / deltas : dernier
            <code class="text-[11px]">poller_30m</code> ou
            <code class="text-[11px]">poller_hourly</code> dans le log unifié.
          </p>
          <p v-if="dataStatsLoading" class="text-text/70">Chargement…</p>
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
                  {{ t('admin.data.stats.totalTrackedMatches') }}
                </div>
              </div>
              <div class="rounded border border-primary/20 bg-background/30 p-3">
                <div class="text-xl font-bold text-text">
                  {{ dataStats?.trackedMatchesCreatedLast1h ?? '—' }}
                </div>
                <div class="text-xs text-text/70">{{ t('admin.data.stats.trackedMatches1h') }}</div>
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
                    dataStats?.lastPlayerUpdatedAt
                      ? formatRiotDate(dataStats.lastPlayerUpdatedAt)
                      : '—'
                  }}
                </div>
                <div class="text-xs text-text/70">Dernier player updated_at</div>
              </div>
              <div class="rounded border border-primary/20 bg-background/30 p-3">
                <div class="text-xl font-bold text-text">
                  {{ dataStats?.trackedMatchesPendingNow ?? '—' }}
                </div>
                <div class="text-xs text-text/70">Tracked pending (now)</div>
              </div>
              <div class="rounded border border-primary/20 bg-background/30 p-3">
                <div class="text-xl font-bold text-text">
                  {{ dataStats?.trackedMatchesPendingOver1h ?? '—' }}
                </div>
                <div class="text-xs text-text/70">Tracked pending &gt; 1h</div>
              </div>
              <div class="rounded border border-primary/20 bg-background/30 p-3">
                <div class="text-base font-semibold text-text">
                  {{
                    dataStats?.trackedOldestPendingCreatedAt
                      ? formatRiotDate(dataStats.trackedOldestPendingCreatedAt)
                      : '—'
                  }}
                </div>
                <div class="text-xs text-text/70">Plus ancien tracked pending (created_at)</div>
              </div>
              <div class="rounded border border-primary/20 bg-background/30 p-3">
                <div class="text-xl font-bold text-text">
                  {{ dataStats?.trackedMatchesDeferredRankPending ?? '—' }}
                </div>
                <div class="text-xs text-text/70">
                  Tracked deferred rank (agrégation en attente de tier)
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
            <template v-if="dataStats?.pollerResume">
              <p class="mb-2 text-xs font-medium uppercase tracking-wide text-text/60">
                {{ t('admin.data.stats.resumeTitle') }} — {{ dataStats.pollerResume.script }}
              </p>
              <p class="mb-2 font-mono text-[11px] text-text/60">
                {{ t('admin.data.stats.resumeWindow') }}:
                {{ dataStats.pollerResume.windowStartIso ?? '—' }} →
                {{ dataStats.pollerResume.windowEndIso ?? '—' }}
                <span class="text-text/50">({{ dataStats.pollerResume.atIso }})</span>
              </p>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                <div class="rounded border border-primary/20 bg-background/30 p-3">
                  <div class="text-xl font-bold text-text">
                    {{ adminStatNum(dataStats.pollerResume.delta?.httpRequests) }}
                  </div>
                  <div class="text-xs text-text/70">{{ t('admin.data.stats.resumeHttp') }}</div>
                  <div
                    v-if="formatPollerHttpWindowSummary(dataStats.pollerResume.httpWindowStats)"
                    class="mt-1 text-[11px] leading-snug text-text/65"
                  >
                    {{ formatPollerHttpWindowSummary(dataStats.pollerResume.httpWindowStats) }}
                  </div>
                </div>
                <div class="rounded border border-primary/20 bg-background/30 p-3">
                  <div class="text-xl font-bold text-text">
                    {{ adminStatNum(dataStats.pollerResume.delta?.error429) }}
                  </div>
                  <div class="text-xs text-text/70">{{ t('admin.data.stats.resume429') }}</div>
                </div>
                <div class="rounded border border-primary/20 bg-background/30 p-3">
                  <div class="text-xl font-bold text-text">
                    {{ adminStatNum(dataStats.pollerResume.delta?.matchIdsFromApi) }}
                  </div>
                  <div class="text-xs text-text/70">{{ t('admin.data.stats.resumeMatchIds') }}</div>
                </div>
                <div class="rounded border border-primary/20 bg-background/30 p-3">
                  <div class="text-xl font-bold text-text">
                    {{ adminStatNum(dataStats.pollerResume.delta?.matchesInsertedDb) }}
                  </div>
                  <div class="text-xs text-text/70">
                    {{ t('admin.data.stats.resumeMatchesDb') }}
                  </div>
                </div>
                <div class="rounded border border-primary/20 bg-background/30 p-3">
                  <div class="text-xl font-bold text-text">
                    {{ adminStatNum(dataStats.pollerResume.delta?.matchesApiIngestComplete) }}
                  </div>
                  <div class="text-xs text-text/70">
                    {{ t('admin.data.stats.resumeMatchesApi') }}
                  </div>
                </div>
                <div class="rounded border border-primary/20 bg-background/30 p-3">
                  <div class="text-xl font-bold text-text">
                    {{ adminStatNum(dataStats.pollerResume.delta?.participants) }}
                  </div>
                  <div class="text-xs text-text/70">
                    {{ t('admin.data.stats.resumeParticipants') }}
                  </div>
                </div>
                <div class="rounded border border-primary/20 bg-background/30 p-3">
                  <div class="text-xl font-bold text-text">
                    {{ adminStatNum(dataStats.pollerResume.delta?.playersPolled) }}
                  </div>
                  <div class="text-xs text-text/70">
                    {{ t('admin.data.stats.resumePlayersPolled') }}
                  </div>
                </div>
                <div class="rounded border border-primary/20 bg-background/30 p-3">
                  <div class="text-xl font-bold text-text">
                    {{ adminStatNum(dataStats.pollerResume.delta?.newPlayers) }}
                  </div>
                  <div class="text-xs text-text/70">
                    {{ t('admin.data.stats.resumeNewPlayers') }}
                  </div>
                </div>
              </div>
            </template>
            <p v-else class="text-sm text-text/60">
              Aucun résumé poller récent dans le log unifié.
            </p>
          </template>
        </div>

        <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
          <h2 class="mb-3 text-lg font-semibold text-text">Active patches</h2>
          <div class="grid gap-2 sm:grid-cols-3">
            <select
              v-model="selectedActivePatch"
              class="rounded border border-primary/30 bg-background px-3 py-2 text-sm text-text"
            >
              <option value="" disabled>Sélectionner un patch</option>
              <option v-for="p in activePatches" :key="p.gameVersion" :value="p.gameVersion">
                {{ p.gameVersion }} ({{ p.gamesNumber }} / {{ p.gameNumberMax }}){{
                  p.archivedAt ? ' — archivé' : ''
                }}
              </option>
            </select>
            <input
              v-model.number="activePatchMaxInput"
              type="number"
              min="1"
              class="rounded border border-primary/30 bg-background px-3 py-2 text-sm text-text"
              placeholder="Nouveau game_number_max"
            />
            <button
              type="button"
              class="rounded bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              :disabled="activePatchSaveBusy || !selectedActivePatch || !(activePatchMaxInput > 0)"
              @click="saveActivePatchMax"
            >
              {{ activePatchSaveBusy ? '…' : 'Mettre à jour game_number_max' }}
            </button>
          </div>
          <p
            v-if="activePatchMessage"
            :class="
              activePatchError
                ? 'mt-2 text-sm text-error'
                : 'mt-2 text-sm text-green-600 dark:text-green-400'
            "
          >
            {{ activePatchMessage }}
          </p>
        </div>

        <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
          <h2 class="mb-3 text-lg font-semibold text-text">Clôture de patch</h2>
          <p class="mb-3 text-xs text-text/70">
            Exécute <code class="rounded bg-background/80 px-1 text-[11px]">close_patch</code> puis
            archive les
            <code class="rounded bg-background/80 px-1 text-[11px]"
              >champion_tier_daily_snapshots</code
            >
            dont <code class="rounded bg-background/80 px-1 text-[11px]">date_of_game</code> est
            dans
            <code class="rounded bg-background/80 px-1 text-[11px]"
              >[releaseDate, releaseDate du patch suivant)</code
            >
            selon
            <code class="rounded bg-background/80 px-1 text-[11px]">data/game/versions.json</code>
            (ordre du fichier : plus récent en premier ; le patch le plus récent du fichier utilise
            demain UTC comme fin exclusive).
          </p>
          <div class="grid gap-2 sm:grid-cols-3">
            <select
              v-model="selectedPatchClose"
              class="rounded border border-primary/30 bg-background px-3 py-2 text-sm text-text"
            >
              <option value="" disabled>Choisir un patch</option>
              <option v-for="o in patchCloseOptions" :key="o.patchLabel" :value="o.patchLabel">
                {{ o.patchLabel }} — {{ o.releaseDate }} → {{ o.endExclusive
                }}{{ o.isLatestInRecap ? ' (tête du recap)' : '' }}
              </option>
            </select>
            <button
              type="button"
              class="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50 sm:col-span-2"
              :disabled="patchCloseBusy || !selectedPatchClose"
              @click="runPatchClose"
            >
              {{ patchCloseBusy ? '…' : 'Fermer le patch (agg + snapshots)' }}
            </button>
          </div>
          <p
            v-if="patchCloseMessage"
            :class="
              patchCloseError
                ? 'mt-2 text-sm text-error'
                : 'mt-2 text-sm text-green-600 dark:text-green-400'
            "
          >
            {{ patchCloseMessage }}
          </p>
        </div>

        <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
          <h2 class="mb-3 text-lg font-semibold text-text">Balance Framework Rules</h2>
          <p class="mb-3 text-xs text-text/70">
            Modifie les seuils utilisés par l'onglet statistiques Balance (Average / Skilled /
            Elite).
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
                balanceRulesError
                  ? 'text-sm text-error'
                  : 'text-sm text-green-600 dark:text-green-400'
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
              <div v-if="(riotScriptsStatusCrons?.length ?? 0) > 0" class="overflow-x-auto">
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
                    <tr
                      v-for="c in riotScriptsStatusCrons"
                      :key="c.script"
                      class="hover:bg-surface/50"
                    >
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

        <!-- Section 3: Riot Poller -->
        <div class="rounded-lg border border-primary/30 bg-surface/30">
          <button
            type="button"
            class="flex w-full items-center justify-between p-4 text-left"
            @click="dataSectionPoller = !dataSectionPoller"
          >
            <h2 class="text-lg font-semibold text-text">Riot Poller</h2>
            <span class="text-text/60">{{ dataSectionPoller ? '▼' : '▶' }}</span>
          </button>
          <div v-show="dataSectionPoller" class="border-t border-primary/20 px-4 pb-4 pt-2">
            <p v-if="riotPollerStatus?.pollerExternal" class="mb-2 text-xs text-text/70">
              Poller dans un process PM2 séparé (<code class="rounded bg-background px-1"
                >lelanation-poller</code
              >) — contrôle :
              <code class="rounded bg-background px-1">pm2 stop|restart lelanation-poller</code>.
              Les boutons ci-dessous ne s’appliquent qu’au poller intégré au backend (sans
              POLLER_EXTERNAL).
            </p>
            <p
              v-if="riotPollerStatus?.heartbeatStale"
              class="mb-2 text-xs text-amber-700 dark:text-amber-400"
            >
              Dernier résumé poller dans le log unifié (poller_30m / poller_hourly) trop ancien — le
              process est peut-être arrêté. Totaux = dernier résumé connu.
              <span v-if="riotPollerStatus?.snapshotAgeMs != null" class="text-text/60">
                (âge {{ Math.round(riotPollerStatus.snapshotAgeMs / 1000) }} s)
              </span>
            </p>
            <div class="mb-3 flex flex-wrap items-center gap-2">
              <span
                :class="riotPollerStatusClass(riotPollerStatus?.status)"
                class="rounded px-2 py-0.5 text-xs font-medium"
              >
                {{ riotPollerStatusLabel(riotPollerStatus?.status) }}
              </span>
              <span v-if="riotPollerStatus?.statusSource" class="text-xs text-text/50">
                source: {{ riotPollerStatus.statusSource }}
              </span>
              <span
                v-if="riotPollerStatus?.lastError"
                class="max-w-md truncate text-xs text-error"
                :title="riotPollerStatus.lastError"
              >
                {{ riotPollerStatus.lastError }}
              </span>
            </div>
            <div class="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-6">
              <div class="rounded border border-primary/20 bg-background/30 p-2">
                <span class="text-text/70">Requêtes (session)</span>
                <div class="font-medium text-text">{{ riotPollerStatus?.requestCount ?? '—' }}</div>
              </div>
              <div class="rounded border border-primary/20 bg-background/30 p-2">
                <span class="text-text/70">Requêtes / 2 min</span>
                <div class="font-medium text-text">
                  {{
                    riotPollerStatus?.requestsPer2Min != null
                      ? riotPollerStatus.requestsPer2Min
                      : '—'
                  }}
                </div>
              </div>
              <div class="rounded border border-primary/20 bg-background/30 p-2">
                <span class="text-text/70">429 (session)</span>
                <div class="font-medium text-text">
                  {{ riotPollerStatus?.error429Count ?? '—' }}
                </div>
              </div>
              <div class="rounded border border-primary/20 bg-background/30 p-2">
                <span class="text-text/70">400 (session)</span>
                <div class="font-medium text-text">
                  {{ riotPollerStatus?.error400Count ?? '—' }}
                </div>
              </div>
              <div class="rounded border border-primary/20 bg-background/30 p-2">
                <span class="text-text/70">Pauses near-limit</span>
                <div class="font-medium text-text">
                  {{ riotPollerStatus?.nearLimitPauseCount ?? '—' }}
                </div>
              </div>
              <div class="rounded border border-primary/20 bg-background/30 p-2">
                <span class="text-text/70">Pauses 429</span>
                <div class="font-medium text-text">
                  {{ riotPollerStatus?.http429PauseCount ?? '—' }}
                </div>
              </div>
              <div class="rounded border border-primary/20 bg-background/30 p-2">
                <span class="text-text/70">Matchs</span>
                <div class="font-medium text-text">
                  {{ riotPollerStatus?.matchesFetched ?? '—' }}
                </div>
              </div>
              <div class="rounded border border-primary/20 bg-background/30 p-2">
                <span class="text-text/70">Joueurs pollers</span>
                <div class="font-medium text-text">
                  {{ riotPollerStatus?.playersPolled ?? '—' }}
                </div>
              </div>
              <div class="rounded border border-primary/20 bg-background/30 p-2">
                <span class="text-text/70">Nouveaux players</span>
                <div class="font-medium text-text">
                  {{ riotPollerStatus?.playersFetched ?? '—' }}
                </div>
              </div>
              <div class="rounded border border-primary/20 bg-background/30 p-2">
                <span class="text-text/70">Dernier lastSeen (DB)</span>
                <div class="font-medium text-text">
                  {{ formatRiotDate(riotPollerStatus?.latestPlayerLastSeenAt ?? null) }}
                </div>
              </div>
            </div>

            <div class="mb-3 rounded border border-primary/20 bg-background/30 p-3">
              <div class="mb-2 flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold text-text">
                  Observabilité poller-v2 (temps réel)
                </h3>
                <span
                  class="rounded px-2 py-0.5 text-xs"
                  :class="
                    pollerV2Observability?.stale
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                      : 'bg-green-600/20 text-green-700 dark:text-green-400'
                  "
                >
                  {{ pollerV2Observability?.stale ? 'stale' : 'live' }}
                </span>
              </div>
              <p class="mb-2 text-xs text-text/60">
                Âge snapshot:
                {{
                  pollerV2Observability?.ageMs != null
                    ? `${Math.round(pollerV2Observability.ageMs / 1000)}s`
                    : '—'
                }}
              </p>
              <div class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
                <div class="rounded border border-primary/20 bg-background/40 p-2">
                  <div class="text-text/70">Tokens / 2 min</div>
                  <div class="font-semibold text-text">
                    {{ pollerV2Observability?.data?.rolling2m?.rateLimitGrantedCost ?? '—' }}
                    /
                    {{ pollerV2Observability?.data?.rolling2m?.tokenBudget120 ?? '—' }}
                  </div>
                </div>
                <div class="rounded border border-primary/20 bg-background/40 p-2">
                  <div class="text-text/70">Utilisation quota 2min</div>
                  <div class="font-semibold text-text">
                    {{
                      pollerV2Observability?.data?.rolling2m?.tokenUsagePct != null
                        ? `${pollerV2Observability.data.rolling2m.tokenUsagePct}%`
                        : '—'
                    }}
                  </div>
                </div>
                <div class="rounded border border-primary/20 bg-background/40 p-2">
                  <div class="text-text/70">HTTP req / 2 min</div>
                  <div class="font-semibold text-text">
                    {{ pollerV2Observability?.data?.rolling2m?.apiRequests ?? '—' }}
                  </div>
                </div>
                <div class="rounded border border-primary/20 bg-background/40 p-2">
                  <div class="text-text/70">HTTP 429 / 2 min</div>
                  <div class="font-semibold text-text">
                    {{ pollerV2Observability?.data?.rolling2m?.api429 ?? '—' }}
                  </div>
                </div>
                <div class="rounded border border-primary/20 bg-background/40 p-2">
                  <div class="text-text/70">Rate-limit denied / 2 min</div>
                  <div class="font-semibold text-text">
                    {{ pollerV2Observability?.data?.rolling2m?.rateLimitDeniedCount ?? '—' }}
                  </div>
                </div>
                <div class="rounded border border-primary/20 bg-background/40 p-2">
                  <div class="text-text/70">Wait ms total / 2 min</div>
                  <div class="font-semibold text-text">
                    {{ pollerV2Observability?.data?.rolling2m?.rateLimitWaitMsTotal ?? '—' }}
                  </div>
                </div>
              </div>

              <div class="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div class="rounded border border-primary/20 bg-background/40 p-2">
                  <div class="text-text/70">
                    Résumé 30 min (players pollés / update / ajoutés / matchs)
                  </div>
                  <div class="font-semibold text-text">
                    {{
                      pollerV2Observability?.data?.summaries?.last30m?.dbWindow?.playersPolled ??
                      '—'
                    }}
                    /
                    {{
                      pollerV2Observability?.data?.summaries?.last30m?.dbWindow?.playersUpdated ??
                      '—'
                    }}
                    /
                    {{
                      pollerV2Observability?.data?.summaries?.last30m?.dbWindow?.playersAdded ?? '—'
                    }}
                    /
                    {{
                      pollerV2Observability?.data?.summaries?.last30m?.dbWindow?.matchesAdded ?? '—'
                    }}
                  </div>
                </div>
                <div class="rounded border border-primary/20 bg-background/40 p-2">
                  <div class="text-text/70">
                    Résumé 1 h (players pollés / update / ajoutés / matchs)
                  </div>
                  <div class="font-semibold text-text">
                    {{
                      pollerV2Observability?.data?.summaries?.last1h?.dbWindow?.playersPolled ?? '—'
                    }}
                    /
                    {{
                      pollerV2Observability?.data?.summaries?.last1h?.dbWindow?.playersUpdated ??
                      '—'
                    }}
                    /
                    {{
                      pollerV2Observability?.data?.summaries?.last1h?.dbWindow?.playersAdded ?? '—'
                    }}
                    /
                    {{
                      pollerV2Observability?.data?.summaries?.last1h?.dbWindow?.matchesAdded ?? '—'
                    }}
                  </div>
                </div>
                <div class="rounded border border-primary/20 bg-background/40 p-2">
                  <div class="text-text/70">Queue (w/a/f) discovery</div>
                  <div class="font-semibold text-text">
                    {{ pollerV2Observability?.data?.queue?.discovery?.waiting ?? '—' }}/{{
                      pollerV2Observability?.data?.queue?.discovery?.active ?? '—'
                    }}/{{ pollerV2Observability?.data?.queue?.discovery?.failed ?? '—' }}
                  </div>
                </div>
                <div class="rounded border border-primary/20 bg-background/40 p-2">
                  <div class="text-text/70">Queue (w/a/f) hydration</div>
                  <div class="font-semibold text-text">
                    {{ pollerV2Observability?.data?.queue?.hydration?.waiting ?? '—' }}/{{
                      pollerV2Observability?.data?.queue?.hydration?.active ?? '—'
                    }}/{{ pollerV2Observability?.data?.queue?.hydration?.failed ?? '—' }}
                  </div>
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
                {{ riotPollerLogsLoading ? '…' : 'Voir les logs' }}
              </button>
              <button
                type="button"
                class="rounded border border-primary/40 bg-surface/60 px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-primary/20 disabled:opacity-50"
                :disabled="
                  riotPollerStatus?.pollerExternal ||
                  !riotPollerStatus?.isRunning ||
                  riotPollerStopBusy
                "
                @click="stopRiotPoller"
              >
                {{ riotPollerStopBusy ? '…' : 'Arrêter proprement' }}
              </button>
              <button
                type="button"
                class="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                :disabled="
                  riotPollerStatus?.pollerExternal ||
                  riotPollerStatus?.isRunning ||
                  riotPollerStartBusy
                "
                @click="startRiotPoller"
              >
                {{ riotPollerStartBusy ? '…' : 'Relancer' }}
              </button>
            </div>
            <p
              v-if="riotPollerActionMessage"
              :class="
                riotPollerActionError
                  ? 'mt-2 text-sm text-error'
                  : 'mt-2 text-sm text-green-600 dark:text-green-400'
              "
            >
              {{ riotPollerActionMessage }}
            </p>

            <div class="mt-4 rounded border border-primary/20 bg-background/30 p-3">
              <h3 class="mb-1 text-sm font-semibold text-text">
                Activité poller — agrégation des résumés (log unifié)
              </h3>
              <p class="mb-3 text-xs text-text/60">
                Somme des <strong>deltas</strong> des lignes
                <code class="rounded bg-surface px-1">poller_hourly</code> /
                <code class="rounded bg-surface px-1">poller_30m</code> sur la plage choisie. Les
                totaux correspondent à la somme des colonnes du tableau (pas au cumul absolu Riot
                affiché dans un seul résumé).
              </p>
              <div class="mb-3 flex flex-wrap gap-2">
                <button
                  v-for="p in pollerMetricsPresets"
                  :key="p.id"
                  type="button"
                  class="rounded border border-primary/35 bg-surface/70 px-2.5 py-1 text-xs font-medium text-text hover:bg-primary/15 disabled:opacity-50"
                  :disabled="pollerMetricsLoading"
                  @click="applyPollerMetricsPreset(p.id)"
                >
                  {{ p.label }}
                </button>
              </div>
              <div class="mb-2 flex flex-wrap items-end gap-2">
                <label class="flex flex-col gap-0.5 text-xs text-text/70">
                  Pas
                  <select
                    v-model="pollerMetricsGranularity"
                    class="rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
                  >
                    <option value="hour">Par heure</option>
                    <option value="day">Par jour</option>
                  </select>
                </label>
                <label
                  v-if="pollerMetricsGranularity === 'hour'"
                  class="flex flex-col gap-0.5 text-xs text-text/70"
                >
                  Fenêtre (h)
                  <input
                    v-model.number="pollerMetricsHours"
                    type="number"
                    min="1"
                    max="168"
                    class="w-20 rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
                  />
                </label>
                <label v-else class="flex flex-col gap-0.5 text-xs text-text/70">
                  Fenêtre (j)
                  <input
                    v-model.number="pollerMetricsDays"
                    type="number"
                    min="1"
                    max="90"
                    class="w-20 rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
                  />
                </label>
                <label class="flex flex-col gap-0.5 text-xs text-text/70">
                  Source
                  <select
                    v-model="pollerMetricsSource"
                    class="rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
                  >
                    <option value="both">Horaires + 30 min</option>
                    <option value="hourly">Horaires seulement</option>
                    <option value="30m">30 min seulement</option>
                  </select>
                </label>
                <button
                  type="button"
                  class="rounded border border-primary/40 bg-surface/60 px-3 py-1.5 text-sm font-medium text-text hover:bg-primary/20 disabled:opacity-50"
                  :disabled="pollerMetricsLoading"
                  @click="loadPollerMetrics"
                >
                  {{ pollerMetricsLoading ? '…' : 'Actualiser' }}
                </button>
              </div>
              <p v-if="pollerMetricsRangeLabel" class="mb-2 font-mono text-xs text-text/70">
                Plage UTC : {{ pollerMetricsRangeLabel }}
              </p>
              <p v-if="pollerMetricsError" class="mb-2 text-sm text-error">
                {{ pollerMetricsError }}
              </p>
              <div
                v-if="pollerMetricsTotals && !pollerMetricsLoading"
                class="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
              >
                <div class="rounded-lg border border-primary/25 bg-surface/50 p-3">
                  <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
                    Requêtes HTTP
                  </div>
                  <div class="text-xl font-semibold tabular-nums text-text">
                    {{ formatPollerCompact(pollerMetricsTotals.requests) }}
                  </div>
                </div>
                <div class="rounded-lg border border-primary/25 bg-surface/50 p-3">
                  <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
                    Paires match+timeline OK
                  </div>
                  <div class="text-xl font-semibold tabular-nums text-text">
                    {{ formatPollerCompact(pollerMetricsTotals.matchesApiIngestComplete ?? 0) }}
                  </div>
                </div>
                <div class="rounded-lg border border-primary/25 bg-surface/50 p-3">
                  <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
                    Matchs DB (nouvelles lignes)
                  </div>
                  <div class="text-xl font-semibold tabular-nums text-text">
                    {{ formatPollerCompact(pollerMetricsTotals.matches) }}
                  </div>
                </div>
                <div class="rounded-lg border border-primary/25 bg-surface/50 p-3">
                  <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
                    Participants
                  </div>
                  <div class="text-xl font-semibold tabular-nums text-text">
                    {{ formatPollerCompact(pollerMetricsTotals.participants) }}
                  </div>
                </div>
                <div class="rounded-lg border border-primary/25 bg-surface/50 p-3">
                  <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
                    Joueurs pollers (Δ)
                  </div>
                  <div class="text-xl font-semibold tabular-nums text-text">
                    {{ formatPollerCompact(pollerMetricsTotals.playersPolled) }}
                  </div>
                </div>
                <div class="rounded-lg border border-primary/25 bg-surface/50 p-3">
                  <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
                    Nouveaux joueurs DB
                  </div>
                  <div class="text-xl font-semibold tabular-nums text-text">
                    {{ formatPollerCompact(pollerMetricsTotals.newPlayers) }}
                  </div>
                </div>
                <div class="rounded-lg border border-primary/25 bg-surface/50 p-3">
                  <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
                    HTTP 429 / 400
                  </div>
                  <div class="text-lg font-semibold tabular-nums text-text">
                    {{ pollerMetricsTotals.error429 }} /
                    {{ pollerMetricsTotals.error400 }}
                  </div>
                </div>
                <div class="rounded-lg border border-primary/25 bg-surface/50 p-3">
                  <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
                    Lignes log agrégées
                  </div>
                  <div class="text-xl font-semibold tabular-nums text-text">
                    {{ pollerMetricsMatchedLines }}
                  </div>
                </div>
              </div>
              <div
                v-if="pollerChartGeometry && pollerMetricsTotals && !pollerMetricsLoading"
                class="mb-4 rounded border border-primary/15 bg-background/40 p-2"
              >
                <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span class="text-xs font-medium text-text/80">Graphique (par période)</span>
                  <label class="flex items-center gap-1.5 text-xs text-text/70">
                    Série
                    <select
                      v-model="pollerChartMetric"
                      class="rounded border border-primary/30 bg-background px-2 py-1 text-sm text-text"
                    >
                      <option value="requests">Requêtes HTTP</option>
                      <option value="matchesApi">Paires match+timeline</option>
                      <option value="matches">Matchs DB</option>
                    </select>
                  </label>
                </div>
                <svg
                  class="h-52 w-full text-primary"
                  :viewBox="`0 0 ${pollerChartGeometry.W} ${pollerChartGeometry.H}`"
                  preserveAspectRatio="xMidYMid meet"
                  role="img"
                  :aria-label="'Histogramme ' + pollerChartMetricLabel"
                >
                  <line
                    :x1="pollerChartGeometry.padL"
                    :y1="pollerChartGeometry.baselineY"
                    :x2="pollerChartGeometry.W - pollerChartGeometry.padR"
                    :y2="pollerChartGeometry.baselineY"
                    class="stroke-current text-text/25"
                    stroke-width="1"
                  />
                  <text
                    :x="pollerChartGeometry.padL"
                    y="14"
                    class="fill-current text-[11px] text-text/50"
                  >
                    max {{ formatPollerCompact(pollerChartGeometry.maxV) }} ·
                    {{ pollerChartGeometry.bars.length }} barres
                  </text>
                  <rect
                    v-for="(b, idx) in pollerChartGeometry.bars"
                    :key="b.key + '-' + idx"
                    :x="b.x"
                    :y="b.y"
                    :width="b.w"
                    :height="b.h"
                    class="fill-primary/75"
                    rx="0.5"
                  />
                </svg>
              </div>
              <h4 class="mb-1 text-xs font-semibold uppercase tracking-wide text-text/60">
                Détail par période
              </h4>
              <div class="max-h-72 overflow-auto rounded border border-primary/15">
                <table class="w-full min-w-[720px] text-left text-xs">
                  <thead class="sticky top-0 bg-surface/90 text-text/70">
                    <tr>
                      <th class="px-2 py-1.5">Période (UTC)</th>
                      <th class="px-2 py-1.5 text-right">Req</th>
                      <th class="px-2 py-1.5 text-right">429</th>
                      <th class="px-2 py-1.5 text-right">400</th>
                      <th class="px-2 py-1.5 text-right">Pairs API</th>
                      <th class="px-2 py-1.5 text-right">Matchs DB</th>
                      <th class="px-2 py-1.5 text-right">Part.</th>
                      <th class="px-2 py-1.5 text-right">Pollers</th>
                      <th class="px-2 py-1.5 text-right">Échant.</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="row in pollerMetricsBuckets"
                      :key="row.key"
                      class="border-t border-primary/10 odd:bg-background/20"
                    >
                      <td class="px-2 py-1 font-mono text-text">
                        {{ formatPollerMetricPeriod(row) }}
                      </td>
                      <td class="px-2 py-1 text-right tabular-nums">{{ row.requests }}</td>
                      <td class="px-2 py-1 text-right tabular-nums">{{ row.error429 }}</td>
                      <td class="px-2 py-1 text-right tabular-nums">{{ row.error400 }}</td>
                      <td class="px-2 py-1 text-right tabular-nums">
                        {{ row.matchesApiIngestComplete ?? 0 }}
                      </td>
                      <td class="px-2 py-1 text-right tabular-nums">{{ row.matches }}</td>
                      <td class="px-2 py-1 text-right tabular-nums">{{ row.participants }}</td>
                      <td class="px-2 py-1 text-right tabular-nums">{{ row.playersPolled }}</td>
                      <td class="px-2 py-1 text-right tabular-nums text-text/60">
                        {{ row.sampleCount }}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p
                  v-if="
                    !pollerMetricsLoading &&
                    pollerMetricsBuckets.length === 0 &&
                    !pollerMetricsError
                  "
                  class="p-3 text-text/60"
                >
                  Aucune donnée dans la plage — cliquez sur Actualiser.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
          <h2 class="mb-4 text-lg font-semibold text-text">Scripts Riot</h2>
          <div class="space-y-3">
            <div
              v-for="row in riotScriptStatusRows"
              :key="row.id"
              class="rounded border border-primary/20 bg-background/30 p-3"
            >
              <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div class="font-medium text-text">{{ row.label }}</div>
                <span
                  :class="_riotStatusClass(row.status)"
                  class="rounded px-2 py-0.5 text-xs font-medium"
                >
                  {{ _riotStatusLabel(row.status) }}
                </span>
              </div>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  :class="[
                    'rounded px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50',
                    isScriptActive(row.id)
                      ? 'cursor-not-allowed bg-slate-500'
                      : 'bg-accent hover:opacity-90',
                  ]"
                  :disabled="scriptSwitchBusy[row.id] || isScriptActive(row.id)"
                  @click="
                    row.id === 'league-xp'
                      ? switchScript('league-xp', leagueXpForm)
                      : switchScript(row.id as 'poller' | 'puuid-migration')
                  "
                >
                  {{ scriptSwitchBusy[row.id] ? '…' : 'Lancer' }}
                </button>
                <button
                  type="button"
                  class="rounded border border-primary/40 bg-surface/60 px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-primary/20 disabled:opacity-50"
                  :disabled="scriptStopBusy[row.id]"
                  @click="stopScript(row.id as 'poller' | 'puuid-migration' | 'league-xp')"
                >
                  {{ scriptStopBusy[row.id] ? '…' : 'Arrêter' }}
                </button>
              </div>
            </div>
          </div>

          <div class="mt-4 rounded border border-primary/20 bg-background/30 p-3">
            <h3 class="mb-2 text-sm font-semibold text-text">Paramètres League XP</h3>
            <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <input
                v-model="leagueXpForm.queue"
                type="text"
                class="rounded border border-primary/30 bg-background px-3 py-2 text-sm text-text"
                placeholder="Queue"
              />
              <input
                v-model="leagueXpForm.tier"
                type="text"
                class="rounded border border-primary/30 bg-background px-3 py-2 text-sm text-text"
                placeholder="Tier"
              />
              <input
                v-model="leagueXpForm.division"
                type="text"
                class="rounded border border-primary/30 bg-background px-3 py-2 text-sm text-text"
                placeholder="Division"
              />
              <input
                v-model="leagueXpForm.region"
                type="text"
                class="rounded border border-primary/30 bg-background px-3 py-2 text-sm text-text"
                placeholder="Région"
              />
              <input
                v-model.number="leagueXpForm.maxPages"
                type="number"
                min="1"
                max="100"
                class="rounded border border-primary/30 bg-background px-3 py-2 text-sm text-text"
                placeholder="Pages"
              />
            </div>
            <div class="mt-3">
              <button
                type="button"
                class="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                :disabled="scriptSwitchBusy['league-xp']"
                @click="switchScript('league-xp', leagueXpForm)"
              >
                {{ scriptSwitchBusy['league-xp'] ? '…' : 'Lancer League XP avec ce formulaire' }}
              </button>
            </div>
          </div>
          <p
            v-if="scriptActionMessage"
            :class="
              scriptActionError
                ? 'mt-2 text-sm text-error'
                : 'mt-2 text-sm text-green-600 dark:text-green-400'
            "
          >
            {{ scriptActionMessage }}
          </p>
        </div>

        <!-- Modal: Riot Poller logs -->
        <div
          v-show="riotPollerLogsOpen"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black p-4"
          @click.self="riotPollerLogsOpen = false"
        >
          <div
            class="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-lg border border-primary/30 bg-background shadow-xl"
          >
            <div class="flex items-center justify-between border-b border-primary/20 px-4 py-2">
              <div>
                <h3 class="font-semibold text-text">Logs Riot Poller</h3>
                <p class="text-xs text-text/60">Répertoire: logs (racine du projet)</p>
              </div>
              <button
                type="button"
                class="rounded border border-primary/40 px-2 py-1 text-sm text-text hover:bg-primary/20"
                @click="riotPollerLogsOpen = false"
              >
                Fermer
              </button>
            </div>
            <div
              class="max-h-[60vh] overflow-auto whitespace-pre-wrap break-all p-4 font-mono text-xs text-text/90"
            >
              <p v-if="riotPollerLogsLoading" class="text-text/70">Chargement…</p>
              <p v-else-if="riotPollerLogsError" class="text-error">{{ riotPollerLogsError }}</p>
              <template v-else-if="riotPollerLogs.length === 0">Aucun log.</template>
              <template v-else>
                <div v-for="(line, i) in riotPollerLogs" :key="i">{{ line }}</div>
              </template>
            </div>
          </div>
        </div>
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
                <tr
                  v-for="row in matchupTierRows"
                  :key="row.championId"
                  class="hover:bg-surface/50"
                >
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
                  <tr
                    v-for="(job, jobId) in cron.cronJobs"
                    :key="jobId"
                    class="hover:bg-surface/50"
                  >
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
                {{
                  riotApikeyTesting ? t('admin.riotApikey.testing') : t('admin.riotApikey.testKey')
                }}
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
                          <td
                            class="min-w-[120px] px-3 py-2 font-medium text-text"
                            :title="p.puuid"
                          >
                            {{ p.summonerName || t('admin.seedPlayers.noName') }}
                          </td>
                          <td class="px-3 py-2 font-mono text-xs text-text/60" :title="p.puuid">
                            {{ p.puuid.slice(0, 16) }}…
                          </td>
                          <td class="px-3 py-2 text-text/80">{{ p.region }}</td>
                          <td class="px-3 py-2 text-text/80">{{ p.rankTier || '—' }}</td>
                          <td class="px-3 py-2 text-text/80">
                            {{ p.totalGames }} {{ t('admin.seedPlayers.games') }}, {{ p.winrate }}%
                            WR
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

      <!-- Tab: Logs (full width container) -->
      <div v-show="activeTab === 'logs'" class="w-full space-y-4">
        <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
          <h2 class="mb-4 text-lg font-semibold text-text">{{ t('admin.logs.title') }}</h2>
          <div class="mb-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label class="flex flex-col gap-1 text-xs text-text/80">
              {{ t('admin.logs.section') }}
              <select
                v-model="unifiedLogSection"
                class="rounded border border-primary/50 bg-background px-2 py-1.5 text-sm text-text"
              >
                <option value="">{{ t('admin.logs.all') }}</option>
                <option value="back">back</option>
                <option value="front">front</option>
                <option value="db">db</option>
              </select>
            </label>
            <label class="flex flex-col gap-1 text-xs text-text/80">
              {{ t('admin.logs.type') }}
              <select
                v-model="unifiedLogType"
                class="rounded border border-primary/50 bg-background px-2 py-1.5 text-sm text-text"
              >
                <option value="">{{ t('admin.logs.all') }}</option>
                <option value="debut">debut</option>
                <option value="fin">fin</option>
                <option value="erreur">erreur</option>
                <option value="warning">warning</option>
                <option value="info">info</option>
                <option value="rate_limit">rate_limit</option>
                <option value="verification">verification</option>
                <option value="step">step</option>
              </select>
            </label>
            <label class="flex flex-col gap-1 text-xs text-text/80">
              {{ t('admin.logs.script') }}
              <input
                v-model="unifiedLogScript"
                type="text"
                list="admin-log-scripts"
                placeholder="poller, datadragon…"
                class="min-w-[9rem] rounded border border-primary/50 bg-background px-2 py-1.5 text-sm text-text"
              />
              <datalist id="admin-log-scripts">
                <option value="poller" />
                <option value="datadragon" />
                <option value="youtube" />
                <option value="community_dragon" />
                <option value="mv_refresh" />
                <option value="poller_hourly" />
                <option value="puuid_migration" />
                <option value="league_xp" />
                <option value="frontend" />
              </datalist>
            </label>
            <label class="flex flex-col gap-1 text-xs text-text/80">
              {{ t('admin.logs.from') }}
              <input
                v-model="unifiedLogFrom"
                type="datetime-local"
                class="rounded border border-primary/50 bg-background px-2 py-1.5 text-sm text-text"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-text/80">
              {{ t('admin.logs.to') }}
              <input
                v-model="unifiedLogTo"
                type="datetime-local"
                class="rounded border border-primary/50 bg-background px-2 py-1.5 text-sm text-text"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-text/80">
              {{ t('admin.logs.search') }}
              <input
                v-model="unifiedLogSearch"
                type="search"
                class="min-w-[8rem] rounded border border-primary/50 bg-background px-2 py-1.5 text-sm text-text"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-text/80">
              {{ t('admin.logs.sort') }}
              <select
                v-model="unifiedLogSort"
                class="rounded border border-primary/50 bg-background px-2 py-1.5 text-sm text-text"
              >
                <option value="desc">{{ t('admin.logs.sortDesc') }}</option>
                <option value="asc">{{ t('admin.logs.sortAsc') }}</option>
              </select>
            </label>
            <div class="col-span-1 flex w-full flex-wrap gap-2 sm:col-span-2 xl:col-span-4">
              <button
                type="button"
                class="flex-1 rounded bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 sm:flex-none"
                :disabled="unifiedLogsLoading"
                @click="applyUnifiedLogFilters"
              >
                {{ unifiedLogsLoading ? '…' : t('admin.logs.apply') }}
              </button>
              <button
                type="button"
                class="flex-1 rounded border border-primary/40 bg-surface px-3 py-2 text-sm font-medium text-text hover:bg-primary/10 disabled:opacity-50 sm:flex-none"
                :disabled="unifiedLogsLoading"
                @click="refreshUnifiedLogs"
              >
                {{ unifiedLogsLoading ? '…' : 'Actualiser' }}
              </button>
            </div>
          </div>
          <div
            class="mb-4 flex flex-col gap-3 rounded border border-error/30 bg-error/5 p-3 text-sm sm:flex-row sm:flex-wrap sm:items-center"
          >
            <span class="font-medium text-text">{{ t('admin.logs.deleteRange') }}</span>
            <input
              v-model="unifiedLogDeleteFrom"
              type="datetime-local"
              class="w-full rounded border border-primary/50 bg-background px-2 py-1 text-text sm:w-auto"
            />
            <span class="text-text/60">→</span>
            <input
              v-model="unifiedLogDeleteTo"
              type="datetime-local"
              class="w-full rounded border border-primary/50 bg-background px-2 py-1 text-text sm:w-auto"
            />
            <button
              type="button"
              class="rounded border border-error bg-error/20 px-3 py-1.5 font-medium text-error hover:bg-error/30"
              :disabled="unifiedLogsDeleting"
              @click="deleteUnifiedLogsRange"
            >
              {{ unifiedLogsDeleting ? '…' : t('admin.logs.deleteButton') }}
            </button>
            <span v-if="unifiedLogsDeleteMessage" class="text-text">{{
              unifiedLogsDeleteMessage
            }}</span>
          </div>
          <p v-if="unifiedLogsLoading" class="text-text/70">{{ t('admin.loading') }}</p>
          <p v-else class="mb-2 text-sm text-text/70">
            {{ t('admin.logs.total', { n: unifiedLogsTotal }) }}
          </p>
          <div class="w-full overflow-x-auto rounded border border-primary/20">
            <table class="w-full min-w-[56rem] text-left text-sm">
              <thead class="sticky top-0 z-10 border-b border-primary/30 bg-surface/95">
                <tr>
                  <th
                    class="cursor-pointer px-2 py-2 font-semibold text-text"
                    @click="toggleUnifiedSort('script')"
                  >
                    {{ t('admin.logs.colScript') }}
                    {{ unifiedSortKey === 'script' ? (unifiedSortDir === 'asc' ? '▲' : '▼') : '' }}
                  </th>
                  <th
                    class="cursor-pointer px-2 py-2 font-semibold text-text"
                    @click="toggleUnifiedSort('type')"
                  >
                    {{ t('admin.logs.colType') }}
                    {{ unifiedSortKey === 'type' ? (unifiedSortDir === 'asc' ? '▲' : '▼') : '' }}
                  </th>
                  <th
                    class="cursor-pointer px-2 py-2 font-semibold text-text"
                    @click="toggleUnifiedSort('atIso')"
                  >
                    {{ t('admin.logs.colDate') }}
                    {{ unifiedSortKey === 'atIso' ? (unifiedSortDir === 'asc' ? '▲' : '▼') : '' }}
                  </th>
                  <th class="px-2 py-2 font-semibold text-text">
                    {{ t('admin.logs.colMessage') }}
                  </th>
                  <th class="px-2 py-2 font-semibold text-text">{{ t('admin.logs.colJson') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, idx) in unifiedLogsDisplay"
                  :key="`${row.atIso}-${idx}-${row.lineNumber}`"
                  class="border-b border-primary/10 odd:bg-background/20"
                >
                  <td class="max-w-[8rem] truncate px-2 py-1.5 font-mono text-xs text-text">
                    {{ row.script }}
                  </td>
                  <td class="max-w-[6rem] truncate px-2 py-1.5 text-xs text-text">
                    {{ row.type }}
                  </td>
                  <td class="whitespace-nowrap px-2 py-1.5 text-xs text-text/90">
                    {{ formatUnifiedLogDate(row.atIso) }}
                  </td>
                  <td class="max-w-[24rem] px-2 py-1.5 text-text">
                    <span class="line-clamp-2" :title="row.message">{{ row.message }}</span>
                  </td>
                  <td class="px-2 py-1.5">
                    <button
                      v-if="row.json"
                      type="button"
                      class="rounded border border-primary/40 bg-surface px-2 py-0.5 text-xs text-text hover:bg-primary/10"
                      @click="unifiedLogJsonModal = row"
                    >
                      JSON
                    </button>
                    <span v-else class="text-text/40">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div
            v-if="unifiedLogsTotal > unifiedLogLimit"
            class="mt-3 flex flex-wrap items-center gap-2 text-sm"
          >
            <button
              type="button"
              class="rounded border border-primary/40 px-3 py-1 disabled:opacity-50"
              :disabled="unifiedLogOffset <= 0 || unifiedLogsLoading"
              @click="unifiedLogsGoPrev"
            >
              {{ t('admin.pagination.prev') }}
            </button>
            <span class="text-text/80">
              {{ t('admin.pagination.page') }}
              {{ Math.floor(unifiedLogOffset / unifiedLogLimit) + 1 }}
            </span>
            <button
              type="button"
              class="rounded border border-primary/40 px-3 py-1 disabled:opacity-50"
              :disabled="
                unifiedLogOffset + unifiedLogLimit >= unifiedLogsTotal || unifiedLogsLoading
              "
              @click="unifiedLogsGoNext"
            >
              {{ t('admin.pagination.next') }}
            </button>
          </div>
        </div>
        <div
          v-if="unifiedLogJsonModal"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black p-4"
          role="dialog"
          aria-modal="true"
          @click.self="unifiedLogJsonModal = null"
        >
          <div
            class="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-lg border border-primary/30 bg-background shadow-xl"
          >
            <div class="flex items-center justify-between border-b border-primary/20 px-4 py-2">
              <span class="font-semibold text-text">{{ t('admin.logs.jsonTitle') }}</span>
              <button
                type="button"
                class="rounded px-2 py-1 text-sm text-text hover:bg-primary/20"
                @click="unifiedLogJsonModal = null"
              >
                ✕
              </button>
            </div>
            <div class="max-h-[70vh] overflow-auto p-4">
              <pre class="whitespace-pre-wrap break-all font-mono text-xs text-text">{{
                prettyUnifiedJson(unifiedLogJsonModal.json)
              }}</pre>
            </div>
            <div class="border-t border-primary/20 px-4 py-2">
              <button
                type="button"
                class="rounded bg-accent px-3 py-1.5 text-sm text-white"
                @click="copyUnifiedJson(unifiedLogJsonModal)"
              >
                {{ t('admin.logs.copyJson') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: Videos -->
      <div v-show="activeTab === 'videos'" class="space-y-6">
        <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
          <h2 class="mb-4 text-lg font-semibold text-text">{{ t('admin.videos.title') }}</h2>
          <div class="mb-4">
            <h3 class="mb-2 text-sm font-medium text-text">{{ t('admin.videos.cronStatus') }}</h3>
            <p v-if="cronLoading" class="text-text/70">Chargement…</p>
            <div v-else class="space-y-1 text-sm text-text/80">
              <p>
                {{ t('admin.videos.lastSuccess') }}:
                {{ cron?.cronJobs?.youtubeSync?.lastSuccessAt ?? '—' }}
              </p>
              <p v-if="cron?.cronJobs?.youtubeSync?.lastFailureAt">
                {{ t('admin.videos.lastFailure') }}:
                {{ cron?.cronJobs?.youtubeSync?.lastFailureAt }}
                ({{ cron?.cronJobs?.youtubeSync?.lastFailureMessage ?? '' }})
              </p>
            </div>
          </div>
          <div class="mb-4">
            <button
              type="button"
              class="rounded bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              :disabled="videosTriggering"
              @click="triggerVideosSync"
            >
              {{ videosTriggering ? '…' : t('admin.videos.trigger') }}
            </button>
            <p
              v-if="videosTriggerMessage"
              :class="videosTriggerError ? 'text-error' : 'text-green-600'"
              class="mt-2 text-sm"
            >
              {{ videosTriggerMessage }}
            </p>
          </div>
          <div>
            <h3 class="mb-2 text-sm font-medium text-text">{{ t('admin.videos.addChannel') }}</h3>
            <form class="flex flex-wrap gap-2" @submit.prevent="addChannel">
              <input
                v-model="newChannelHandle"
                type="text"
                :placeholder="t('admin.videos.addChannelPlaceholder')"
                class="min-w-[200px] rounded border border-primary/50 bg-background px-3 py-2 text-text"
              />
              <button
                type="submit"
                class="rounded bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                :disabled="videosAdding || !(newChannelHandle ?? '').trim()"
              >
                {{ videosAdding ? '…' : t('admin.videos.addChannel') }}
              </button>
            </form>
            <p
              v-if="videosAddMessage"
              :class="videosAddError ? 'text-error' : 'text-green-600'"
              class="mt-2 text-sm"
            >
              {{ videosAddMessage }}
            </p>
          </div>
          <div v-if="(cron?.youtube?.channels?.length ?? 0) > 0" class="mt-4">
            <h3 class="mb-2 text-sm font-medium text-text">{{ t('admin.videos.channels') }}</h3>
            <ul class="space-y-1 text-sm text-text/80">
              <li v-for="c in cron?.youtube?.channels ?? []" :key="c.channelId">
                {{ c.channelName ?? c.channelId }} · {{ c.videoCount ?? 0 }} vidéos ·
                {{ c.lastSync ?? '—' }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { apiUrl } from '~/utils/apiUrl'
import { useAdminAuth } from '~/composables/useAdminAuth'

definePageMeta({
  layout: false,
})

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { fetchWithAuth, clearAuth, checkLoggedIn } = useAdminAuth()

const VALID_TABS = ['contact', 'videos', 'data', 'logs'] as const
type AdminTab = (typeof VALID_TABS)[number]

const authError = ref<string | null>(null)
const activeTab = ref<AdminTab>(
  (route.query.tab as AdminTab) && VALID_TABS.includes(route.query.tab as AdminTab)
    ? (route.query.tab as AdminTab)
    : 'contact'
)

const adminTabs = computed(() => [
  { id: 'contact' as const, label: t('admin.tabs.contact') },
  { id: 'videos' as const, label: t('admin.tabs.videos') },
  { id: 'data' as const, label: t('admin.tabs.data') },
  { id: 'logs' as const, label: t('admin.tabs.logs') },
])

type RiotScriptField = {
  key: string
  label: string
  type: 'text' | 'number' | 'select'
  placeholder?: string
  defaultValue?: string
  options?: Array<{ value: string; label: string }>
}
type RiotScriptCard = {
  id: string
  label: string
  description: string
  runMode: 'generic' | 'collect' | 'backfillUntilDone' | 'discoverPlayers' | 'discoverLeagueExp'
  fields: RiotScriptField[]
}

const riotScriptCards = computed<RiotScriptCard[]>(() => [
  {
    id: 'riot:collect',
    label: t('admin.riotMatch.scripts.collectOnce'),
    description: t('admin.riotMatch.scripts.descriptions.collectOnce'),
    runMode: 'collect',
    fields: [],
  },
  {
    id: 'riot:backfill-until-done',
    label: t('admin.riotMatch.scripts.backfillUntilDone'),
    description: t('admin.riotMatch.scripts.descriptions.backfillUntilDone'),
    runMode: 'backfillUntilDone',
    fields: [],
  },
  {
    id: 'riot:discover-league-exp',
    label: t('admin.riotMatch.scripts.discoverLeagueExp'),
    description: t('admin.riotMatch.scripts.descriptions.discoverLeagueExp'),
    runMode: 'discoverLeagueExp',
    fields: [
      {
        key: 'platform',
        label: 'Platform',
        type: 'select',
        defaultValue: 'euw1',
        options: [
          { value: 'euw1', label: 'EUW1' },
          { value: 'eun1', label: 'EUN1' },
        ],
      },
      {
        key: 'queue',
        label: 'Queue',
        type: 'select',
        defaultValue: 'RANKED_SOLO_5x5',
        options: [{ value: 'RANKED_SOLO_5x5', label: 'RANKED_SOLO_5x5' }],
      },
      {
        key: 'tier',
        label: 'Tier',
        type: 'select',
        defaultValue: 'GOLD',
        options: [
          { value: 'IRON', label: 'IRON' },
          { value: 'BRONZE', label: 'BRONZE' },
          { value: 'SILVER', label: 'SILVER' },
          { value: 'GOLD', label: 'GOLD' },
          { value: 'PLATINUM', label: 'PLATINUM' },
          { value: 'EMERALD', label: 'EMERALD' },
          { value: 'DIAMOND', label: 'DIAMOND' },
          { value: 'MASTER', label: 'MASTER' },
          { value: 'GRANDMASTER', label: 'GRANDMASTER' },
          { value: 'CHALLENGER', label: 'CHALLENGER' },
        ],
      },
      {
        key: 'division',
        label: 'Division',
        type: 'select',
        defaultValue: 'I',
        options: [
          { value: 'I', label: 'I' },
          { value: 'II', label: 'II' },
          { value: 'III', label: 'III' },
          { value: 'IV', label: 'IV' },
        ],
      },
      { key: 'pages', label: 'Pages', type: 'number', defaultValue: '3', placeholder: '3' },
    ],
  },
  {
    id: 'riot:discover-players',
    label: t('admin.riotMatch.scripts.discoverPlayers'),
    description: t('admin.riotMatch.scripts.descriptions.discoverPlayers'),
    runMode: 'discoverPlayers',
    fields: [
      {
        key: 'region',
        label: t('admin.riotMatch.scripts.discoverPlayersRegion'),
        type: 'select',
        defaultValue: 'euw1',
        options: [
          { value: 'euw1', label: 'EUW' },
          { value: 'eun1', label: 'EUNE' },
          { value: 'tr1', label: 'TR' },
          { value: 'ru', label: 'RU' },
          { value: 'me1', label: 'ME' },
          { value: 'na1', label: 'NA' },
          { value: 'br1', label: 'BR' },
          { value: 'la1', label: 'LA1' },
          { value: 'la2', label: 'LA2' },
          { value: 'oc1', label: 'OC1' },
          { value: 'kr', label: 'KR' },
          { value: 'jp1', label: 'JP' },
          { value: 'ph2', label: 'PH' },
          { value: 'sg2', label: 'SG' },
          { value: 'th2', label: 'TH' },
          { value: 'tw2', label: 'TW' },
          { value: 'vn2', label: 'VN' },
        ],
      },
      {
        key: 'riotId',
        label: t('admin.riotMatch.scripts.discoverPlayersRiotId'),
        type: 'text',
        defaultValue: '',
        placeholder: 'GameName#TagLine',
      },
      {
        key: 'replayCount',
        label: t('admin.riotMatch.scripts.discoverPlayersReplayCount'),
        type: 'number',
        defaultValue: '100',
        placeholder: '100',
      },
    ],
  },
])

// Contact
const CONTACT_TYPES = ['suggestion', 'bug', 'reclamation', 'autre'] as const
type ContactType = (typeof CONTACT_TYPES)[number]
interface ContactEntry {
  name: string
  message: string
  date: string
  contact?: string
}
type ContactData = Record<ContactType, ContactEntry[]>

const contactByCategory = ref<ContactData | null>(null)
const contactLoading = ref(false)
const contactDeleting = ref<string | null>(null)
const contactEmpty = computed(() => {
  if (!contactByCategory.value) return true
  return CONTACT_TYPES.every(k => !contactByCategory.value![k]?.length)
})

async function loadContact() {
  contactLoading.value = true
  authError.value = null
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/contact'))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    contactByCategory.value = data
  } catch {
    authError.value = t('admin.login.error')
  } finally {
    contactLoading.value = false
  }
}

async function deleteContact(type: string, index: number) {
  const key = `${type}-${index}`
  contactDeleting.value = key
  try {
    const res = await fetchWithAuth(apiUrl(`/api/admin/contact/${type}/${index}`), {
      method: 'DELETE',
    })
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    if (res.ok) await loadContact()
  } finally {
    contactDeleting.value = null
  }
}

// Data tab: Riot API stats, data stats
const riotApiStats = ref<{
  requestsLastHour: number
  requestsPerHourAvg: number
  rateLimitExceededCount: number
  limitPerTwoMin: number
  limitPerSecond: number
  limitPerHour: number
} | null>(null)

// Data tab: collapsible sections
const dataSectionCrons = ref(true)
const dataSectionPoller = ref(true)
type AdminDataCollectPollerResume = {
  script: string
  atIso: string
  message: string
  windowStartIso: string | null
  windowEndIso: string | null
  delta: Record<string, unknown>
  httpWindowStats: unknown
  dbWindow1h: unknown
  requestsPerHour: unknown
  httpRequestsProjectedPerHour: unknown
}
type AdminDataCollectStatsClient = {
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
  pollerResume: AdminDataCollectPollerResume | null
}
const dataStats = ref<AdminDataCollectStatsClient | null>(null)
const dataStatsLoading = ref(false)

function adminStatNum(v: unknown): string {
  if (typeof v === 'number' && Number.isFinite(v)) return String(Math.trunc(v))
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    return Number.isFinite(n) ? String(Math.trunc(n)) : '—'
  }
  return '—'
}

function formatPollerHttpWindowSummary(h: unknown): string {
  if (!h || typeof h !== 'object') return ''
  const o = h as Record<string, unknown>
  const bits: string[] = []
  if (typeof o.httpAvgPerMinuteOverall === 'number')
    bits.push(`moy ${o.httpAvgPerMinuteOverall}/min`)
  if (typeof o.httpAvgPer2MinUniform === 'number') bits.push(`moy/2min∼${o.httpAvgPer2MinUniform}`)
  if (typeof o.httpTwoMinBucketAvg === 'number') bits.push(`moy/2min réel ${o.httpTwoMinBucketAvg}`)
  if (typeof o.httpTwoMinBucketPeak === 'number') {
    const c = o.httpTwoMinBucketPeakCount
    bits.push(`pic/2min ${o.httpTwoMinBucketPeak}${typeof c === 'number' ? ` (${c}×)` : ''}`)
  }
  return bits.join(' · ')
}
const activePatches = ref<
  Array<{
    gameVersion: string
    gamesNumber: number
    gameNumberMax: number
    isCurrent: boolean
    archivedAt?: string | null
  }>
>([])
const selectedActivePatch = ref('')
const activePatchMaxInput = ref<number>(1000000)
const activePatchSaveBusy = ref(false)
const activePatchMessage = ref('')
const activePatchError = ref(false)
type PatchCloseOption = {
  patchLabel: string
  version: string
  releaseDate: string
  endExclusive: string
  isLatestInRecap: boolean
}
const patchCloseOptions = ref<PatchCloseOption[]>([])
const selectedPatchClose = ref('')
const patchCloseBusy = ref(false)
const patchCloseMessage = ref('')
const patchCloseError = ref(false)
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
const riotScriptsStatusCrons = ref<
  Array<{
    script: string
    type: string
    lastStartAt: string | null
    lastSuccessAt: string | null
    lastFailureAt: string | null
    lastFailureMessage: string | null
  }>
>([])
const riotPollerStatus = ref<{
  isRunning?: boolean
  status: string
  lastError: string | null
  lastLoopStartedAt: string | null
  lastLoopFinishedAt: string | null
  requestCount: number
  error429Count: number
  requestsPerMinute: number | null
  requestsPer2Min?: number | null
  error400Count: number
  matchesFetched: number
  playersFetched: number
  playersPolled?: number
  participantsFetched: number
  matchesRankFixed: number
  participantsRankFixed: number
  participantsRoleFixed: number
  latestPlayerLastSeenAt?: string | null
  statusSource?: 'process' | 'unified_log' | 'unified_log_stale'
  snapshotUpdatedAt?: string | null
  snapshotAgeMs?: number | null
  heartbeatStale?: boolean
  pollerExternal?: boolean
  nearLimitPauseCount?: number
  http429PauseCount?: number
} | null>(null)

const pollerV2Observability = ref<{
  ok: boolean
  stale: boolean
  ageMs: number | null
  data: {
    runtimeSeconds?: number
    rolling2m?: {
      apiRequests?: number
      api429?: number
      rateLimitGrantedCost?: number
      rateLimitDeniedCount?: number
      rateLimitWaitMsTotal?: number
      tokenBudget120?: number
      tokenUsagePct?: number
    }
    queue?: {
      discovery?: { waiting?: number; active?: number; failed?: number }
      hydration?: { waiting?: number; active?: number; failed?: number }
      ingestion?: { waiting?: number; active?: number; failed?: number }
      dataLagSeconds?: number | null
      tickDurationMs?: number | null
    }
    totals?: {
      playersPolled?: number
      playersUpdated?: number
      playersAdded?: number
      matchesQueuedHydration?: number
      matchesIngested?: number
      apiRequests?: number
      api429?: number
      rateLimitGrantedCost?: number
      rateLimitDeniedCount?: number
    }
    summaries?: {
      last30m?: {
        dbWindow?: {
          playersPolled?: number
          playersUpdated?: number
          playersAdded?: number
          matchesAdded?: number
        }
      } | null
      last1h?: {
        dbWindow?: {
          playersPolled?: number
          playersUpdated?: number
          playersAdded?: number
          matchesAdded?: number
        }
      } | null
    }
  } | null
} | null>(null)

type PollerMetricsBucketRow = {
  key: string
  periodStartIso: string
  requests: number
  error429: number
  error400: number
  matches: number
  matchesApiIngestComplete?: number
  participants: number
  playersPolled: number
  newPlayers: number
  rateLimitRefreshPauses: number
  rateLimit429Pauses: number
  sampleCount: number
}

type PollerMetricsPresetId = '24h' | '7d' | '30d'

const pollerMetricsPresets: Array<{ id: PollerMetricsPresetId; label: string }> = [
  { id: '24h', label: '24 h (horaire)' },
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
]

const pollerMetricsGranularity = ref<'hour' | 'day'>('hour')
const pollerMetricsHours = ref(24)
const pollerMetricsDays = ref(14)
const pollerMetricsSource = ref<'both' | 'hourly' | '30m'>('hourly')
const pollerMetricsLoading = ref(false)
const pollerMetricsError = ref('')
const pollerMetricsBuckets = ref<PollerMetricsBucketRow[]>([])
const pollerMetricsTotals = ref<{
  requests: number
  error429: number
  error400: number
  matches: number
  matchesApiIngestComplete?: number
  participants: number
  playersPolled: number
  newPlayers: number
  rateLimitRefreshPauses: number
  rateLimit429Pauses: number
  sampleCount: number
} | null>(null)
const pollerMetricsMatchedLines = ref(0)
const pollerMetricsRange = ref<{ fromIso: string; toIso: string } | null>(null)
const pollerChartMetric = ref<'requests' | 'matches' | 'matchesApi'>('requests')

function formatPollerCompact(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const x = Math.round(n)
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`
  if (x >= 10_000) return `${Math.round(x / 1000)}k`
  if (x >= 1000) return `${(x / 1000).toFixed(1)}k`
  return String(x)
}

const pollerMetricsRangeLabel = computed(() => {
  const r = pollerMetricsRange.value
  if (!r?.fromIso || !r?.toIso) return ''
  try {
    const a = new Date(r.fromIso)
    const b = new Date(r.toIso)
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return `${r.fromIso} → ${r.toIso}`
    const fmt = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19)
    return `${fmt(a)} → ${fmt(b)}`
  } catch {
    return `${r.fromIso} → ${r.toIso}`
  }
})

const pollerChartMetricLabel = computed(() => {
  if (pollerChartMetric.value === 'requests') return 'requêtes HTTP'
  if (pollerChartMetric.value === 'matchesApi') return 'paires match + timeline'
  return 'matchs insérés en DB'
})

const pollerChartGeometry = computed(() => {
  const rows = pollerMetricsBuckets.value
  const metric = pollerChartMetric.value
  if (rows.length === 0) return null
  const W = 880
  const H = 208
  const padL = 8
  const padR = 8
  const padT = 22
  const padB = 6
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const values = rows.map(r => {
    if (metric === 'requests') return r.requests
    if (metric === 'matches') return r.matches
    return r.matchesApiIngestComplete ?? 0
  })
  const maxV = Math.max(1, ...values)
  const n = rows.length
  const gap = n > 160 ? 0 : n > 80 ? 0.25 : n > 40 ? 0.5 : 1
  const barW = Math.max(0.35, (innerW - gap * Math.max(0, n - 1)) / n)
  const baselineY = padT + innerH
  const bars = rows.map((row, i) => {
    const v = values[i] ?? 0
    const hRaw = (v / maxV) * innerH
    const hVis = v > 0 ? Math.max(hRaw, 0.8) : 0
    const x = padL + i * (barW + gap)
    const y = baselineY - hVis
    return { x, y, w: barW, h: hVis, key: row.key, v }
  })
  return { W, H, padL, padR, padT, padB, innerH, baselineY, bars, maxV }
})

function applyPollerMetricsPreset(id: PollerMetricsPresetId) {
  if (id === '24h') {
    pollerMetricsGranularity.value = 'hour'
    pollerMetricsHours.value = 24
    pollerMetricsSource.value = 'hourly'
  } else if (id === '7d') {
    pollerMetricsGranularity.value = 'day'
    pollerMetricsDays.value = 7
    pollerMetricsSource.value = 'hourly'
  } else {
    pollerMetricsGranularity.value = 'day'
    pollerMetricsDays.value = 30
    pollerMetricsSource.value = 'hourly'
  }
  loadPollerMetrics().catch(() => undefined)
}

function formatPollerMetricPeriod(row: PollerMetricsBucketRow): string {
  const g = pollerMetricsGranularity.value
  if (g === 'day') return row.key
  if (row.key.length >= 13) {
    const d = row.key.slice(0, 10)
    const h = row.key.slice(11, 13)
    return `${d} ${h}h`
  }
  return row.key
}

async function loadPollerMetrics() {
  pollerMetricsLoading.value = true
  pollerMetricsError.value = ''
  try {
    const params = new URLSearchParams()
    params.set('granularity', pollerMetricsGranularity.value)
    params.set('source', pollerMetricsSource.value)
    if (pollerMetricsGranularity.value === 'hour') {
      params.set('hours', String(Math.min(168, Math.max(1, pollerMetricsHours.value || 72))))
    } else {
      params.set('days', String(Math.min(90, Math.max(1, pollerMetricsDays.value || 14))))
    }
    const res = await fetchWithAuth(apiUrl(`/api/admin/riot-poller/metrics?${params.toString()}`))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      pollerMetricsError.value = data?.error ?? `Erreur ${res.status}`
      pollerMetricsBuckets.value = []
      pollerMetricsTotals.value = null
      pollerMetricsRange.value = null
      return
    }
    pollerMetricsBuckets.value = Array.isArray(data?.buckets) ? data.buckets : []
    pollerMetricsTotals.value = data?.totals ?? null
    pollerMetricsMatchedLines.value = typeof data?.matchedLines === 'number' ? data.matchedLines : 0
    if (typeof data?.fromIso === 'string' && typeof data?.toIso === 'string') {
      pollerMetricsRange.value = { fromIso: data.fromIso, toIso: data.toIso }
    } else {
      pollerMetricsRange.value = null
    }
  } catch (e) {
    pollerMetricsError.value = e instanceof Error ? e.message : 'Erreur réseau'
    pollerMetricsBuckets.value = []
    pollerMetricsTotals.value = null
    pollerMetricsRange.value = null
  } finally {
    pollerMetricsLoading.value = false
  }
}
const riotScriptStatusRows = computed(() => {
  const s = riotScriptsStatus.value
  return [
    { id: 'poller', label: 'Riot Poller', status: s?.poller?.status ?? 'stopped' },
    {
      id: 'puuid-migration',
      label: 'Migration players (PUUID)',
      status: s?.['puuid-migration']?.status ?? 'stopped',
    },
    { id: 'league-xp', label: 'League XP', status: s?.['league-xp']?.status ?? 'stopped' },
  ]
})
const scriptSwitchBusy = ref<Record<string, boolean>>({})
const scriptStopBusy = ref<Record<string, boolean>>({})
const scriptActionMessage = ref('')
const scriptActionError = ref(false)
const leagueXpForm = ref({
  queue: 'RANKED_SOLO_5x5',
  tier: 'GOLD',
  division: 'I',
  region: 'euw1',
  maxPages: 3,
})
const riotPollerLogsOpen = ref(false)
const riotPollerLogs = ref<string[]>([])
const riotPollerLogsLoading = ref(false)
const riotPollerLogsError = ref<string | null>(null)
const riotPollerStartBusy = ref(false)
const riotPollerStopBusy = ref(false)
const riotPollerActionMessage = ref('')
const riotPollerActionError = ref(false)

async function loadRiotApiStats() {
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/riot-api-stats'))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    riotApiStats.value = await res.json()
  } catch {
    riotApiStats.value = null
  }
}

async function loadDataStats() {
  dataStatsLoading.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/data-stats'))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    dataStats.value = await res.json()
  } catch {
    dataStats.value = null
  } finally {
    dataStatsLoading.value = false
  }
}

async function loadActivePatches() {
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/active-patches'))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    activePatches.value = Array.isArray(data?.patches) ? data.patches : []
    if (!selectedActivePatch.value && activePatches.value.length > 0) {
      const first = activePatches.value[0]
      if (first) {
        selectedActivePatch.value = first.gameVersion
        activePatchMaxInput.value = first.gameNumberMax
      }
    }
  } catch {
    activePatches.value = []
  }
}

async function loadPatchCloseOptions() {
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/patch-close-options'))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    patchCloseOptions.value = Array.isArray(data?.options) ? data.options : []
  } catch {
    patchCloseOptions.value = []
  }
}

async function runPatchClose() {
  if (!selectedPatchClose.value) return
  if (
    !confirm(
      `Fermer le patch ${selectedPatchClose.value} ? Les agrégats seront archivés (close_patch) et les snapshots quotidiens de la fenêtre versions.json seront déplacés vers l’archive.`
    )
  ) {
    return
  }
  patchCloseMessage.value = ''
  patchCloseError.value = false
  patchCloseBusy.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/patch-close'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patchLabel: selectedPatchClose.value }),
    })
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    if (res.ok) {
      const cs = data.closeSummary as
        | {
            gamesNumber?: number
            rankedMatchCount?: number
            rowsInserted?: Record<string, number>
          }
        | undefined
      const ranked = cs?.rankedMatchCount ?? cs?.gamesNumber
      const coreRows = cs?.rowsInserted?.agg_champion_core_stats
      patchCloseMessage.value = `Patch ${data.patch} fermé. Matchs classés (somme outcome) : ${ranked ?? '—'}. Lignes core archivées : ${coreRows ?? '—'}. Snapshots : ${data.snapshotRowsArchived ?? 0} ligne(s).`
      await loadActivePatches()
      await loadPatchCloseOptions()
    } else {
      patchCloseError.value = true
      patchCloseMessage.value = data?.error ?? 'Erreur'
    }
  } catch {
    patchCloseError.value = true
    patchCloseMessage.value = 'Erreur réseau'
  } finally {
    patchCloseBusy.value = false
  }
}

watch(selectedActivePatch, patch => {
  const row = activePatches.value.find(p => p.gameVersion === patch)
  if (row) activePatchMaxInput.value = row.gameNumberMax
})

async function saveActivePatchMax() {
  if (!selectedActivePatch.value || !(activePatchMaxInput.value > 0)) return
  activePatchMessage.value = ''
  activePatchError.value = false
  activePatchSaveBusy.value = true
  try {
    const res = await fetchWithAuth(
      apiUrl(`/api/admin/active-patches/${encodeURIComponent(selectedActivePatch.value)}/max`),
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameNumberMax: activePatchMaxInput.value }),
      }
    )
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    if (res.ok) {
      activePatchMessage.value = 'Patch mis à jour.'
      await loadActivePatches()
    } else {
      activePatchError.value = true
      activePatchMessage.value = data?.error ?? 'Erreur'
    }
  } catch {
    activePatchError.value = true
    activePatchMessage.value = 'Erreur réseau'
  } finally {
    activePatchSaveBusy.value = false
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
const riotScriptMessage = ref('')
const riotScriptError = ref(false)
const riotScriptFields = ref<Record<string, Record<string, string>>>({})
const riotScriptBusy = ref<Record<string, boolean>>({})
const riotScriptStopBusy = ref<Record<string, boolean>>({})
const riotScriptsStatus = ref<Record<string, any>>({})
/** Miroir de `dataStats` depuis `/api/admin/riot-scripts-status` (même charge utile que `/api/admin/data-stats`). */
const riotDataStats = ref<AdminDataCollectStatsClient | null>(null)
const riotScriptLogsOpen = ref(false)
const riotScriptLogsLoading = ref(false)
const riotScriptLogsTitle = ref('')
const riotScriptLogs = ref<string[]>([])
const scriptLogsDir = ref('logs/scripts')

const allLogsOpen = ref(false)
const allLogsLoading = ref(false)
const allLogsFilter = ref('all')
const cronTriggering = ref<Record<string, boolean>>({})
const cronTriggerMessage = ref('')
const cronTriggerError = ref(false)
const syncDataBusy = ref(false)
const allLogsSort = ref<'asc' | 'desc'>('desc')
const allLogsLines = ref(200)
const allLogsList = ref<string[]>([])
const allLogsScripts = ref<string[]>([])

type UnifiedLogEntry = {
  raw: string
  section: string
  type: string
  script: string
  atIso: string
  message: string
  json: Record<string, unknown> | null
  lineNumber: number
}
const unifiedLogsLoading = ref(false)
const unifiedLogsFetched = ref<UnifiedLogEntry[]>([])
const unifiedLogsTotal = ref(0)
const unifiedLogsPathHint = ref('')
const unifiedLogSection = ref('')
const unifiedLogType = ref('')
const unifiedLogScript = ref('')
const unifiedLogFrom = ref('')
const unifiedLogTo = ref('')
const unifiedLogSearch = ref('')
const unifiedLogSort = ref<'asc' | 'desc'>('desc')
const unifiedLogLimit = 500
const unifiedLogOffset = ref(0)
const unifiedSortKey = ref<'atIso' | 'script' | 'type' | 'message'>('atIso')
const unifiedSortDir = ref<'asc' | 'desc'>('desc')
const unifiedLogJsonModal = ref<UnifiedLogEntry | null>(null)
const unifiedLogDeleteFrom = ref('')
const unifiedLogDeleteTo = ref('')
const unifiedLogsDeleting = ref(false)
const unifiedLogsDeleteMessage = ref('')

const unifiedLogsDisplay = computed(() => {
  const rows = [...unifiedLogsFetched.value]
  const k = unifiedSortKey.value
  const dir = unifiedSortDir.value
  const m = dir === 'asc' ? 1 : -1
  rows.sort((a, b) => {
    const va = String(a[k] ?? '')
    const vb = String(b[k] ?? '')
    if (k === 'atIso') return m * va.localeCompare(vb)
    return m * va.localeCompare(vb, undefined, { sensitivity: 'base' })
  })
  return rows
})

function formatUnifiedLogDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function toggleUnifiedSort(key: 'atIso' | 'script' | 'type' | 'message') {
  if (unifiedSortKey.value === key) {
    unifiedSortDir.value = unifiedSortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    unifiedSortKey.value = key
    unifiedSortDir.value = key === 'atIso' ? 'desc' : 'asc'
  }
}

function prettyUnifiedJson(j: Record<string, unknown> | null): string {
  if (!j) return ''
  try {
    return JSON.stringify(j, null, 2)
  } catch {
    return String(j)
  }
}

async function copyUnifiedJson(row: UnifiedLogEntry) {
  const text = prettyUnifiedJson(row.json)
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* ignore */
  }
}

function datetimeLocalToIso(local: string): string | undefined {
  if (!local || !local.trim()) return undefined
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}

function applyUnifiedLogFilters() {
  unifiedLogOffset.value = 0
  loadUnifiedLogs().catch(() => {})
}

function refreshUnifiedLogs() {
  loadUnifiedLogs().catch(() => {})
}

function unifiedLogsGoPrev() {
  unifiedLogOffset.value = Math.max(0, unifiedLogOffset.value - unifiedLogLimit)
  loadUnifiedLogs().catch(() => {})
}

function unifiedLogsGoNext() {
  unifiedLogOffset.value += unifiedLogLimit
  loadUnifiedLogs().catch(() => {})
}

async function loadUnifiedLogs() {
  unifiedLogsLoading.value = true
  unifiedLogsDeleteMessage.value = ''
  try {
    const params = new URLSearchParams()
    if (unifiedLogSection.value.trim()) params.set('section', unifiedLogSection.value.trim())
    if (unifiedLogType.value.trim()) params.set('type', unifiedLogType.value.trim())
    if (unifiedLogScript.value.trim()) params.set('script', unifiedLogScript.value.trim())
    const fromIso = datetimeLocalToIso(unifiedLogFrom.value)
    const toIso = datetimeLocalToIso(unifiedLogTo.value)
    if (fromIso) params.set('from', fromIso)
    if (toIso) params.set('to', toIso)
    if (unifiedLogSearch.value.trim()) params.set('search', unifiedLogSearch.value.trim())
    params.set('sort', unifiedLogSort.value)
    params.set('limit', String(unifiedLogLimit))
    params.set('offset', String(unifiedLogOffset.value))
    const res = await fetchWithAuth(apiUrl(`/api/admin/unified-logs?${params.toString()}`))
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      unifiedLogsFetched.value = []
      unifiedLogsTotal.value = 0
      return
    }
    unifiedLogsFetched.value = Array.isArray(data.entries) ? data.entries : []
    unifiedLogsTotal.value = typeof data.totalMatched === 'number' ? data.totalMatched : 0
    unifiedLogsPathHint.value = typeof data.logPath === 'string' ? data.logPath : ''
  } catch {
    unifiedLogsFetched.value = []
    unifiedLogsTotal.value = 0
  } finally {
    unifiedLogsLoading.value = false
  }
}

async function deleteUnifiedLogsRange() {
  const fromIso = datetimeLocalToIso(unifiedLogDeleteFrom.value)
  const toIso = datetimeLocalToIso(unifiedLogDeleteTo.value)
  if (!fromIso || !toIso) {
    unifiedLogsDeleteMessage.value = 'Plage invalide'
    return
  }
  if (!confirm('Supprimer définitivement les entrées dans cette plage ?')) return
  unifiedLogsDeleting.value = true
  unifiedLogsDeleteMessage.value = ''
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/unified-logs'), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromIso, toIso }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.ok) {
      unifiedLogsDeleteMessage.value = `Supprimé : ${data.removed ?? 0} ligne(s)`
      unifiedLogOffset.value = 0
      await loadUnifiedLogs()
    } else {
      unifiedLogsDeleteMessage.value = data.error || 'Erreur'
    }
  } catch {
    unifiedLogsDeleteMessage.value = 'Erreur réseau'
  } finally {
    unifiedLogsDeleting.value = false
  }
}

const videosTriggering = ref(false)
const videosTriggerMessage = ref('')
const videosTriggerError = ref(false)
const newChannelHandle = ref('')
const videosAdding = ref(false)
const videosAddMessage = ref('')
const videosAddError = ref(false)

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

// Replay links tool (admin)
const replaySummonerName = ref('')
const replayRegion = ref<
  | 'euw1'
  | 'eun1'
  | 'na1'
  | 'br1'
  | 'la1'
  | 'la2'
  | 'oc1'
  | 'kr'
  | 'jp1'
  | 'tr1'
  | 'ru'
  | 'me1'
  | 'ph2'
  | 'sg2'
  | 'th2'
  | 'tw2'
  | 'vn2'
>('euw1')
const replayCount = ref(10)
const replayLoading = ref(false)
const replayError = ref(false)
const replayMessage = ref('')
const replayResult = ref<{
  summonerName: string
  puuid: string
  region: string
  countRequested: number
  countReturned: number
  matches: Array<{
    matchId?: string
    replayUrl: string
  }>
} | null>(null)

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

function loadSeedPlayers() {
  seedPlayersLoading.value = true
  // try {
  //   const res = await fetchWithAuth(apiUrl('/api/admin/seed-players'))
  //   if (res.status === 401) {
  //     clearAuth()
  //     await navigateTo(localePath('/admin/login'))
  //     return
  //   }
  //   const data = await res.json()
  //   seedPlayersList.value = data?.players ?? []
  // } catch {
  //   authError.value = t('admin.login.error')
  // } finally {
  //   seedPlayersLoading.value = false
  // }
  seedPlayersLoading.value = false
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
    authError.value = t('admin.login.error')
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
    authError.value = t('admin.login.error')
  } finally {
    cronLoading.value = false
  }
}

function initRiotScriptFields() {
  const next: Record<string, Record<string, string>> = {}
  for (const script of riotScriptCards.value) {
    const values: Record<string, string> = {}
    for (const field of script.fields) values[field.key] = field.defaultValue ?? ''
    next[script.id] = values
  }
  riotScriptFields.value = next
}

function _riotStatusLabel(status: string | undefined) {
  if (status === 'running') return t('admin.riotMatch.scripts.status.running')
  if (status === 'started') return t('admin.riotMatch.scripts.status.started')
  if (status === 'failed') return t('admin.riotMatch.scripts.status.failed')
  return t('admin.riotMatch.scripts.status.stopped')
}

function _riotStatusClass(status: string | undefined) {
  if (status === 'running') return 'bg-green-600/20 text-green-700 dark:text-green-400'
  if (status === 'started') return 'bg-blue-600/20 text-blue-700 dark:text-blue-300'
  if (status === 'failed') return 'bg-red-500/20 text-red-700 dark:text-red-300'
  return 'bg-text/10 text-text/70'
}

function isScriptActive(scriptId: string) {
  const status = riotScriptsStatus.value?.[scriptId]?.status
  return status === 'running' || status === 'started'
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

async function loadRiotPollerStatus() {
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/riot-poller/status'))
    if (res.status === 401) return
    const data = await res.json()
    riotPollerStatus.value = data ?? null
  } catch {
    // Keep previous value on failure.
  }
}

async function loadPollerV2Observability() {
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/poller-v2/observability'))
    if (res.status === 401) return
    const data = await res.json().catch(() => null)
    pollerV2Observability.value = data
  } catch {
    // keep previous value
  }
}

async function loadRiotScriptsStatus() {
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/riot-scripts-status'))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    const next: Record<string, any> = {}
    for (const row of data?.scripts ?? []) next[row.script] = row
    riotScriptsStatus.value = next
    riotScriptsStatusCrons.value = Array.isArray(data?.crons) ? data.crons : []
    riotDataStats.value = data?.dataStats ?? null
    riotApiStats.value = data?.riotApiStats ?? null
    riotPollerStatus.value = data?.riotPoller ?? null
    // Refresh poller from dedicated endpoint so we always have up-to-date counts and requestsPerMinute
    await loadRiotPollerStatus()
    await loadPollerV2Observability()
  } catch {
    // If combined endpoint fails, still try to load poller status alone
    await loadRiotPollerStatus()
    await loadPollerV2Observability()
  }
}

function riotPollerStatusLabel(status: string | undefined): string {
  if (status === 'running') return 'En cours'
  if (status === 'error') return 'Erreur'
  return 'Arrêté'
}

function riotPollerStatusClass(status: string | undefined): string {
  if (status === 'running') return 'bg-green-600/20 text-green-700 dark:text-green-400'
  if (status === 'error') return 'bg-red-500/20 text-red-700 dark:text-red-300'
  return 'bg-text/10 text-text/70'
}

async function openRiotPollerLogs() {
  riotPollerLogsOpen.value = true
  riotPollerLogsLoading.value = true
  riotPollerLogsError.value = null
  riotPollerLogs.value = []
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

async function switchScript(
  script: 'poller' | 'puuid-migration' | 'league-xp',
  options?: Record<string, unknown>
) {
  scriptActionMessage.value = ''
  scriptActionError.value = false
  scriptSwitchBusy.value = { ...scriptSwitchBusy.value, [script]: true }
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/riot-script/switch'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script, options }),
    })
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    if (res.ok) {
      scriptActionMessage.value = data?.message ?? 'Script lancé.'
      await loadRiotScriptsStatus()
    } else {
      scriptActionError.value = true
      scriptActionMessage.value = data?.error ?? 'Erreur script'
    }
  } catch {
    scriptActionError.value = true
    scriptActionMessage.value = 'Erreur réseau'
  } finally {
    scriptSwitchBusy.value = { ...scriptSwitchBusy.value, [script]: false }
  }
}

async function stopScript(script: 'poller' | 'puuid-migration' | 'league-xp') {
  scriptActionMessage.value = ''
  scriptActionError.value = false
  scriptStopBusy.value = { ...scriptStopBusy.value, [script]: true }
  try {
    const activeScript =
      riotScriptsStatus.value?.poller?.status === 'running'
        ? 'poller'
        : riotScriptsStatus.value?.['puuid-migration']?.status === 'running'
          ? 'puuid-migration'
          : riotScriptsStatus.value?.['league-xp']?.status === 'running'
            ? 'league-xp'
            : null
    if (activeScript !== script) {
      scriptActionMessage.value = 'Ce script n’est pas actif.'
      return
    }
    const res = await fetchWithAuth(apiUrl('/api/admin/riot-script/stop'), { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      scriptActionMessage.value = data?.message ?? 'Arrêt demandé.'
      await loadRiotScriptsStatus()
    } else {
      scriptActionError.value = true
      scriptActionMessage.value = data?.error ?? 'Erreur arrêt'
    }
  } catch {
    scriptActionError.value = true
    scriptActionMessage.value = 'Erreur réseau'
  } finally {
    scriptStopBusy.value = { ...scriptStopBusy.value, [script]: false }
  }
}

async function stopRiotPoller() {
  riotPollerActionMessage.value = ''
  riotPollerActionError.value = false
  riotPollerStopBusy.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/riot-poller/stop'), { method: 'POST' })
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    riotPollerActionMessage.value = data?.message ?? 'Arrêt demandé.'
    await loadRiotScriptsStatus()
  } catch {
    riotPollerActionError.value = true
    riotPollerActionMessage.value = 'Erreur réseau'
  } finally {
    riotPollerStopBusy.value = false
  }
}

async function startRiotPoller() {
  riotPollerActionMessage.value = ''
  riotPollerActionError.value = false
  riotPollerStartBusy.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/riot-poller/start'), { method: 'POST' })
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    riotPollerActionMessage.value = data?.message ?? 'Poller démarré.'
    await loadRiotScriptsStatus()
  } catch {
    riotPollerActionError.value = true
    riotPollerActionMessage.value = 'Erreur réseau'
  } finally {
    riotPollerStartBusy.value = false
  }
}

async function _openRiotScriptLogs(scriptId: string, label: string) {
  riotScriptLogsOpen.value = true
  riotScriptLogsLoading.value = true
  riotScriptLogsTitle.value = label
  riotScriptLogs.value = []
  try {
    const res = await fetchWithAuth(
      apiUrl(`/api/admin/script-logs?script=${encodeURIComponent(scriptId)}&lines=50`)
    )
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    riotScriptLogs.value = Array.isArray(data?.log) ? data.log : []
    scriptLogsDir.value = data?.logDir ?? 'logs/scripts'
  } finally {
    riotScriptLogsLoading.value = false
  }
}

async function _openAllLogs(scriptFilter?: string) {
  allLogsOpen.value = true
  allLogsFilter.value = scriptFilter ?? 'all'
  allLogsSort.value = 'desc'
  allLogsLines.value = 200
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/script-logs/scripts'))
    if (res.ok) {
      const data = await res.json()
      allLogsScripts.value = Array.isArray(data?.scripts) ? data.scripts : []
    } else {
      allLogsScripts.value = []
    }
  } catch {
    allLogsScripts.value = []
  }
  await loadAllLogs()
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
      await loadRiotScriptsStatus()
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

async function loadAllLogs() {
  allLogsLoading.value = true
  try {
    const params = new URLSearchParams()
    params.set('script', allLogsFilter.value)
    params.set('sort', allLogsSort.value)
    params.set('lines', String(allLogsLines.value))
    const res = await fetchWithAuth(apiUrl(`/api/admin/script-logs?${params.toString()}`))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    allLogsList.value = Array.isArray(data?.log) ? data.log : []
    scriptLogsDir.value = data?.logDir ?? 'logs/scripts'
  } finally {
    allLogsLoading.value = false
  }
}

async function _runRiotScript(card: RiotScriptCard) {
  if (isScriptActive(card.id)) return
  riotScriptMessage.value = ''
  riotScriptError.value = false
  riotScriptBusy.value[card.id] = true
  try {
    let res: Response
    const f = riotScriptFields.value[card.id] ?? {}
    if (card.runMode === 'collect') {
      res = await fetchWithAuth(apiUrl('/api/admin/riot-collect-now'), { method: 'POST' })
    } else if (card.runMode === 'backfillUntilDone') {
      res = await fetchWithAuth(apiUrl('/api/admin/riot-backfill-until-done'), { method: 'POST' })
    } else if (card.runMode === 'discoverPlayers') {
      const region = (f.region ?? 'euw1').trim() || 'euw1'
      const riotId = (f.riotId ?? '').trim()
      const replayCount = Math.min(
        500,
        Math.max(1, parseInt(String(f.replayCount || '100'), 10) || 100)
      )
      res = await fetchWithAuth(apiUrl('/api/admin/riot-discover-players'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, riotId: riotId || undefined, replayCount }),
      })
    } else if (card.runMode === 'discoverLeagueExp') {
      res = await fetchWithAuth(apiUrl('/api/admin/riot-discover-league-exp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: f.platform || 'euw1',
          queue: f.queue || 'RANKED_SOLO_5x5',
          tier: f.tier || 'GOLD',
          division: f.division || 'I',
          pages: Number(f.pages || '3'),
        }),
      })
    } else {
      const args = card.fields
        .map(field => (f[field.key] ?? '').trim())
        .filter(Boolean)
        .slice(0, 10)
      res = await fetchWithAuth(apiUrl('/api/admin/riot-script-run'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: card.id, args }),
      })
    }

    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    if (res.ok || res.status === 202) {
      riotScriptMessage.value = data.message ?? t('admin.riotMatch.scripts.backgroundLaunched')
    } else {
      riotScriptError.value = true
      riotScriptMessage.value = data?.error ?? t('admin.riotMatch.triggerError')
    }
  } catch {
    riotScriptError.value = true
    riotScriptMessage.value = t('admin.riotMatch.triggerError')
  } finally {
    riotScriptBusy.value[card.id] = false
    await Promise.all([loadCron(), loadRiotScriptsStatus()])
  }
}

async function _stopRiotScript(card: RiotScriptCard) {
  riotScriptMessage.value = ''
  riotScriptError.value = false
  riotScriptStopBusy.value[card.id] = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/riot-script-stop'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script: card.id }),
    })
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    if (res.ok) {
      riotScriptMessage.value = data.message ?? t('admin.riotMatch.scripts.stopRequested')
    } else {
      riotScriptError.value = true
      riotScriptMessage.value = data?.error ?? t('admin.riotMatch.scripts.stopError')
    }
  } catch {
    riotScriptError.value = true
    riotScriptMessage.value = t('admin.riotMatch.scripts.stopError')
  } finally {
    riotScriptStopBusy.value[card.id] = false
    await Promise.all([loadCron(), loadRiotScriptsStatus()])
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Replay links UI not yet implemented
async function fetchReplayLinks() {
  replayMessage.value = ''
  replayError.value = false
  replayResult.value = null
  replayLoading.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/riot-replay-links'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summonerName: replaySummonerName.value,
        region: replayRegion.value,
        count: replayCount.value,
      }),
    })
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    if (res.ok) {
      replayResult.value = data
      replayMessage.value = t('admin.replays.success', { count: data?.countReturned ?? 0 })
    } else {
      replayError.value = true
      replayMessage.value = data?.error ?? t('admin.replays.error')
    }
  } catch {
    replayError.value = true
    replayMessage.value = t('admin.replays.error')
  } finally {
    replayLoading.value = false
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

async function triggerVideosSync() {
  videosTriggerMessage.value = ''
  videosTriggerError.value = false
  videosTriggering.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/youtube/trigger'), { method: 'POST' })
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    if (res.ok) {
      videosTriggerMessage.value = t('admin.videos.triggerSuccess')
      await loadCron()
    } else {
      videosTriggerError.value = true
      videosTriggerMessage.value = data?.error ?? t('admin.videos.triggerError')
    }
  } catch {
    videosTriggerError.value = true
    videosTriggerMessage.value = t('admin.videos.triggerError')
  } finally {
    videosTriggering.value = false
  }
}

async function addChannel() {
  const handle = newChannelHandle.value.trim()
  if (!handle) return
  videosAddMessage.value = ''
  videosAddError.value = false
  videosAdding.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/youtube/channels'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle }),
    })
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    if (res.ok) {
      videosAddMessage.value = t('admin.videos.addChannelSuccess')
      newChannelHandle.value = ''
      await loadCron()
    } else {
      videosAddError.value = true
      videosAddMessage.value = data?.error ?? t('admin.videos.addChannelError')
    }
  } catch {
    videosAddError.value = true
    videosAddMessage.value = t('admin.videos.addChannelError')
  } finally {
    videosAdding.value = false
  }
}

async function logout() {
  clearAuth()
  await navigateTo(localePath('/admin/login'))
}

onMounted(async () => {
  if (!checkLoggedIn()) {
    await navigateTo(localePath('/admin/login'))
    return
  }
  // Ensure URL reflects current tab (e.g. after direct load without query)
  if (!route.query.tab || !VALID_TABS.includes(route.query.tab as AdminTab)) {
    navigateTo(
      { path: route.path, query: { ...route.query, tab: activeTab.value } },
      { replace: true }
    )
  }
  initRiotScriptFields()
  await Promise.all([
    loadContact(),
    loadCron(),
    loadRiotScriptsStatus(),
    loadRiotApikey(),
    loadRiotApiStats(),
    loadDataStats(),
    loadActivePatches(),
    loadPatchCloseOptions(),
    loadBalanceRules(),
    loadSeedPlayers(),
  ])
  if (activeTab.value === 'logs') {
    unifiedLogOffset.value = 0
    loadUnifiedLogs().catch(() => {})
  }
  if (activeTab.value === 'data' && dataSectionPoller.value) {
    loadPollerMetrics().catch(() => {})
  }
})

// Sync URL when tab changes (refresh will restore the tab)
const DATA_TAB_POLL_INTERVAL_MS = 10 * 1000
let dataTabPollTimer: ReturnType<typeof setInterval> | null = null

watch(activeTab, (tab, prevTab) => {
  if (tab !== prevTab && route.query.tab !== tab) {
    navigateTo({ path: route.path, query: { ...route.query, tab } }, { replace: true })
  }
  if (dataTabPollTimer) {
    clearInterval(dataTabPollTimer)
    dataTabPollTimer = null
  }
  if (tab === 'contact' && !contactByCategory.value && !contactLoading.value) loadContact()
  if ((tab === 'videos' || tab === 'data') && !cron.value && !cronLoading.value) loadCron()
  if (tab === 'data') {
    loadRiotScriptsStatus()
    // Riot API key UI removed
    loadRiotApiStats()
    loadDataStats()
    loadActivePatches()
    loadPatchCloseOptions()
    loadBalanceRules()
    if (dataSectionPoller.value) loadPollerMetrics().catch(() => {})
    // Seed players UI removed
    dataTabPollTimer = setInterval(() => {
      loadRiotScriptsStatus()
      loadRiotApiStats()
    }, DATA_TAB_POLL_INTERVAL_MS)
  }
  if (tab === 'videos' && cron.value && !cronLoading.value) loadCron()
  if (tab === 'logs') {
    unifiedLogOffset.value = 0
    loadUnifiedLogs().catch(() => {})
  }
})

onUnmounted(() => {
  if (dataTabPollTimer) {
    clearInterval(dataTabPollTimer)
    dataTabPollTimer = null
  }
})

// Sync activeTab when URL changes (browser back/forward)
watch(
  () => route.query.tab,
  tab => {
    if (tab && VALID_TABS.includes(tab as AdminTab) && activeTab.value !== tab) {
      activeTab.value = tab as AdminTab
    }
  }
)
</script>
