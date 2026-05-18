<template>
  <div class="min-h-screen p-4 text-text">
    <div class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl font-bold">LoL Theorycraft Lab</h1>
        <NuxtLink
          :to="localePath('/builds')"
          class="rounded-lg bg-surface px-4 py-2 text-text transition-colors hover:bg-primary hover:text-white"
        >
          ← Retour Builds
        </NuxtLink>
      </div>

      <section class="rounded-xl bg-surface p-4">
        <div class="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label class="text-muted text-sm">
            Champion
            <select
              v-model="selectedChampionId"
              class="border-border mt-1 w-full rounded border bg-background px-3 py-2 text-text"
            >
              <option value="">Choisir un champion</option>
              <option v-for="champion in championIndex" :key="champion.id" :value="champion.id">
                {{ champion.name }}
              </option>
            </select>
          </label>
          <button
            type="button"
            class="border-border rounded border px-3 py-2 text-sm text-text transition-colors hover:bg-background"
            @click="reloadChampion"
          >
            Recharger
          </button>
        </div>
        <p v-if="error" class="mt-2 text-sm text-red-400">{{ error }}</p>
      </section>

      <TheorycraftSpellPanel v-if="selectedChampionData" :champion="selectedChampionData" />
      <div
        v-else
        class="border-border/70 text-muted rounded-xl border border-dashed p-6 text-center text-sm"
      >
        Sélectionne un champion pour afficher les descriptions de sorts parsées.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import TheorycraftSpellPanel from '~/components/Build/TheorycraftSpellPanel.vue'
import { useChampionData } from '~/composables/useChampionData'

definePageMeta({
  layout: false,
})

const localePath = useLocalePath()
const route = useRoute()
const { loadIndex, loadChampion, error } = useChampionData()

const championIndex = ref<Array<{ id: string; name: string }>>([])
const selectedChampionId = ref<string>(
  typeof route.query.champion === 'string' ? route.query.champion : ''
)
const championData = ref<Record<string, unknown> | null>(null)

const selectedChampionData = computed(() => championData.value)

async function ensureIndex() {
  championIndex.value = await loadIndex()
}

async function ensureChampionLoaded() {
  if (!selectedChampionId.value) {
    championData.value = null
    return
  }
  championData.value = await loadChampion(selectedChampionId.value)
}

async function reloadChampion() {
  await ensureChampionLoaded()
}

await ensureIndex()
await ensureChampionLoaded()

watch(
  selectedChampionId,
  async value => {
    await navigateTo({ query: { ...route.query, champion: value || undefined } }, { replace: true })
    await ensureChampionLoaded()
  },
  { immediate: false }
)
</script>
