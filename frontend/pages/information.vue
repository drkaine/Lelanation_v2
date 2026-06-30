<!-- eslint-disable vue/no-v-html -- trusted i18n content from locale JSON -->
<template>
  <div
    class="information-page flex min-h-screen w-full min-w-0 flex-col overflow-x-hidden bg-background text-text"
  >
    <header
      class="w-full shrink-0 border-b border-primary/20 bg-surface/20 px-3 py-4 sm:px-5 lg:px-6"
    >
      <h1 class="text-2xl font-bold text-text-accent sm:text-3xl">{{ t('information.title') }}</h1>
      <p
        class="mt-2 max-w-5xl text-sm leading-relaxed text-text/80 sm:text-base"
        v-html="t('information.intro')"
      />
    </header>

    <InformationTabsContent />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import InformationTabsContent from '~/components/Information/InformationTabsContent.vue'

const { t } = useI18n()

useHead({
  title: () => t('information.metaTitle'),
  meta: [
    {
      name: 'description',
      content: () => t('information.metaDescription'),
    },
    { name: 'robots', content: 'index,follow' },
  ],
})
useSeoMeta({
  title: () => t('information.metaTitle'),
  description: () => t('information.metaDescription'),
})
</script>
