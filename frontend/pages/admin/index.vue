<template>
  <div class="admin-dashboard min-h-screen p-4 text-text">
    <div class="mx-auto max-w-6xl">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-text-accent">Admin</h1>
          <p class="mt-1 hidden text-sm text-text/70 sm:block">
            {{ t('admin.tabs.contact') }} · {{ t('admin.tabs.videos') }} ·
            {{ t('admin.tabs.data') }}
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

      <!-- Tab: Data (API Riot + Crons + Scripts + Seed players) -->
      <div v-show="activeTab === 'data'" class="space-y-6">
        <!-- Section 1: API Riot (clé + consommation + stats) -->
        <div class="rounded-lg border border-primary/30 bg-surface/30">
          <button
            type="button"
            class="flex w-full items-center justify-between p-4 text-left"
            @click="dataSectionApiRiot = !dataSectionApiRiot"
          >
            <h2 class="text-lg font-semibold text-text">{{ t('admin.data.apiRiot.title') }}</h2>
            <span class="text-text/60">{{ dataSectionApiRiot ? '▼' : '▶' }}</span>
          </button>
          <div v-show="dataSectionApiRiot" class="border-t border-primary/20 px-4 pb-4 pt-2">
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
              <form class="mb-4 flex flex-wrap items-end gap-2" @submit.prevent="saveRiotApikey">
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
                    riotApikeyTesting
                      ? t('admin.riotApikey.testing')
                      : t('admin.riotApikey.testKey')
                  }}
                </button>
              </form>
              <p
                v-if="riotApikeyMessage"
                :class="riotApikeyError ? 'text-error' : 'text-green-600'"
                class="mb-4 text-sm"
              >
                {{ riotApikeyMessage }}
              </p>
              <div
                v-if="riotApiStats"
                class="mb-4 rounded border border-primary/20 bg-background/50 p-3"
              >
                <h3 class="mb-2 text-sm font-medium text-text">
                  {{ t('admin.data.apiRiot.consumption') }}
                </h3>
                <div class="grid gap-2 sm:grid-cols-4">
                  <div>
                    <span class="text-xs text-text/70">{{
                      t('admin.data.apiRiot.requestsPerHour')
                    }}</span>
                    <p class="font-semibold text-text">
                      {{ riotApiStats.requestsLastHour ?? '—' }} /
                      {{ riotApiStats.limitPerHour ?? 3000 }}
                    </p>
                  </div>
                  <div>
                    <span class="text-xs text-text/70">{{
                      t('admin.data.apiRiot.rateLimitExceeded')
                    }}</span>
                    <p class="font-semibold text-text">
                      {{ riotApiStats.rateLimitExceededCount ?? '—' }}
                    </p>
                  </div>
                  <div class="sm:col-span-2">
                    <span class="text-xs text-text/70"
                      >{{ t('admin.data.apiRiot.limit') }} ·
                      {{ t('admin.data.apiRiot.limitPerHour') }}</span
                    >
                  </div>
                </div>
              </div>
              <!-- Stats (participants sans rang, etc.) sous la clé -->
              <div class="rounded border border-primary/20 bg-background/50 p-3">
                <h3 class="mb-2 text-sm font-medium text-text">
                  {{ t('admin.data.stats.title') }}
                </h3>
                <p v-if="dataStatsLoading" class="text-text/70">Chargement…</p>
                <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div class="rounded border border-primary/20 bg-background/30 p-3">
                    <div class="text-xl font-bold text-text">
                      {{ dataStats?.participantsWithoutRank ?? '—' }}
                    </div>
                    <div class="text-xs text-text/70">
                      {{ t('admin.data.stats.participantsWithoutRank') }}
                    </div>
                  </div>
                  <div class="rounded border border-primary/20 bg-background/30 p-3">
                    <div class="text-xl font-bold text-text">
                      {{ dataStats?.participantsWithoutRole ?? '—' }}
                    </div>
                    <div class="text-xs text-text/70">
                      {{ t('admin.data.stats.participantsWithoutRole') }}
                    </div>
                  </div>
                  <div class="rounded border border-primary/20 bg-background/30 p-3">
                    <div class="text-xl font-bold text-text">
                      {{ dataStats?.matchesWithoutRank ?? '—' }}
                    </div>
                    <div class="text-xs text-text/70">
                      {{ t('admin.data.stats.matchesWithoutRank') }}
                    </div>
                  </div>
                  <div class="rounded border border-primary/20 bg-background/30 p-3">
                    <div class="text-base font-semibold text-text">
                      {{
                        dataStats?.lastNewPlayerAt ? formatRiotDate(dataStats.lastNewPlayerAt) : '—'
                      }}
                    </div>
                    <div class="text-xs text-text/70">
                      {{ t('admin.data.stats.lastNewPlayerAt') }}
                    </div>
                  </div>
                </div>
              </div>
            </template>
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
                class="rounded border border-primary/40 bg-surface/60 px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-primary/20"
                @click.stop="() => openAllLogs()"
              >
                {{ t('admin.data.crons.allLogs') }}
              </button>
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
                        <div class="flex flex-wrap gap-2">
                          <button
                            type="button"
                            class="rounded border border-primary/40 bg-surface/60 px-2 py-1 text-xs font-medium text-text transition-colors hover:bg-primary/20"
                            @click="() => openAllLogs(c.script)"
                          >
                            {{ t('admin.data.crons.logs') }}
                          </button>
                          <button
                            type="button"
                            class="rounded border border-primary/40 bg-surface/60 px-2 py-1 text-xs font-medium text-text transition-colors hover:bg-primary/20 disabled:opacity-50"
                            :disabled="cronTriggering[c.script]"
                            @click="triggerCron(c.script)"
                          >
                            {{ cronTriggering[c.script] ? '…' : t('admin.data.crons.runNow') }}
                          </button>
                        </div>
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

        <!-- Section 3: Seed players -->
        <div class="rounded-lg border border-primary/30 bg-surface/30">
          <button
            type="button"
            class="flex w-full items-center justify-between p-4 text-left"
            @click="dataSectionSeedPlayers = !dataSectionSeedPlayers"
          >
            <h2 class="text-lg font-semibold text-text">{{ t('admin.seedPlayers.title') }}</h2>
            <span class="text-text/60">{{ dataSectionSeedPlayers ? '▼' : '▶' }}</span>
          </button>
          <div v-show="dataSectionSeedPlayers" class="border-t border-primary/20 px-4 pb-4 pt-2">
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
                    <p v-if="allPlayersLoading" class="p-4 text-text/70">
                      {{ t('admin.loading') }}
                    </p>
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
                          <tr
                            v-for="p in allPlayersList"
                            :key="p.puuid"
                            class="hover:bg-surface/30"
                          >
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
                              {{ p.totalGames }} {{ t('admin.seedPlayers.games') }},
                              {{ p.winrate }}% WR
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
                      <span class="px-2"
                        >{{ t('admin.pagination.page') }} {{ allPlayersPage }} /
                        {{ allPlayersTotalPages }}</span
                      >
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

        <!-- Section 4: Scripts et Worker -->
        <div class="rounded-lg border border-primary/30 bg-surface/30">
          <button
            type="button"
            class="flex w-full items-center justify-between p-4 text-left"
            @click="dataSectionScripts = !dataSectionScripts"
          >
            <div class="flex items-center gap-3">
              <h2 class="text-lg font-semibold text-text">{{ t('admin.data.scripts.title') }}</h2>
              <button
                type="button"
                class="rounded border border-primary/40 bg-surface/60 px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-primary/20"
                @click.stop="() => openAllLogs()"
              >
                {{ t('admin.riotMatch.scripts.allLogs') }}
              </button>
            </div>
            <span class="text-text/60">{{ dataSectionScripts ? '▼' : '▶' }}</span>
          </button>
          <div v-show="dataSectionScripts" class="border-t border-primary/20 px-4 pb-4 pt-2">
            <p v-if="cronLoading" class="text-text/70">Chargement…</p>
            <template v-else>
              <div class="mb-4">
                <div class="mb-1 flex flex-wrap items-center gap-3">
                  <span class="text-sm font-medium text-text"
                    >{{ t('admin.riotMatch.pollerStatus') }} :</span
                  >
                  <span
                    :class="
                      cron?.riotWorker?.active
                        ? 'bg-green-600/20 text-green-700 dark:text-green-400'
                        : 'bg-text/10 text-text/70'
                    "
                    class="rounded px-2 py-0.5 text-sm font-medium"
                  >
                    {{
                      cron?.riotWorker?.active
                        ? t('admin.riotMatch.pollerActive')
                        : t('admin.riotMatch.pollerStopped')
                    }}
                  </span>
                  <span v-if="cron?.riotWorker?.lastBeat" class="text-sm text-text/60">
                    ({{ t('admin.riotMatch.pollerLastBeat') }} :
                    {{ formatRiotDate(cron.riotWorker.lastBeat) }})
                  </span>
                </div>
                <p class="text-xs text-text/60">{{ t('admin.riotMatch.pollerHint') }}</p>
                <p class="mt-1 text-xs text-text/50">{{ t('admin.riotMatch.workerStartHint') }}</p>
              </div>
              <div
                v-if="riotDataStats || riotApiStats"
                class="mb-4 flex flex-wrap gap-4 rounded border border-primary/20 bg-surface/20 px-3 py-2 text-sm"
              >
                <template v-if="riotDataStats">
                  <span v-if="riotDataStats.participantsWithoutRank != null" class="text-text/80">
                    Participants sans rang:
                    <strong>{{ riotDataStats.participantsWithoutRank }}</strong>
                  </span>
                  <span v-if="riotDataStats.participantsWithoutRole != null" class="text-text/80">
                    Participants sans rôle:
                    <strong>{{ riotDataStats.participantsWithoutRole }}</strong>
                  </span>
                  <span v-if="riotDataStats.matchesWithoutRank != null" class="text-text/80">
                    Matchs sans rang: <strong>{{ riotDataStats.matchesWithoutRank }}</strong>
                  </span>
                  <span
                    v-if="riotDataStats.playersMissingSummonerName != null"
                    class="text-text/80"
                  >
                    Joueurs sans summoner_name:
                    <strong>{{ riotDataStats.playersMissingSummonerName }}</strong>
                  </span>
                </template>
                <template v-if="riotApiStats">
                  <span class="text-text/80">
                    Requêtes Riot (1h): <strong>{{ riotApiStats.requestsLastHour ?? 0 }}</strong> /
                    {{ riotApiStats.limitPerTwoMin ?? 100 }} (2 min)
                  </span>
                  <span
                    v-if="(riotApiStats.rateLimitExceededCount ?? 0) > 0"
                    class="text-amber-600 dark:text-amber-400"
                  >
                    429: {{ riotApiStats.rateLimitExceededCount }}
                  </span>
                </template>
              </div>
              <div class="mt-4 space-y-3">
                <div
                  v-for="card in riotScriptCards"
                  :key="card.id"
                  class="rounded border border-primary/20 bg-background/40 p-3"
                >
                  <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p class="text-sm font-semibold text-text">{{ card.label }}</p>
                      <p class="text-xs text-text/60">{{ card.description }}</p>
                    </div>
                    <span
                      :class="riotStatusClass(riotScriptsStatus[card.id]?.status)"
                      class="rounded px-2 py-0.5 text-xs font-medium"
                    >
                      {{ riotStatusLabel(riotScriptsStatus[card.id]?.status) }}
                    </span>
                  </div>

                  <div
                    v-if="riotScriptsStatus[card.id]?.progress"
                    class="mb-3 rounded border border-primary/15 bg-surface/20 px-3 py-2 text-xs"
                  >
                    <p class="mb-1 font-medium text-text/80">
                      {{ riotScriptsStatus[card.id].progress.phase }}
                      <span
                        v-if="riotScriptsStatus[card.id].progress.lastUpdatedAt"
                        class="text-text/50"
                      >
                        · {{ formatRiotDate(riotScriptsStatus[card.id].progress.lastUpdatedAt) }}
                      </span>
                    </p>
                    <div
                      v-if="Object.keys(riotScriptsStatus[card.id].progress.metrics || {}).length"
                      class="flex flex-wrap gap-x-4 gap-y-1 text-text/70"
                    >
                      <span
                        v-if="riotScriptsStatus[card.id].progress.metrics.matchesCollected != null"
                      >
                        Matchs: {{ riotScriptsStatus[card.id].progress.metrics.matchesCollected }}
                      </span>
                      <span
                        v-if="riotScriptsStatus[card.id].progress.metrics.newPlayersAdded != null"
                      >
                        Nouveaux joueurs:
                        {{ riotScriptsStatus[card.id].progress.metrics.newPlayersAdded }}
                      </span>
                      <span v-if="riotScriptsStatus[card.id].progress.metrics.requestsUsed != null">
                        Requêtes: {{ riotScriptsStatus[card.id].progress.metrics.requestsUsed }}
                        <template
                          v-if="riotScriptsStatus[card.id].progress.metrics.requestLimit != null"
                        >
                          / {{ riotScriptsStatus[card.id].progress.metrics.requestLimit }}
                        </template>
                      </span>
                      <span v-if="riotScriptsStatus[card.id].progress.metrics.errors != null">
                        Erreurs: {{ riotScriptsStatus[card.id].progress.metrics.errors }}
                      </span>
                      <span v-if="riotScriptsStatus[card.id].progress.metrics.updated != null">
                        Mis à jour: {{ riotScriptsStatus[card.id].progress.metrics.updated }}
                      </span>
                      <span
                        v-if="
                          riotScriptsStatus[card.id].progress.metrics.participantsMissingData !=
                          null
                        "
                      >
                        Données manquantes:
                        {{ riotScriptsStatus[card.id].progress.metrics.participantsMissingData }}
                      </span>
                    </div>
                  </div>

                  <div
                    v-if="card.fields.length && riotScriptFields[card.id]"
                    class="mb-3 grid gap-2 md:grid-cols-3"
                  >
                    <div v-for="field in card.fields" :key="`${card.id}-${field.key}`">
                      <label class="mb-1 block text-xs font-medium text-text/70">{{
                        field.label
                      }}</label>
                      <select
                        v-if="field.type === 'select'"
                        v-model="riotScriptFields[card.id]![field.key]"
                        class="w-full rounded border border-primary/30 bg-background px-3 py-2 text-sm text-text"
                      >
                        <option
                          v-for="opt in field.options ?? []"
                          :key="`${card.id}-${field.key}-${opt.value}`"
                          :value="opt.value"
                        >
                          {{ opt.label }}
                        </option>
                      </select>
                      <input
                        v-else
                        v-model="riotScriptFields[card.id]![field.key]"
                        :type="field.type"
                        class="w-full rounded border border-primary/30 bg-background px-3 py-2 text-sm text-text"
                        :placeholder="field.placeholder"
                      />
                    </div>
                  </div>

                  <div class="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      class="rounded bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="riotScriptBusy[card.id] || isScriptActive(card.id)"
                      @click="runRiotScript(card)"
                    >
                      {{ riotScriptBusy[card.id] ? '…' : t('admin.riotMatch.scripts.run') }}
                    </button>
                    <button
                      type="button"
                      class="rounded border border-primary/40 bg-surface/60 px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface/80"
                      @click="openRiotScriptLogs(card.id, card.label)"
                    >
                      {{ t('admin.riotMatch.scripts.logs') }}
                    </button>
                    <button
                      v-if="isScriptActive(card.id)"
                      type="button"
                      class="rounded border border-red-500/70 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
                      :disabled="riotScriptStopBusy[card.id]"
                      @click="stopRiotScript(card)"
                    >
                      {{ riotScriptStopBusy[card.id] ? '…' : t('admin.riotMatch.scripts.stop') }}
                    </button>
                  </div>
                  <p
                    v-if="riotScriptsStatus[card.id]?.lastStartAt"
                    class="mt-2 text-xs text-text/60"
                  >
                    Start: {{ formatRiotDate(riotScriptsStatus[card.id]?.lastStartAt) }}
                    <span v-if="riotScriptsStatus[card.id]?.lastEndAt">
                      · Stop: {{ formatRiotDate(riotScriptsStatus[card.id]?.lastEndAt) }}
                    </span>
                  </p>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <p
                  v-if="
                    riotCollectMessage ||
                    riotStopMessage ||
                    riotBackfillMessage ||
                    riotLeagueExpMessage ||
                    riotScriptMessage
                  "
                  :class="
                    riotCollectError ||
                    riotStopError ||
                    riotBackfillError ||
                    riotLeagueExpError ||
                    riotScriptError
                      ? 'text-error'
                      : 'text-green-600'
                  "
                  class="mt-2 text-sm"
                >
                  {{
                    riotCollectMessage ||
                    riotStopMessage ||
                    riotBackfillMessage ||
                    riotLeagueExpMessage ||
                    riotScriptMessage
                  }}
                </p>
              </div>
            </template>
          </div>
        </div>

        <div
          v-if="riotScriptLogsOpen"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          @click.self="riotScriptLogsOpen = false"
        >
          <div
            class="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-lg border border-primary/30 bg-background shadow-xl"
          >
            <div class="flex items-center justify-between border-b border-primary/20 px-4 py-3">
              <h3 class="text-sm font-semibold text-text">
                {{ t('admin.riotMatch.scripts.logsTitle') }} - {{ riotScriptLogsTitle }}
              </h3>
              <button
                type="button"
                class="rounded border border-primary/30 px-2 py-1 text-xs text-text"
                @click="riotScriptLogsOpen = false"
              >
                {{ t('admin.riotMatch.scripts.close') }}
              </button>
            </div>
            <div class="max-h-[65vh] overflow-auto p-4">
              <p v-if="riotScriptLogsLoading" class="text-sm text-text/70">Chargement…</p>
              <p v-else-if="riotScriptLogs.length === 0" class="text-sm text-text/70">
                {{ t('admin.riotMatch.scripts.noLogs') }}
              </p>
              <pre v-else class="whitespace-pre-wrap text-xs text-text">{{
                riotScriptLogs.join('\n')
              }}</pre>
            </div>
          </div>
        </div>

        <!-- Global logs modal (all scripts, filter, sort, lines) -->
        <div
          v-if="allLogsOpen"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          @click.self="allLogsOpen = false"
        >
          <div
            class="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg border border-primary/30 bg-background shadow-xl"
          >
            <div
              class="flex flex-wrap items-center justify-between gap-2 border-b border-primary/20 px-4 py-3"
            >
              <h3 class="text-sm font-semibold text-text">
                {{ t('admin.riotMatch.scripts.allLogsTitle') }}
              </h3>
              <div class="flex flex-wrap items-center gap-2">
                <label class="text-xs text-text/70">{{
                  t('admin.riotMatch.scripts.filterScript')
                }}</label>
                <select
                  id="all-logs-script"
                  v-model="allLogsFilter"
                  class="rounded border border-primary/30 bg-background px-2 py-1 text-sm text-text"
                  @change="loadAllLogs"
                >
                  <option value="all">{{ t('admin.riotMatch.scripts.allScripts') }}</option>
                  <option v-for="s in allLogsScripts" :key="s" :value="s">{{ s }}</option>
                </select>
                <label class="text-xs text-text/70">{{ t('admin.riotMatch.scripts.sort') }}</label>
                <select
                  v-model="allLogsSort"
                  class="rounded border border-primary/30 bg-background px-2 py-1 text-sm text-text"
                  @change="loadAllLogs"
                >
                  <option value="desc">{{ t('admin.riotMatch.scripts.sortNewest') }}</option>
                  <option value="asc">{{ t('admin.riotMatch.scripts.sortOldest') }}</option>
                </select>
                <label class="text-xs text-text/70">{{ t('admin.riotMatch.scripts.lines') }}</label>
                <input
                  v-model.number="allLogsLines"
                  type="number"
                  min="1"
                  max="2000"
                  class="w-20 rounded border border-primary/30 bg-background px-2 py-1 text-sm text-text"
                  @change="loadAllLogs"
                />
                <button
                  type="button"
                  class="rounded border border-primary/40 bg-surface/60 px-3 py-1 text-sm text-text hover:bg-primary/10"
                  @click="loadAllLogs"
                >
                  {{ t('admin.riotMatch.scripts.refresh') }}
                </button>
              </div>
              <button
                type="button"
                class="rounded border border-primary/30 px-2 py-1 text-xs text-text"
                @click="allLogsOpen = false"
              >
                {{ t('admin.riotMatch.scripts.close') }}
              </button>
            </div>
            <div class="max-h-[75vh] overflow-auto p-4">
              <p v-if="allLogsLoading" class="text-sm text-text/70">Chargement…</p>
              <p v-else-if="allLogsList.length === 0" class="text-sm text-text/70">
                {{ t('admin.riotMatch.scripts.noLogs') }}
              </p>
              <pre v-else class="whitespace-pre-wrap font-mono text-xs text-text">{{
                allLogsList.join('\n')
              }}</pre>
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
                <option value="UTILITY">UTILITY</option>
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
            <div class="mb-4 rounded border border-primary/20 bg-background/50 p-3">
              <h3 class="mb-2 text-sm font-medium text-text">
                {{ t('admin.cronStatus.riotWorker') }}
              </h3>
              <p class="text-sm text-text/80">
                <span
                  :class="
                    cron?.riotWorker?.active ? 'text-green-600 dark:text-green-400' : 'text-text/70'
                  "
                >
                  {{
                    cron?.riotWorker?.active
                      ? t('admin.riotMatch.pollerActive')
                      : t('admin.riotMatch.pollerStopped')
                  }}
                </span>
                <span v-if="cron?.riotWorker?.lastBeat" class="text-text/60">
                  — {{ t('admin.riotMatch.pollerLastBeat') }}:
                  {{ formatRiotDate(cron.riotWorker.lastBeat) }}
                </span>
              </p>
            </div>
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
import { ref, computed, onMounted, watch } from 'vue'
import { apiUrl } from '~/utils/apiUrl'
import { useAdminAuth } from '~/composables/useAdminAuth'

