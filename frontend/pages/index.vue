<template>
  <div class="hg-page text-text">
    <!-- Hero : splash du meilleur pick -->
    <section class="hg-hero">
      <div
        class="hg-hero-bg"
        :style="heroSplash ? { backgroundImage: `url(${heroSplash})` } : undefined"
        aria-hidden="true"
      />
      <div class="hg-hero-inner">
        <p v-if="stats.patch" class="hg-eyebrow">
          {{ t('homeTest.eyebrow', { patch: stats.patch }) }}
        </p>
        <h1 class="hg-title">{{ t('homeTest.title') }}</h1>
        <p class="hg-subtitle">{{ t('homeTest.subtitle') }}</p>

        <div class="mt-6 flex flex-wrap gap-3">
          <NuxtLink
            :to="localePath('/builds/create')"
            class="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-bold text-background transition hover:bg-accent-dark"
          >
            <Icon name="mdi:hammer-wrench" size="20px" />
            {{ t('homeTest.ctaCreate') }}
          </NuxtLink>
          <NuxtLink
            :to="localePath('/builds/discover')"
            class="ui-build-card-button inline-flex items-center gap-2 px-6 py-3 text-sm font-bold transition"
          >
            <Icon name="mdi:sword-cross" size="20px" />
            {{ t('homeTest.ctaDiscover') }}
          </NuxtLink>
        </div>

        <ul class="hg-stats">
          <li>
            <strong>{{ formatStat(stats.matches) }}</strong>
            <span>{{ t('homeTest.statMatches') }}</span>
          </li>
          <li>
            <strong>{{ formatStat(stats.builds) }}</strong>
            <span>{{ t('homeTest.statBuilds') }}</span>
          </li>
          <li>
            <strong>{{ formatStat(stats.videos) }}</strong>
            <span>{{ t('homeTest.statVideos') }}</span>
          </li>
        </ul>
      </div>

      <NuxtLink v-if="heroRow && heroChampion" :to="championLink(heroRow)" class="hg-hero-pick">
        <span class="hg-hero-pick-label">{{ t('homeTest.heroPick') }}</span>
        <span class="hg-hero-pick-name">{{ heroChampion.name }}</span>
        <span :class="uiStatisticsTierBadgeClass(heroRow.tier)">{{ heroRow.tier }}</span>
      </NuxtLink>
    </section>

    <div class="hg-container">
      <!-- Derniers builds -->
      <section class="hg-section">
        <div class="hg-section-head">
          <h2 class="hg-h2">{{ t('homeTest.buildsTitle') }}</h2>
          <NuxtLink :to="localePath('/builds/discover')" class="hg-more">
            {{ t('homeTest.buildsSeeAll') }} →
          </NuxtLink>
        </div>
      </section>
    </div>
    <div v-if="!pending && recentBuilds.length" class="hg-builds-wrap">
      <BuildGrid
        :custom-builds="homeBuilds"
        :show-comparison-buttons="false"
        :hide-bottom-actions="true"
        :show-all-custom-builds="true"
      />
    </div>

    <div class="hg-container">
      <!-- Meta du patch -->
      <section class="hg-section">
        <div class="hg-section-head">
          <h2 class="hg-h2">{{ t('homeTest.metaTitle') }}</h2>
          <NuxtLink :to="localePath('/statistics/tier-list')" class="hg-more">
            {{ t('homeTest.metaSeeAll') }} →
          </NuxtLink>
        </div>
        <div class="hg-meta-grid">
          <div v-for="block in metaPicks" :key="block.role" class="hg-role ui-build-card-surface">
            <div class="hg-role-head">
              <img :src="block.icon" :alt="block.label" width="22" height="22" />
              <span>{{ block.label }}</span>
            </div>
            <div v-if="block.champions.length" class="hg-role-picks">
              <NuxtLink
                v-for="row in block.champions"
                :key="row.championId"
                :to="championLink(row)"
                class="hg-pick"
                :title="championName(row)"
              >
                <img
                  v-if="championImage(row)"
                  :src="championImage(row)"
                  :alt="championName(row)"
                  width="64"
                  height="64"
                  loading="lazy"
                />
                <span :class="['hg-tier-corner', uiStatisticsTierBadgeClass(row.tier)]">
                  {{ row.tier }}
                </span>
                <span class="hg-pick-name">{{ championName(row) }}</span>
              </NuxtLink>
            </div>
            <p v-else class="text-xs text-text/50">{{ t('homeTest.noData') }}</p>
          </div>
        </div>
      </section>

      <!-- Récap du patch -->
      <section v-if="patchRecap" class="hg-section">
        <div class="hg-section-head">
          <h2 class="hg-h2">{{ t('homeTest.patchTitle', { version: patchRecap.version }) }}</h2>
          <NuxtLink :to="localePath(`/patch-notes/${patchRecap.version}`)" class="hg-more">
            {{ t('homeTest.patchSeeAll') }} →
          </NuxtLink>
        </div>
        <div class="hg-patch ui-build-card-surface">
          <div class="hg-patch-score">
            <span
              v-for="tag in patchRecap.counts"
              :key="tag.id"
              class="hg-patch-tile"
              :class="`tone-${PATCH_TAG_TILES[tag.id].tone}`"
            >
              <Icon :name="PATCH_TAG_TILES[tag.id].icon" aria-hidden="true" />
              <strong>{{ tag.count }}</strong>
              <span>{{ t(`patchNotesPage.changeTypes.${tag.id}`) }}</span>
            </span>
          </div>
          <div class="hg-patch-sides">
            <div
              v-for="side in patchSides"
              :key="side.id"
              class="hg-patch-side"
              :class="`tone-${PATCH_TAG_TILES[side.id].tone}`"
            >
              <p class="hg-patch-side-title">
                <Icon :name="PATCH_TAG_TILES[side.id].icon" aria-hidden="true" />
                {{ t(`homeTest.patch.${side.id}`) }}
              </p>
              <div class="hg-patch-champs">
                <NuxtLink
                  v-for="entity in side.entities"
                  :key="`${entity.category}-${entity.name}`"
                  :to="localePath(`/patch-notes/${patchRecap.version}`)"
                  class="hg-patch-champ"
                  :title="entity.name"
                >
                  <PatchEntityThumb :entity="entity" />
                  <span>{{ entity.name }}</span>
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </section>
      <!-- Guides (au-delà de 5) -->
      <section v-if="latestGuides.length" class="hg-section">
        <div class="hg-section-head">
          <h2 class="hg-h2">{{ t('homeTest.guidesTitle') }}</h2>
          <NuxtLink :to="localePath('/matchups/sheets/discover')" class="hg-more">
            {{ t('homeTest.guidesSeeAll') }} →
          </NuxtLink>
        </div>
        <div class="hg-guides">
          <NuxtLink
            v-for="guide in latestGuides"
            :key="guide.id"
            :to="matchupGuideDetailPath(guide, localePath)"
            class="hg-guide-link"
          >
            <MatchupGuideCard :guide="guide" />
          </NuxtLink>
        </div>
      </section>
      <!-- Vidéos -->
      <section v-if="latestVideos.length" class="hg-section">
        <div class="hg-section-head">
          <h2 class="hg-h2">{{ t('homeTest.videosTitle') }}</h2>
          <NuxtLink :to="localePath('/videos')" class="hg-more">
            {{ t('homeTest.videosSeeAll') }} →
          </NuxtLink>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <VideoGridCard
            v-for="video in latestVideos.slice(0, 4)"
            :key="video.id"
            :video="video"
            compact
          />
        </div>
      </section>

      <!-- Communauté -->
      <section class="hg-section hg-community">
        <h2 class="hg-h2">{{ t('homeTest.community') }}</h2>
        <div class="mt-3 flex flex-wrap justify-center gap-2">
          <a
            v-for="link in socialLinks"
            :key="link.href"
            :href="link.href"
            :aria-label="link.label"
            :title="link.label"
            class="hg-social ui-build-card-button"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon :name="link.icon" size="22px" />
          </a>
        </div>
      </section>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { Build, MatchupGuide } from '@lelanation/shared-types'
