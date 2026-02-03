<template>
  <div class="admin-dashboard min-h-screen p-4 text-text">
    <div class="mx-auto max-w-6xl">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-text-accent">Admin</h1>
          <p class="mt-1 text-sm text-text/70">
            {{ t('admin.tabs.contact') }} · {{ t('admin.tabs.builds') }} ·
            {{ t('admin.tabs.videos') }} · {{ t('admin.tabs.apikeyRiot') }} ·
            {{ t('admin.tabs.seedPlayers') }}
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

      <!-- Tabs -->
      <div class="mb-4 flex gap-2 border-b border-primary/30 pb-2">
        <button
          v-for="tab in adminTabs"
          :key="tab.id"
          type="button"
          :class="[
            'rounded px-4 py-2 text-sm font-medium transition-colors',
            activeTab === tab.id
              ? 'bg-accent text-background'
              : 'bg-surface/50 text-text/80 hover:bg-primary/20 hover:text-text',
          ]"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
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

      <!-- Tab: Builds -->
      <div v-show="activeTab === 'builds'" class="space-y-6">
        <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
          <h2 class="mb-4 text-lg font-semibold text-text">{{ t('admin.builds.title') }}</h2>
          <p v-if="buildsLoading" class="text-text/70">Chargement…</p>
          <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div class="rounded border border-primary/20 bg-background/50 p-4 text-center">
              <div class="text-2xl font-bold text-text">{{ buildsStats?.total ?? '—' }}</div>
              <div class="text-sm text-text/70">{{ t('admin.builds.total') }}</div>
            </div>
            <div class="rounded border border-primary/20 bg-background/50 p-4 text-center">
              <div class="text-2xl font-bold text-text">{{ buildsStats?.public ?? '—' }}</div>
              <div class="text-sm text-text/70">{{ t('admin.builds.public') }}</div>
            </div>
            <div class="rounded border border-primary/20 bg-background/50 p-4 text-center">
              <div class="text-2xl font-bold text-text">{{ buildsStats?.private ?? '—' }}</div>
              <div class="text-sm text-text/70">{{ t('admin.builds.private') }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: Riot API key -->
      <div v-show="activeTab === 'apikey'" class="space-y-6">
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

      <!-- Tab: Seed players -->
      <div v-show="activeTab === 'seedplayers'" class="space-y-6">
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
            <p v-if="seedPlayersList.length === 0" class="text-text/70">
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
            </ul>
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
const { fetchWithAuth, clearAuth, checkLoggedIn } = useAdminAuth()

const authError = ref<string | null>(null)
const activeTab = ref<'contact' | 'builds' | 'videos' | 'apikey' | 'seedplayers'>('contact')

const adminTabs = computed(() => [
  { id: 'contact' as const, label: t('admin.tabs.contact') },
  { id: 'builds' as const, label: t('admin.tabs.builds') },
  { id: 'videos' as const, label: t('admin.tabs.videos') },
  { id: 'apikey' as const, label: t('admin.tabs.apikeyRiot') },
  { id: 'seedplayers' as const, label: t('admin.tabs.seedPlayers') },
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

// Builds
const buildsStats = ref<{ total: number; public: number; private: number } | null>(null)
const buildsLoading = ref(false)

async function loadBuildsStats() {
  buildsLoading.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/builds/stats'))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    buildsStats.value = await res.json()
  } catch {
    authError.value = t('admin.login.error')
  } finally {
    buildsLoading.value = false
  }
}

// Videos / Cron
const cron = ref<any>(null)
const cronLoading = ref(false)
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

async function loadSeedPlayers() {
  seedPlayersLoading.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/seed-players'))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    seedPlayersList.value = data?.players ?? []
  } catch {
    authError.value = t('admin.login.error')
  } finally {
    seedPlayersLoading.value = false
  }
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
      seedPlayersMessage.value = (data?.error as string) ?? t('admin.seedPlayers.addError')
    }
  } catch {
    seedPlayersError.value = true
    seedPlayersMessage.value = t('admin.seedPlayers.addError')
  } finally {
    seedPlayersAdding.value = false
  }
}

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
  await Promise.all([
    loadContact(),
    loadBuildsStats(),
    loadCron(),
    loadRiotApikey(),
    loadSeedPlayers(),
  ])
})

watch(activeTab, tab => {
  if (tab === 'contact' && !contactByCategory.value && !contactLoading.value) loadContact()
  if (tab === 'builds' && buildsStats.value === null && !buildsLoading.value) loadBuildsStats()
  if (tab === 'videos' && !cron.value && !cronLoading.value) loadCron()
  if (tab === 'apikey' && riotApikeyMasked.value === null && !riotApikeyLoading.value)
    loadRiotApikey()
  if (tab === 'seedplayers' && seedPlayersList.value.length === 0 && !seedPlayersLoading.value)
    loadSeedPlayers()
})
</script>
