<template>
  <div class="patch-notes-page min-h-screen px-[15px] py-6 text-text">
    <div class="mx-auto max-w-6xl">
      <div v-if="loading && !patch" class="py-16 text-center text-text/70">
        {{ t('patchNotesPage.loading') }}
      </div>

      <div
        v-else-if="error"
        class="rounded-lg border border-error bg-surface p-4 text-sm text-error"
      >
        {{ error }}
      </div>

      <template v-else-if="patch">
        <header class="mb-8 text-center">
          <p class="text-sm font-medium uppercase tracking-widest text-accent">
            {{ t('patchNotesPage.eyebrow') }}
          </p>
          <h1 class="mt-2 text-4xl font-bold text-text-accent md:text-5xl">
            {{ t('patchNotesPage.title', { version: patch.version }) }}
          </h1>
          <p class="mt-2 text-sm text-text/60">{{ formattedDate }}</p>
          <p class="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-text/85">
            {{ patchStore.lang === 'fr' ? patch.summary.fr : patch.summary.en }}
          </p>

          <div class="mt-5 flex flex-wrap items-center justify-center gap-3">
            <label class="sr-only" for="patch-version-select">{{
              t('patchNotesPage.selectPatch')
            }}</label>
            <select
              id="patch-version-select"
              v-model="selectedVersion"
              class="rounded-lg border border-primary/40 bg-surface px-3 py-2 text-sm text-text"
            >
              <option v-for="v in patchVersions" :key="v" :value="v">
                Patch {{ v }}{{ v === latestVersion ? ` (${t('patchNotesPage.latest')})` : '' }}
              </option>
            </select>
            <a
              :href="officialPatchUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="rounded-lg border border-primary/40 bg-surface px-4 py-2 text-sm text-text transition-colors hover:bg-primary hover:text-white"
            >
              {{ t('patchNotesPage.officialLink') }}
            </a>
          </div>
        </header>

        <section v-if="patch.highlights.length" class="mb-10">
          <h2 class="mb-4 text-xl font-bold text-text">{{ t('patchNotesPage.highlights') }}</h2>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PatchHighlightCard
              v-for="(hl, idx) in patch.highlights"
              :key="idx"
              :highlight="hl"
              :lang="patchStore.lang"
            />
          </div>
        </section>

        <section v-if="patch.champions.length" class="mb-10">
          <div class="mb-4 flex items-end justify-between gap-3">
            <h2 class="text-xl font-bold text-text">
              {{ t('patchNotesPage.sections.champions') }}
            </h2>
            <span class="text-sm text-text/50">{{ patch.champions.length }}</span>
          </div>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <PatchChangeSummaryCard
              v-for="entity in patch.champions"
              :key="entity.slug"
              :entity="entity"
              :lang="patchStore.lang"
              :more-changes-label="t('patchNotesPage.moreChanges')"
            />
          </div>
        </section>

        <section v-if="patch.items.length" class="mb-10">
          <div class="mb-4 flex items-end justify-between gap-3">
            <h2 class="text-xl font-bold text-text">{{ t('patchNotesPage.sections.items') }}</h2>
            <span class="text-sm text-text/50">{{ patch.items.length }}</span>
          </div>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <PatchChangeSummaryCard
              v-for="entity in patch.items"
              :key="entity.slug"
              :entity="entity"
              :lang="patchStore.lang"
              :more-changes-label="t('patchNotesPage.moreChanges')"
            />
          </div>
        </section>

        <section v-if="patch.runes.length" class="mb-10">
          <div class="mb-4 flex items-end justify-between gap-3">
            <h2 class="text-xl font-bold text-text">{{ t('patchNotesPage.sections.runes') }}</h2>
            <span class="text-sm text-text/50">{{ patch.runes.length }}</span>
          </div>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <PatchChangeSummaryCard
              v-for="entity in patch.runes"
              :key="entity.slug"
              :entity="entity"
              :lang="patchStore.lang"
              :more-changes-label="t('patchNotesPage.moreChanges')"
            />
          </div>
        </section>

        <section v-if="patch.systems.length" class="mb-10">
          <h2 class="mb-4 text-xl font-bold text-text">
            {{ t('patchNotesPage.sections.systems') }}
          </h2>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <PatchSystemCard
              v-for="(section, idx) in patch.systems"
              :key="idx"
              :section="section"
              :lang="patchStore.lang"
            />
          </div>
        </section>

        <section v-if="patch.skins.length" class="mb-6">
          <h2 class="mb-4 text-xl font-bold text-text">{{ t('patchNotesPage.sections.skins') }}</h2>
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <PatchSkinCard
              v-for="(skin, idx) in patch.skins"
              :key="idx"
              :skin="skin"
              :lang="patchStore.lang"
            />
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePatchNotesStore } from '~/stores/PatchNotesStore'

const { t, locale } = useI18n()
const patchStore = usePatchNotesStore()

const loading = ref(true)
const error = ref<string | null>(null)

const patch = computed(() => patchStore.currentPatch)
const patchVersions = computed(() => patchStore.patches)
const latestVersion = computed(() => patchStore.latestPatch)

const selectedVersion = computed({
  get: () => patchStore.selectedVersion,
  set: (v: string) => {
    if (v) patchStore.selectPatch(v)
  },
})

const formattedDate = computed(() => {
  if (!patch.value?.date) return ''
  const d = new Date(`${patch.value.date}T12:00:00`)
  if (Number.isNaN(d.getTime())) return patch.value.date
  return d.toLocaleDateString(locale.value === 'fr' ? 'fr-FR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

const officialPatchUrl = computed(() => {
  const riotLocale = locale.value === 'fr' ? 'fr-fr' : 'en-us'
  const v = patch.value?.version ?? ''
  const slug = v.replace(/\./g, '-')
  return `https://www.leagueoflegends.com/${riotLocale}/news/game-updates/league-of-legends-patch-${slug}-notes/`
})

useHead({
  title: () =>
    patch.value
      ? t('patchNotesPage.metaTitle', { version: patch.value.version })
      : t('patchNotesPage.metaTitleFallback'),
  meta: [
    {
      name: 'description',
      content: () =>
        patch.value
          ? patchStore.lang === 'fr'
            ? patch.value.summary.fr
            : patch.value.summary.en
          : t('patchNotesPage.metaDescription'),
    },
  ],
})

onMounted(async () => {
  loading.value = true
  error.value = null
  patchStore.setLang(locale.value === 'en' ? 'en' : 'fr')

  try {
    await patchStore.loadIndex()
    if (!patchStore.selectedVersion && patchStore.latestPatch) {
      patchStore.selectPatch(patchStore.latestPatch)
    }
    if (!patchStore.currentPatch) {
      error.value = t('patchNotesPage.notFound')
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('patchNotesPage.loadError')
  } finally {
    loading.value = false
  }
})

watch(locale, lang => {
  patchStore.setLang(lang === 'en' ? 'en' : 'fr')
})
</script>