import { useI18n } from 'vue-i18n'
import { usePageOgImage } from '~/composables/usePageOgImage'
import BuildGrid from '~/components/BuildDiscovery/BuildGrid.vue'
import PatchEntityThumb from '~/components/patch/PatchEntityThumb.vue'
import MatchupGuideCard from '~/components/MatchupGuideDiscovery/MatchupGuideCard.vue'
import VideoGridCard from '~/components/Videos/VideoGridCard.vue'
import type { HomeTierListRow } from '~/composables/useHomePage'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { championStatsDetailPath } from '~/utils/championStatsRoutes'
import { homeGuides, homePatchRecap, pickHeroRow, topPicksByRole } from '~/utils/homeGaming'
import { apiUrl } from '~/utils/apiUrl'
import { matchupGuideDetailPath } from '~/utils/matchupGuideSlug'
import { PATCH_TAG_TILES } from '~/utils/patchGaming'
import { pickLatestPatchVersion } from '~/utils/patchVersion'
import {
  normalizePatchNotesVersion,
  usePatchNotesStore,
  type PatchData,
} from '~/stores/PatchNotesStore'
import { getChampionImageUrl, getChampionSplashImageUrl } from '~/utils/imageUrl'
import { uiStatisticsTierBadgeClass } from '~/utils/uiColorClasses'

