<template>
  <div class="home-page max-w-8xl mx-auto px-3 py-6 text-text sm:px-4">
    <!-- Hero -->
    <section
      class="home-hero mb-12 grid items-center gap-8 lg:grid-cols-[1fr_minmax(0,320px)] lg:gap-10"
    >
      <div class="text-center lg:text-left">
        <p class="mb-2 text-sm font-semibold uppercase tracking-widest text-accent">
          {{ t('home.heroEyebrow') }}
        </p>
        <h1 class="text-3xl font-bold leading-tight text-text-accent sm:text-4xl lg:text-5xl">
          {{ t('home.heroTitle') }}
        </h1>
        <p class="mx-auto mt-4 max-w-2xl text-base text-text/80 sm:text-lg lg:mx-0">
          {{ t('home.heroSubtitle') }}
        </p>
        <div class="mt-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
          <NuxtLink
            :to="localePath('/builds/create')"
            class="inline-flex items-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background transition hover:bg-accent-dark"
          >
            {{ t('home.ctaCreateBuild') }}
          </NuxtLink>
          <NuxtLink
            :to="localePath('/builds/discover')"
            class="inline-flex items-center rounded-lg border border-accent/70 bg-surface/60 px-5 py-2.5 text-sm font-semibold text-text transition hover:border-accent hover:bg-surface"
          >
            {{ t('home.ctaDiscoverBuilds') }}
          </NuxtLink>
        </div>
      </div>
      <div class="flex justify-center lg:justify-end">
        <picture>
          <source
            type="image/webp"
            srcset="/images/lelariva-400.webp 400w, /images/lelariva-800.webp 800w"
            sizes="(max-width: 768px) 200px, 280px"
          />
          <img
            class="home-hero-image"
            src="/images/lelariva.png"
            :alt="t('home.heroImageAlt')"
            width="280"
            height="280"
            decoding="async"
            fetchpriority="high"
          />
        </picture>
      </div>
    </section>

    <!-- Popular builds -->
    <section class="mb-12">
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="text-xl font-bold text-text sm:text-2xl">
            {{ t('home.popularBuildsTitle') }}
          </h2>
          <p class="mt-1 text-sm text-text/65">{{ t('home.popularBuildsSubtitle') }}</p>
        </div>
        <NuxtLink
          :to="localePath('/builds/discover')"
          class="text-sm font-semibold text-accent hover:underline"
        >
          {{ t('home.seeAllBuilds') }}
        </NuxtLink>
      </div>
      <div v-if="pending" class="py-8 text-center text-sm text-text/60">
        {{ t('home.loading') }}
      </div>
      <div
        v-else-if="popularBuilds.length === 0"
        class="rounded-xl border border-primary/25 bg-surface/40 px-4 py-8 text-center text-sm text-text/70"
      >
        {{ t('home.noBuildsYet') }}
      </div>
      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <HomeBuildCard v-for="build in popularBuilds" :key="build.id" :build="build" />
      </div>
    </section>

    <!-- Quick tier list -->
    <section class="mb-12">
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="text-xl font-bold text-text sm:text-2xl">{{ t('home.tierListTitle') }}</h2>
          <p class="mt-1 text-sm text-text/65">
            {{
              t('home.tierListSubtitle', {
                patch: stats.patch,
                season: stats.season,
              })
            }}
          </p>
        </div>
        <NuxtLink
          :to="localePath('/statistics/tier-list')"
          class="text-sm font-semibold text-accent hover:underline"
        >
          {{ t('home.fullTierList') }}
        </NuxtLink>
      </div>
      <div class="grid gap-4 lg:grid-cols-5">
        <div
          v-for="roleBlock in tierByRole"
          :key="roleBlock.role"
          class="rounded-xl border border-primary/25 bg-surface/50 p-3"
        >
          <div class="mb-3 flex items-center gap-2 border-b border-primary/15 pb-2">
            <img
              :src="roleBlock.icon"
              :alt="roleBlock.label"
              width="20"
              height="20"
              class="h-5 w-5"
            />
            <h3 class="text-sm font-bold text-text">{{ roleBlock.label }}</h3>
          </div>
          <ul v-if="roleBlock.champions.length" class="space-y-2">
            <li v-for="row in roleBlock.champions" :key="`${roleBlock.role}-${row.championId}`">
              <NuxtLink
                :to="localePath(`/statistics/champion/${row.championId}`)"
                class="flex items-center gap-2 rounded-lg px-1 py-1 transition hover:bg-background/30"
              >
                <img
                  v-if="championImageFor(row.championId)"
                  :src="championImageFor(row.championId)"
                  :alt="championNameFor(row.championId) ?? ''"
                  width="28"
                  height="28"
                  class="h-7 w-7 shrink-0 rounded object-cover"
                  loading="lazy"
                />
                <span class="min-w-0 flex-1 truncate text-xs font-medium text-text">
                  {{ championNameFor(row.championId) }}
                </span>
                <span
                  class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
                  :class="tierBadgeClass(row.tier)"
                >
                  {{ row.tier }}
                </span>
              </NuxtLink>
            </li>
          </ul>
          <p v-else class="text-xs text-text/50">{{ t('home.tierNoData') }}</p>
        </div>
      </div>
    </section>

    <!-- Latest video -->
    <section v-if="latestVideo" class="mb-12">
      <div class="mb-4">
        <h2 class="text-xl font-bold text-text sm:text-2xl">{{ t('home.latestVideoTitle') }}</h2>
        <p class="mt-1 text-sm text-text/65">{{ t('home.latestVideoSubtitle') }}</p>
      </div>
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <a
          :href="latestVideo.url"
          target="_blank"
          rel="noopener noreferrer"
          class="group block overflow-hidden rounded-xl border border-accent/60 bg-surface/60"
        >
          <div class="relative aspect-video w-full bg-black/40">
            <img
              :src="latestVideo.thumbnailUrl"
              :alt="latestVideo.title"
              width="640"
              height="360"
              class="h-full w-full object-cover transition group-hover:scale-[1.02]"
              loading="lazy"
              decoding="async"
            />
            <span
              class="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition group-hover:opacity-100"
              aria-hidden="true"
            >
              <span class="rounded-full bg-accent px-4 py-2 text-sm font-bold text-background"
                >▶</span
              >
            </span>
          </div>
        </a>
        <div class="flex flex-col justify-center">
          <p class="text-lg font-semibold text-text">{{ latestVideo.title }}</p>
          <p class="mt-2 text-sm text-text/65">{{ formatVideoDate(latestVideo.publishedAt) }}</p>
          <div class="mt-4 flex flex-wrap gap-3">
            <a
              :href="latestVideo.url"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent-dark"
            >
              {{ t('home.watchVideo') }}
            </a>
            <NuxtLink
              :to="localePath('/videos')"
              class="inline-flex items-center rounded-lg border border-accent/60 px-4 py-2 text-sm font-semibold text-text hover:border-accent"
            >
              {{ t('home.allVideos') }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- Companion app CTA -->
    <section
      class="mb-12 rounded-2xl border border-primary/30 bg-gradient-to-br from-surface/80 to-background/40 p-6 sm:p-8"
    >
      <div class="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <h2 class="text-xl font-bold text-text sm:text-2xl">{{ t('home.appTitle') }}</h2>
          <p class="mt-2 max-w-xl text-sm text-text/75 sm:text-base">{{ t('home.appSubtitle') }}</p>
          <ul class="mt-4 space-y-1 text-sm text-text/70">
            <li>• {{ t('lelanationApp.features.importBuilds') }}</li>
            <li>• {{ t('lelanationApp.features.localFavorites') }}</li>
            <li>• {{ t('lelanationApp.features.settings') }}</li>
          </ul>
        </div>
        <div class="flex flex-wrap gap-3">
          <NuxtLink
            :to="localePath('/app')"
            class="inline-flex items-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background hover:bg-accent-dark"
          >
            {{ t('home.appDownload') }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Global stats -->
    <section class="mb-10">
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-xl border border-primary/25 bg-surface/50 px-4 py-5 text-center">
          <p class="text-2xl font-bold text-accent">{{ formatStat(stats.builds) }}</p>
          <p class="mt-1 text-sm text-text/70">{{ t('home.statBuilds') }}</p>
        </div>
        <div class="rounded-xl border border-primary/25 bg-surface/50 px-4 py-5 text-center">
          <p class="text-2xl font-bold text-accent">{{ formatStat(stats.players) }}</p>
          <p class="mt-1 text-sm text-text/70">{{ t('home.statPlayers') }}</p>
        </div>
        <div class="rounded-xl border border-primary/25 bg-surface/50 px-4 py-5 text-center">
          <p class="text-2xl font-bold text-accent">{{ formatStat(stats.videos) }}</p>
          <p class="mt-1 text-sm text-text/70">{{ t('home.statVideos') }}</p>
        </div>
      </div>
    </section>

    <!-- Social links (compact) -->
    <section class="border-t border-primary/20 pt-8">
      <p class="mb-4 text-center text-sm font-semibold text-text/60">{{ t('home.followUs') }}</p>
      <div class="flex flex-wrap justify-center gap-2">
        <a
          v-for="link in socialLinks"
          :key="link.href"
          class="inline-flex items-center gap-2 rounded-lg border border-accent/50 px-3 py-2 text-xs font-medium text-text/85 transition hover:border-accent hover:bg-surface/60"
          :href="link.href"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon :name="link.icon" size="16px" />
          <span>{{ link.text }}</span>
        </a>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import HomeBuildCard from '~/components/home/HomeBuildCard.vue'
import { getChampionImageUrl } from '~/utils/imageUrl'

const { locale } = useI18n()
const {
  pending,
  popularBuilds,
  tierByRole,
  latestVideo,
  stats,
  localePath,
  siteUrl,
  t,
  championForId,
} = useHomePage()

useHead({
  title: () => t('seo.homeTitle'),
  meta: [{ name: 'description', content: () => t('seo.homeDescription') }],
  link: [
    {
      rel: 'preload',
      href: '/images/lelariva-400.webp',
      as: 'image',
      type: 'image/webp',
      fetchPriority: 'high',
    },
  ],
})

useSeoMeta({
  ogTitle: () => t('seo.homeTitle'),
  ogDescription: () => t('seo.homeDescription'),
  ogType: 'website',
  ogUrl: siteUrl,
  twitterCard: 'summary_large_image',
})

useJsonLdHead('home-website', () => webSiteJsonLd(siteUrl))
useJsonLdHead('home-organization', () => organizationJsonLd(siteUrl))

interface SocialLink {
  href: string
  icon: string
  text: string
}

const socialLinks = computed((): SocialLink[] => [
  { href: 'https://discord.gg/RrXCpsFGrw', icon: 'mdi:discord', text: t('home.links.discord') },
  {
    href: 'https://www.youtube.com/@Lelariva_LoL/featured',
    icon: 'mdi:youtube',
    text: t('home.links.youtube'),
  },
  { href: 'https://www.twitch.tv/lelariva', icon: 'mdi:twitch', text: t('home.links.twitch') },
  {
    href: 'https://www.instagram.com/lelariva_fr/',
    icon: 'mdi:instagram',
    text: t('home.links.instagram'),
  },
])

function championNameFor(championId: number): string | null {
  return championForId(championId)?.name ?? null
}

function championImageFor(championId: number): string {
  const champ = championForId(championId)
  const imageName = champ?.image?.full
  if (!imageName) return ''
  return getChampionImageUrl('latest', imageName)
}

function tierBadgeClass(tier: string): string {
  const t = tier.toUpperCase()
  if (t === 'S' || t === 'S+') return 'bg-amber-500/20 text-amber-300'
  if (t === 'A' || t === 'A+') return 'bg-green-500/15 text-green-300'
  if (t === 'B' || t === 'B+') return 'bg-sky-500/15 text-sky-200'
  return 'bg-surface text-text/70'
}

function formatStat(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  return value.toLocaleString(locale.value === 'en' ? 'en-US' : 'fr-FR')
}

function formatVideoDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(locale.value === 'en' ? 'en-US' : 'fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>

<style scoped>
.home-hero-image {
  width: min(100%, 280px);
  height: auto;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 9999px;
  box-shadow: 0 0 24px rgb(200 155 60 / 0.25);
}
</style>
