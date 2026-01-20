<template>
  <div class="admin-creators min-h-screen p-4 text-text">
    <div class="mx-auto max-w-5xl">
      <div class="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-text-accent">Admin · Créateurs YouTube</h1>
          <p class="text-text/70 mt-1 text-sm">
            Gérer la liste des chaînes synchronisées (Epic 6). La protection “admin auth” viendra
            avec Epic 8.
          </p>
        </div>
        <button
          class="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-dark"
          @click="triggerSync"
        >
          Lancer une sync
        </button>
      </div>

      <div
        v-if="youtube.error"
        class="mb-4 rounded-lg border border-error bg-surface p-3 text-sm text-error"
      >
        {{ youtube.error }}
      </div>

      <div
        v-if="youtube.lastSyncTriggerResult"
        class="mb-4 rounded-lg border border-primary bg-surface p-3 text-sm text-text"
      >
        Sync OK: {{ youtube.lastSyncTriggerResult.syncedChannels }} chaîne(s),
        {{ youtube.lastSyncTriggerResult.totalVideos }} vidéo(s) au total.
      </div>

      <div class="mb-6 rounded-lg border-2 border-primary bg-surface p-4">
        <h2 class="mb-3 text-lg font-bold text-text">Ajouter un créateur</h2>
        <div class="flex flex-col gap-3 md:flex-row">
          <input
            v-model="newCreator"
            type="text"
            class="w-full rounded border border-primary bg-surface px-4 py-2 text-text"
            placeholder="UC… (channelId) ou username (ex: Lelariva_LoL)"
          />
          <button
            class="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            @click="add"
          >
            Ajouter
          </button>
        </div>
        <p class="text-text/60 mt-2 text-xs">
          Astuce: si tu mets un username, le backend résout via l’API YouTube Search.
        </p>
      </div>

      <div class="rounded-lg border-2 border-primary bg-surface p-4">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-lg font-bold text-text">Créateurs configurés</h2>
          <button
            class="rounded border border-primary bg-surface px-3 py-1 text-sm text-text hover:bg-primary hover:text-white"
            @click="reload"
          >
            Recharger
          </button>
        </div>

        <div v-if="youtube.loadingStatus" class="text-text/70 py-6 text-center">Chargement…</div>

        <div v-else-if="youtube.creators.length === 0" class="text-text/70 py-6 text-center">
          Aucun créateur configuré.
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="c in youtube.creators"
            :key="c.channelId"
            class="flex flex-col justify-between gap-3 rounded border border-primary bg-surface p-3 md:flex-row md:items-center"
          >
            <div>
              <p class="font-semibold text-text">{{ c.channelName || c.channelId }}</p>
              <p class="text-text/60 mt-1 text-xs">
                id: {{ c.channelId }} · vidéos: {{ c.videoCount }} · sync:
                {{ c.lastSync ? formatDateTime(c.lastSync) : '—' }}
              </p>
              <p v-if="c.error" class="mt-1 text-xs text-error">Erreur: {{ c.error }}</p>
            </div>

            <div class="flex items-center gap-2">
              <NuxtLink
                :to="`/videos/${c.channelId}`"
                class="rounded-lg border border-primary bg-surface px-3 py-2 text-sm text-text transition-colors hover:bg-primary hover:text-white"
              >
                Voir
              </NuxtLink>
              <button
                class="rounded-lg bg-error px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-error/80"
                @click="remove(c.channelId)"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useYouTubeStore } from '~/stores/YouTubeStore'

const youtube = useYouTubeStore()
const newCreator = ref('')

const reload = async () => {
  await youtube.loadConfig()
  await youtube.loadStatus()
}

const add = async () => {
  if (!newCreator.value.trim()) return
  await youtube.addCreator(newCreator.value)
  newCreator.value = ''
}

const remove = async (channelId: string) => {
  await youtube.removeCreator(channelId)
}

const triggerSync = async () => {
  await youtube.triggerSync()
}

const formatDateTime = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(async () => {
  await reload()
})
</script>