const { locale, t } = useI18n()
const localePath = useLocalePath()
const championsStore = useChampionsStore()
const { pending, recentBuilds, tierByRole, latestVideos, stats, championForId } = useHomePage()

useHead({
  title: () => t('seo.homeTitle'),
  meta: [{ name: 'description', content: () => t('seo.homeDescription') }],
})

useSeoMeta({
  ogTitle: () => t('seo.homeTitle'),
  ogDescription: () => t('seo.homeDescription'),
  ogType: 'website',
})
usePageOgImage({
  title: () => t('seo.homeTitle'),
  subtitle: () => t('seo.homeDescription'),
})

const patchNotesStore = usePatchNotesStore()
const requestFetch = useRequestFetch()

/** Dernier patch : index puis JSON localisé (repli en-GB), comme la page patch test. */
const { data: latestPatch } = useAsyncData(
  () => `home-patch-${locale.value}`,
  async (): Promise<PatchData | null> => {
    await patchNotesStore.loadIndex(false, requestFetch)
    const version = normalizePatchNotesVersion(
      pickLatestPatchVersion(patchNotesStore.index?.latest, '') || ''
    )
    if (!version) return null
    const url = (l: string) => `/data/patch-notes/${version}/patch-${version}-${l}.json`
    const preferred = locale.value === 'fr' ? 'fr-FR' : 'en-GB'
    for (const l of preferred === 'fr-FR' ? [preferred, 'en-GB'] : [preferred]) {
      try {
        return await requestFetch<PatchData>(url(l), { cache: 'no-cache' })
      } catch {
        // locale suivante
      }
    }
    return null
  },
  { watch: [locale] }
)

const patchRecap = computed(() => {
  const patch = latestPatch.value
  if (!patch?.entities?.length) return null
  return { version: patch.patchVersion, ...homePatchRecap(patch.entities) }
})
const patchSides = computed(() =>
  patchRecap.value
    ? [
        { id: 'buff' as const, entities: patchRecap.value.buffs },
        { id: 'nerf' as const, entities: patchRecap.value.nerfs },
        { id: 'adjustment' as const, entities: patchRecap.value.adjustments },
      ].filter(side => side.entities.length > 0)
    : []
)

const { data: guides } = useAsyncData(
  'home-guides',
  () => $fetch<MatchupGuide[]>(apiUrl('/api/matchup-guides')).catch(() => []),
  { server: false, default: () => [] }
)
const latestGuides = computed(() => homeGuides(guides.value ?? [], 4))

const homeBuilds = computed((): Build[] => recentBuilds.value.slice(0, 6) as Build[])
const metaPicks = computed(() => topPicksByRole(tierByRole.value, 3))
const heroRow = computed(() => pickHeroRow(tierByRole.value))
const heroChampion = computed(() =>
  heroRow.value ? championForId(heroRow.value.championId) : null
)
const heroSplash = computed(() =>
  heroChampion.value ? getChampionSplashImageUrl('latest', heroChampion.value.id) : ''
)

