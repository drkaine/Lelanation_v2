<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BuildGrid from '~/components/BuildDiscovery/BuildGrid.vue'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { championBuildsList } from '~/utils/statistics/championBuildsList'

const props = defineProps<{ championId: string; championName: string }>()

const { t } = useI18n()
const localePath = useLocalePath()
const discovery = useBuildDiscoveryStore()
const loading = ref(false)

const builds = computed(() => championBuildsList(discovery.builds, props.championId))

onMounted(async () => {
  if (discovery.builds.length) return
  loading.value = true
  try {
    await discovery.loadBuilds()
  } catch {
    /* liste vide affichée */
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="champion-builds-tab">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-text-accent">
        {{ t('statisticsPage.championBuildsTitle', { champion: championName }) }}
      </h2>
      <NuxtLink :to="localePath('/builds/create')" class="text-sm text-accent hover:underline">
        {{ t('statisticsPage.championBuildsCreate') }} →
      </NuxtLink>
    </div>
    <p v-if="loading" class="text-sm text-text/60">{{ t('statisticsPage.loading') }}</p>
    <p v-else-if="!builds.length" class="text-sm text-text/60">
      {{ t('statisticsPage.championBuildsEmpty', { champion: championName }) }}
    </p>
    <BuildGrid
      v-else
      :custom-builds="builds"
      :show-comparison-buttons="true"
      :hide-bottom-actions="false"
      :show-all-custom-builds="true"
    />
  </div>
</template>
