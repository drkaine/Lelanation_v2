<template>
  <NuxtLink
    :to="localePath(`/builds/${build.id}`)"
    class="group flex h-full flex-col overflow-hidden rounded-xl border border-accent/60 bg-surface/80 transition hover:border-accent hover:shadow-lg hover:shadow-black/20"
  >
    <div class="flex items-center gap-3 border-b border-primary/20 bg-background/20 px-4 py-3">
      <img
        v-if="championImage"
        :src="championImage"
        :alt="build.champion?.name ?? ''"
        width="48"
        height="48"
        class="h-12 w-12 shrink-0 rounded-lg object-cover"
        loading="lazy"
        decoding="async"
      />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-bold text-text">{{ build.champion?.name }}</p>
        <p class="truncate text-xs text-text/60">{{ build.name }}</p>
      </div>
    </div>
    <div class="flex flex-1 flex-col justify-between gap-2 px-4 py-3">
      <p v-if="build.author" class="truncate text-xs text-text/55">
        {{ build.author }}
      </p>
      <span class="text-xs font-semibold text-accent group-hover:underline">
        {{ t('home.viewBuild') }}
      </span>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { Build } from '@lelanation/shared-types'
import { getChampionImageUrl } from '~/utils/imageUrl'

const props = defineProps<{ build: Build }>()
const localePath = useLocalePath()
const { t } = useI18n()

const championImage = computed(() => {
  const imageName = props.build.champion?.image?.full
  if (!imageName) return ''
  return getChampionImageUrl('latest', imageName)
})
</script>