function championName(row: HomeTierListRow): string {
  return row.championName ?? championForId(row.championId)?.name ?? '—'
}

function championImage(row: HomeTierListRow): string {
  const imageName = row.championImage ?? championForId(row.championId)?.image?.full
  return imageName ? getChampionImageUrl('latest', imageName) : ''
}

function championLink(row: HomeTierListRow) {
  return championStatsDetailPath(row.championId, localePath, championsStore.champions)
}

function formatStat(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  return value.toLocaleString(locale.value === 'en' ? 'en-US' : 'fr-FR')
}

const socialLinks = [
  { href: 'https://discord.gg/RrXCpsFGrw', icon: 'mdi:discord', label: 'Discord' },
  { href: 'https://www.youtube.com/@Lelariva_LoL/featured', icon: 'mdi:youtube', label: 'YouTube' },
  { href: 'https://www.twitch.tv/lelariva', icon: 'mdi:twitch', label: 'Twitch' },
  { href: 'https://www.tiktok.com/@lelariva_fr', icon: 'mdi:music-note', label: 'TikTok' },
  { href: 'https://www.instagram.com/lelariva_fr/', icon: 'mdi:instagram', label: 'Instagram' },
  { href: 'https://x.com/Lelariva_fr', icon: 'mdi:twitter', label: 'X' },
  { href: 'https://www.patreon.com/Lelariva', icon: 'mdi:patreon', label: 'Patreon' },
]
</script>

<style scoped>
/* Couleurs : uniquement les tokens du site (accent = gold-300, text = gold-50, blue-*). */
.hg-page {
  width: 100%;
  padding-bottom: 3rem;
}

/* ---------- Hero ---------- */
.hg-hero {
  position: relative;
  overflow: hidden;
  min-height: 460px;
  display: flex;
  align-items: flex-end;
  border-bottom: 1px solid rgb(var(--rgb-accent) / 0.3);
  background: var(--color-blue-600);
  isolation: isolate;
}

/* Splash 1215×717 : jamais affiché au-delà de sa taille native (sinon pixellisé). */
.hg-hero-bg {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: -1;
  width: min(1215px, 100%);
  background-size: cover;
  background-position: center 20%;
  -webkit-mask-image:
    linear-gradient(90deg, transparent 0%, #000 45%),
    linear-gradient(0deg, transparent 0%, #000 40%);
  -webkit-mask-composite: source-in;
  mask-image:
    linear-gradient(90deg, transparent 0%, #000 45%),
    linear-gradient(0deg, transparent 0%, #000 40%);
  mask-composite: intersect;
  animation: hg-fade 0.6s ease-out both;
}

.hg-hero-inner {
  width: 100%;
  max-width: none;
  margin-inline: auto;
  padding: 3rem 16px 2rem;
}

@media (min-width: 640px) {
  .hg-hero-inner {
    padding-inline: 2rem;
  }
}

.hg-eyebrow {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: rgb(var(--rgb-accent) / 0.75);
}

.hg-title {
  margin-top: 0.25rem;
  font-size: clamp(2.25rem, 6vw, 4.5rem);
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--color-text-accent);
  text-shadow: 0 4px 24px rgb(0 0 0 / 0.5);
}

.hg-subtitle {
  margin-top: 0.75rem;
  max-width: 36rem;
  font-size: 1.05rem;
  color: rgb(var(--rgb-text) / 0.8);
}

.hg-stats {
  margin-top: 2rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem 2.5rem;
}

.hg-stats li {
  display: flex;
  flex-direction: column;
}

.hg-stats strong {
  font-size: 1.6rem;
  font-weight: 900;
  color: var(--color-accent);
  font-variant-numeric: tabular-nums;
}

.hg-stats span {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgb(var(--rgb-text) / 0.6);
}

.hg-hero-pick {
  position: absolute;
  right: 2rem;
  bottom: 2rem;
  display: none;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.35rem;
  text-align: right;
}

@media (min-width: 1024px) {
  .hg-hero-pick {
    display: flex;
  }
}

.hg-hero-pick-label {
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgb(var(--rgb-text) / 0.7);
}

.hg-hero-pick-name {
  font-size: 1.75rem;
  font-weight: 900;
  text-transform: uppercase;
  color: var(--color-text);
  text-shadow: 0 2px 12px rgb(0 0 0 / 0.8);
}

/* ---------- Sections ---------- */
.hg-container {
  width: 100%;
  max-width: none;
  margin-inline: auto;
  padding-inline: 16px;
}

@media (min-width: 640px) {
  .hg-container {
    padding-inline: 2rem;
  }
}

.hg-section {
  margin-top: 2.5rem;
}

.hg-section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.hg-h2 {
  position: relative;
  padding-left: 0.85rem;
  font-size: 1.4rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-accent);
}

.hg-h2::before {
  content: '';
  position: absolute;
  left: 0;
  top: 15%;
  bottom: 15%;
  width: 4px;
  background: var(--color-accent);
}

.hg-more {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-accent);
}

.hg-more:hover {
  text-decoration: underline;
}

/* ---------- Meta ---------- */
.hg-meta-grid {
  margin-top: 1rem;
  display: grid;
  gap: 0.75rem;
}

@media (min-width: 640px) {
  .hg-meta-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .hg-meta-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

.hg-role {
  padding: 0.75rem;
}

.hg-role-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgb(var(--rgb-primary) / 0.15);
  font-size: 0.85rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text);
}

