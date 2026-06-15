<template>
  <div class="builds-by-champion min-h-screen p-4 text-text">
    <div class="max-w-8xl mx-auto px-2">
      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap items-center gap-3">
          <NuxtLink
            :to="localePath('/builds/discover')"
            class="rounded-lg bg-surface px-4 py-2 text-text transition-colors hover:bg-primary hover:text-white"
          >
            {{ t('championBuildsPage.backToBuilds') }}
          </NuxtLink>
          <img
            v-if="championIconUrl"
            :src="championIconUrl"
            :alt="championName || championSlug"
            width="48"
            height="48"
            class="h-12 w-12 shrink-0 rounded-lg object-cover"
            loading="eager"
            fetchpriority="high"
            decoding="async"
          />
          <h1 class="text-xl font-bold text-text sm:text-2xl">
            {{
              championName
                ? t('championBuildsPage.heading', { champion: championName })
                : t('championBuildsPage.headingFallback', { slug: championSlug })
            }}
          </h1>
        </div>
      </div>

      <div class="mb-6 space-y-4">
        <BuildSearch />
        <BuildFilters />
      </div>

      <BuildGrid />
    </div>
  </div>
</template>

<script setup lang="ts">
import BuildSearch from '~/components/BuildDiscovery/BuildSearch.vue'
import BuildFilters from '~/components/BuildDiscovery/BuildFilters.vue'
import BuildGrid from '~/components/BuildDiscovery/BuildGrid.vue'

const { championSlug, championName, championIconUrl, localePath, t } = useChampionBuildsPage()
</script>