definePageMeta({
  layout: false,
})

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { fetchWithAuth, clearAuth, checkLoggedIn } = useAdminAuth()

const VALID_TABS = ['contact', 'videos', 'data'] as const
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
    id: 'riot:worker',
    label: t('admin.riotMatch.scripts.worker'),
    description: t('admin.riotMatch.scripts.descriptions.worker'),
    runMode: 'generic',
    fields: [],
  },
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
const dataSectionApiRiot = ref(true)
const dataSectionCrons = ref(true)
const dataSectionScripts = ref(true)
const dataSectionSeedPlayers = ref(true)
const dataStats = ref<{
  participantsWithoutRank: number
  participantsWithoutRole: number
  matchesWithoutRank: number
  lastNewPlayerAt: string | null
} | null>(null)
const dataStatsLoading = ref(false)
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

// Videos / Cron
const cron = ref<any>(null)
const cronLoading = ref(false)
const riotCollectMessage = ref('')
const riotCollectError = ref(false)
const riotStopMessage = ref('')
const riotStopError = ref(false)
const riotBackfillMessage = ref('')
const riotBackfillError = ref(false)
const riotLeagueExpMessage = ref('')
const riotLeagueExpError = ref(false)
const riotScriptMessage = ref('')
const riotScriptError = ref(false)
const riotScriptFields = ref<Record<string, Record<string, string>>>({})
const riotScriptBusy = ref<Record<string, boolean>>({})
const riotScriptStopBusy = ref<Record<string, boolean>>({})
const riotScriptsStatus = ref<Record<string, any>>({})
const riotDataStats = ref<{
  participantsWithoutRank?: number
  participantsWithoutRole?: number
  matchesWithoutRank?: number
  lastNewPlayerAt?: string | null
  playersMissingSummonerName?: number
} | null>(null)
const riotScriptLogsOpen = ref(false)
const riotScriptLogsLoading = ref(false)
const riotScriptLogsTitle = ref('')
const riotScriptLogs = ref<string[]>([])

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
const matchupLane = ref<'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY' | ''>('')
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

