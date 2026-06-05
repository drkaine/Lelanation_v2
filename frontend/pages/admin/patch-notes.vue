<template>
  <div class="admin-patch-notes min-h-screen bg-background p-4 text-text">
    <div class="mx-auto max-w-7xl">
      <header class="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-text-accent">{{ t('admin.patchNotes.title') }}</h1>
          <p class="mt-1 text-sm text-text/70">{{ t('admin.patchNotes.subtitle') }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <NuxtLink
            :to="localePath('/admin')"
            class="rounded-lg border border-primary bg-surface px-4 py-2 text-sm text-text transition-colors hover:bg-primary hover:text-white"
          >
            {{ t('admin.patchNotes.backToAdmin') }}
          </NuxtLink>
          <button
            type="button"
            class="rounded-lg border border-primary bg-surface px-3 py-2 text-sm transition-colors"
            :class="
              patchStore.lang === 'fr'
                ? 'bg-accent text-background'
                : 'text-text hover:bg-primary/20'
            "
            @click="patchStore.setLang('fr')"
          >
            FR
          </button>
          <button
            type="button"
            class="rounded-lg border border-primary bg-surface px-3 py-2 text-sm transition-colors"
            :class="
              patchStore.lang === 'en'
                ? 'bg-accent text-background'
                : 'text-text hover:bg-primary/20'
            "
            @click="patchStore.setLang('en')"
          >
            EN
          </button>
          <button
            type="button"
            class="rounded-lg border border-primary bg-surface px-3 py-2 text-sm text-text hover:bg-primary hover:text-white"
            :disabled="patchStore.loading"
            @click="reload"
          >
            {{ t('admin.patchNotes.reload') }}
          </button>
        </div>
      </header>

      <div
        v-if="patchStore.error"
        class="mb-4 rounded-lg border border-error bg-surface p-3 text-sm text-error"
      >
        {{ patchStore.error }}
      </div>

      <section
        v-if="patchStore.loading && !patchStore.cachedPatches.length"
        class="py-16 text-center text-text/70"
      >
        {{ t('admin.loading') }}
      </section>

      <template v-else>
        <section class="mb-8">
          <h2 class="mb-4 text-lg font-semibold text-text">
            {{ t('admin.patchNotes.patchList') }}
          </h2>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <PatchVersionCard
              v-for="patch in sortedPatches"
              :key="patch.version"
              :version="patch.version"
              :date="patch.date"
              :summary="patchStore.lang === 'fr' ? patch.summary.fr : patch.summary.en"
              :is-latest="patch.version === patchStore.latestPatch"
              :selected="patch.version === patchStore.selectedVersion"
              :latest-label="t('admin.patchNotes.latest')"
              :counts="{
                champions: patch.champions.length,
                items: patch.items.length,
                runes: patch.runes.length,
                skins: patch.skins.length,
              }"
              @select="onSelectPatch"
            />
          </div>
        </section>

        <template v-if="patchStore.currentPatch">
          <section class="mb-6">
            <article class="rounded-xl border border-primary/30 bg-surface/40 p-5 shadow-sm">
              <div class="mb-2 flex flex-wrap items-center gap-3">
                <h2 class="text-2xl font-bold text-text-accent">
                  Patch {{ patchStore.currentPatch.version }}
                </h2>
                <span class="text-sm text-text/60">{{ patchStore.currentPatch.date }}</span>
              </div>
              <p class="text-sm leading-relaxed text-text/85">
                {{
                  patchStore.lang === 'fr'
                    ? patchStore.currentPatch.summary.fr
                    : patchStore.currentPatch.summary.en
                }}
              </p>
            </article>
          </section>

          <section v-if="patchStore.currentPatch.highlights.length" class="mb-8">
            <h2 class="mb-4 text-lg font-semibold text-text">
              {{ t('admin.patchNotes.highlights') }}
            </h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <PatchHighlightCard
                v-for="(hl, idx) in patchStore.currentPatch.highlights"
                :key="idx"
                :highlight="hl"
                :lang="patchStore.lang"
              />
            </div>
          </section>

          <div class="mb-5 flex flex-wrap gap-2">
            <button
              v-for="tab in entityTabs"
              :key="tab.id"
              type="button"
              class="rounded-full px-4 py-2 text-sm font-medium transition-colors"
              :class="
                patchStore.activeTab === tab.id
                  ? 'bg-accent text-background shadow-md'
                  : 'border border-primary/30 bg-surface/50 text-text/80 hover:border-accent/50 hover:bg-primary/15'
              "
              @click="patchStore.setActiveTab(tab.id)"
            >
              {{ tab.label }}
              <span class="ml-1 tabular-nums opacity-80"
                >({{ patchStore.entityCount[tab.id] }})</span
              >
            </button>
          </div>

          <section class="mb-10">
            <template v-if="patchStore.activeTab === 'systems'">
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <PatchSystemCard
                  v-for="(section, idx) in patchStore.currentPatch.systems"
                  :key="idx"
                  :section="section"
                  :lang="patchStore.lang"
                />
              </div>
              <p v-if="!patchStore.currentPatch.systems.length" class="text-sm text-text/60">
                {{ t('admin.patchNotes.emptySection') }}
              </p>
            </template>

            <template v-else-if="patchStore.activeTab === 'skins'">
              <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                <PatchSkinCard
                  v-for="(skin, idx) in patchStore.currentPatch.skins"
                  :key="idx"
                  :skin="skin"
                  :lang="patchStore.lang"
                />
              </div>
              <p v-if="!patchStore.currentPatch.skins.length" class="text-sm text-text/60">
                {{ t('admin.patchNotes.emptySection') }}
              </p>
            </template>

            <template v-else>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                <PatchEntityCard
                  v-for="entity in entityList"
                  :key="entity.slug"
                  :entity="entity"
                  :lang="patchStore.lang"
                />
              </div>
              <p v-if="!entityList.length" class="text-sm text-text/60">
                {{ t('admin.patchNotes.emptySection') }}
              </p>
            </template>
          </section>

          <section class="rounded-xl border border-primary/30 bg-surface/30 p-5">
            <h2 class="mb-2 text-lg font-semibold text-text">
              {{ t('admin.patchNotes.buildChecker') }}
            </h2>
            <p class="mb-4 text-sm text-text/70">{{ t('admin.patchNotes.buildCheckerHint') }}</p>
            <button
              type="button"
              class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
              :disabled="patchStore.buildCheckLoading"
              @click="runDemoCheck"
            >
              {{ t('admin.patchNotes.runDemoCheck') }}
            </button>

            <div v-if="patchStore.buildCheckResult" class="mt-4 space-y-3">
              <div
                class="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
                :class="scoreBadgeClass"
              >
                <span>{{ patchStore.buildCheckResult.score }}/100</span>
                <span>·</span>
                <span>{{ scoreStatusLabel }}</span>
              </div>
              <div
                v-if="patchStore.buildCheckResult.affected.length"
                class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                <article
                  v-for="(entry, idx) in patchStore.buildCheckResult.affected"
                  :key="`${entry.slug}-${entry.patch_version}-${idx}`"
                  class="rounded-xl border border-primary/20 bg-background/40 p-3 text-sm"
                >
                  <p class="font-medium text-text">
                    {{ patchStore.lang === 'fr' ? entry.name_fr : entry.name_en }}
                  </p>
                  <p class="mt-1 text-xs text-text/60">
                    patch {{ entry.patch_version }} · {{ entry.entity_type }} ·
                    {{ entry.global_type }}
                  </p>
                </article>
              </div>
              <p v-else class="text-sm text-text/60">{{ t('admin.patchNotes.noAffected') }}</p>
            </div>
          </section>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePatchNotesStore } from '~/stores/PatchNotesStore'
