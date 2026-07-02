<template>
  <div
    class="statistics-champion-picker flex min-h-screen min-w-0 flex-col overflow-x-hidden bg-background px-4 pb-8 pt-4 text-text max-lg:px-3"
  >
    <header class="statistics-champion-picker__header mb-4">
      <h1 class="text-lg font-bold text-text-accent sm:text-xl">
        {{ t('statisticsPage.championPickerTitle') }}
      </h1>
      <p class="mt-1 text-sm text-text/65">
        {{ t('statisticsPage.championPickerHint') }}
      </p>
    </header>

    <ChampionSelector navigate-to-statistics />
  </div>
</template>

<script setup lang="ts">
import ChampionSelector from '~/components/Build/ChampionSelector.vue'

const { t } = useI18n()

useHead({
  title: () => t('statisticsPage.championPickerTitle'),
  meta: [
    {
      name: 'description',
      content: () => t('statisticsPage.championPickerHint'),
    },
  ],
})
</script>