function riotStatusLabel(status: string | undefined) {
  if (status === 'running') return t('admin.riotMatch.scripts.status.running')
  if (status === 'started') return t('admin.riotMatch.scripts.status.started')
  if (status === 'failed') return t('admin.riotMatch.scripts.status.failed')
  return t('admin.riotMatch.scripts.status.stopped')
}

function riotStatusClass(status: string | undefined) {
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
  } catch {
    // Keep page functional even if status endpoint fails.
  }
}

async function openRiotScriptLogs(scriptId: string, label: string) {
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
  } finally {
    riotScriptLogsLoading.value = false
  }
}

async function openAllLogs(scriptFilter?: string) {
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
  } finally {
    allLogsLoading.value = false
  }
}

async function runRiotScript(card: RiotScriptCard) {
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

async function stopRiotScript(card: RiotScriptCard) {
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
    loadSeedPlayers(),
  ])
})

// Sync URL when tab changes (refresh will restore the tab)
watch(activeTab, (tab, prevTab) => {
  if (tab !== prevTab && route.query.tab !== tab) {
    navigateTo({ path: route.path, query: { ...route.query, tab } }, { replace: true })
  }
  if (tab === 'contact' && !contactByCategory.value && !contactLoading.value) loadContact()
  if ((tab === 'videos' || tab === 'data') && !cron.value && !cronLoading.value) loadCron()
  if (tab === 'data') {
    loadRiotScriptsStatus()
    if (riotApikeyMasked.value === null && !riotApikeyLoading.value) loadRiotApikey()
    loadRiotApiStats()
    loadDataStats()
    if (seedPlayersList.value.length === 0 && !seedPlayersLoading.value) loadSeedPlayers()
  }
  if (tab === 'videos' && cron.value && !cronLoading.value) loadCron()
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