import type { PatchEntity, PatchNotesData } from '~/stores/PatchNotesStore'

definePageMeta({
  layout: false,
})

const { t } = useI18n()
const localePath = useLocalePath()
const patchStore = usePatchNotesStore()

const sortedPatches = computed((): PatchNotesData[] => {
  const list = patchStore.cachedPatches.length
    ? [...patchStore.cachedPatches]
    : patchStore.currentPatch
      ? [patchStore.currentPatch]
      : []
  return list.sort((a, b) => {
    const [aMaj, aMin] = a.version.split('.').map(Number)
    const [bMaj, bMin] = b.version.split('.').map(Number)
    if (aMaj !== bMaj) return bMaj - aMaj
    return bMin - aMin
  })
})

const entityTabs = computed(() => [
  { id: 'champions' as const, label: t('admin.patchNotes.tabs.champions') },
  { id: 'items' as const, label: t('admin.patchNotes.tabs.items') },
  { id: 'runes' as const, label: t('admin.patchNotes.tabs.runes') },
  { id: 'systems' as const, label: t('admin.patchNotes.tabs.systems') },
  { id: 'skins' as const, label: t('admin.patchNotes.tabs.skins') },
])

const entityList = computed((): PatchEntity[] => {
  const patch = patchStore.currentPatch
  if (!patch) return []
  const tab = patchStore.activeTab
  if (tab === 'champions') return patch.champions
  if (tab === 'items') return patch.items
  if (tab === 'runes') return patch.runes
  return []
})

const scoreBadgeClass = computed(() => {
  const score = patchStore.buildCheckResult?.score ?? 0
  if (score >= 80) return 'bg-[#3B6D11] text-white'
  if (score >= 60) return 'bg-[#854F0B] text-white'
  return 'bg-[#A32D2D] text-white'
})

const scoreStatusLabel = computed(() => {
  const status = patchStore.buildCheckResult?.status
  if (status === 'current') return t('admin.patchNotes.status.current')
  if (status === 'affected') return t('admin.patchNotes.status.affected')
  return t('admin.patchNotes.status.outdated')
})

function onSelectPatch(version: string) {
  patchStore.selectPatch(version)
}

async function reload() {
  await patchStore.loadIndex()
  await patchStore.loadAllPatches()
  if (patchStore.selectedVersion) {
    patchStore.selectPatch(patchStore.selectedVersion)
  } else if (patchStore.latestPatch) {
    patchStore.selectPatch(patchStore.latestPatch)
  }
}

function runDemoCheck() {
  patchStore.checkBuild({
    patch_created: '26.10',
    champion_ddragon_id: 'Darius',
    items: [{ ddragon_id: '3078' }, { ddragon_id: '3031' }],
    runes: [{ ddragon_id: '8008' }],
  })
}

onMounted(() => {
  reload()
})
</script>