.hg-role-picks {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.hg-pick {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.hg-pick img {
  width: 100%;
  max-width: 64px;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 6px;
  transition: transform 0.15s;
}

.hg-pick:hover img {
  transform: scale(1.06);
}

.hg-pick-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.7rem;
  font-weight: 600;
  color: rgb(var(--rgb-text) / 0.85);
}

.hg-pick:hover .hg-pick-name {
  color: var(--color-accent);
}

.hg-tier-corner {
  position: absolute;
  top: -6px;
  right: 0;
}

/* ---------- Récap patch ---------- */
.hg-patch {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.hg-patch-score {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
  gap: 0.5rem;
}

.hg-patch-tile {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgb(var(--tone-rgb) / 0.5);
  border-radius: 0.5rem;
  background: rgb(var(--tone-rgb) / 0.12);
  color: rgb(var(--tone-rgb));
}

.hg-patch-tile strong {
  font-size: 1.25rem;
}

.hg-patch-tile span {
  color: rgb(var(--rgb-text) / 0.8);
  font-size: 0.85rem;
}

.hg-patch-sides {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 1rem;
}

.hg-patch-side {
  min-width: 0;
  padding: 0.75rem;
  border: 1px solid rgb(var(--tone-rgb) / 0.3);
  border-radius: 0.5rem;
  background: rgb(var(--tone-rgb) / 0.05);
}

.hg-patch-side-title {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
  color: rgb(var(--tone-rgb));
  font-weight: 700;
}

.hg-patch-champs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.hg-patch-champ {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  width: 4.5rem;
  color: var(--color-text);
  font-size: 0.75rem;
  text-align: center;
  text-decoration: none;
}

.hg-patch-champ img {
  border: 2px solid rgb(var(--tone-rgb) / 0.7);
  border-radius: 0.4rem;
}

.tone-info {
  --tone-rgb: var(--rgb-info);
}

.tone-error {
  --tone-rgb: var(--rgb-error);
}

.tone-warning {
  --tone-rgb: var(--rgb-warning);
}

.tone-muted {
  --tone-rgb: var(--rgb-muted);
}

/* ---------- Guides ---------- */
.hg-guides {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: 1rem;
}

.hg-guide-link {
  color: inherit;
  text-decoration: none;
}

/* ---------- Builds / communauté ---------- */
.hg-builds-wrap {
  margin-top: 1rem;
  width: 100%;
  padding-inline: 10px;
}

.hg-community {
  text-align: center;
}

.hg-community .hg-h2 {
  display: inline-block;
}

.hg-social {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
}

@keyframes hg-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hg-hero-bg {
    animation: none;
  }
}
</style>
