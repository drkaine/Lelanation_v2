<!-- eslint-disable vue/no-v-html -- trusted i18n content from locale JSON -->
<template>
  <section class="grid w-full gap-4">
    <p class="max-w-3xl text-sm leading-relaxed text-text/80" v-html="t('howItWorks.intro')" />

    <InfoSection :title="t('howItWorks.gameAssets.title')">
      <p class="text-text/80" v-html="t('howItWorks.gameAssets.p1')" />
      <ul class="mt-3 list-inside list-disc space-y-2 text-sm text-text/80">
        <li v-html="t('howItWorks.gameAssets.li1')" />
        <li v-html="t('howItWorks.gameAssets.li2')" />
      </ul>
    </InfoSection>

    <InfoSection :title="t('howItWorks.stats.title')">
      <p class="text-text/80" v-html="t('howItWorks.stats.p1')" />
    </InfoSection>

    <InfoSection :title="t('howItWorks.patchNotes.title')">
      <p class="text-text/80" v-html="t('howItWorks.patchNotes.p1')" />
    </InfoSection>

    <InfoSection :title="t('howItWorks.videos.title')">
      <p class="text-text/80" v-html="t('howItWorks.videos.p1')" />
    </InfoSection>

    <p class="text-xs text-text/55">
      {{ t('howItWorks.disclaimer') }}
      <NuxtLink :to="localePath('/legal')" class="text-accent underline hover:text-accent-dark">
        {{ t('information.data.legalLink') }}
      </NuxtLink>
      .
    </p>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import InfoSection from '~/components/Information/InfoSection.vue'

const { t } = useI18n()
const localePath = useLocalePath()
</script>
