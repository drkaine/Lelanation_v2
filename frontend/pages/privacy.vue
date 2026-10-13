<template>
  <LegalGamingDoc doc="privacy" />
</template>

<script setup lang="ts">
import LegalGamingDoc from '~/components/legal/LegalGamingDoc.vue'

const { t } = useI18n()

useHead({
  title: () => t('privacy.metaTitle'),
  meta: [
    {
      name: 'description',
      content: () => t('privacy.metaDescription'),
    },
    { name: 'robots', content: 'index,follow' },
  ],
})

useSeoMeta({
  ogTitle: () => t('privacy.metaTitle'),
  ogDescription: () => t('privacy.metaDescription'),
  ogType: 'website',
})
</script>
