<template>
  <LegalGamingDoc doc="legal" />
</template>

<script setup lang="ts">
import LegalGamingDoc from '~/components/legal/LegalGamingDoc.vue'

const { t } = useI18n()

useHead({
  title: () => t('legal.metaTitle'),
  meta: [
    {
      name: 'description',
      content: () => t('legal.metaDescription'),
    },
    { name: 'robots', content: 'index,follow' },
  ],
})

useSeoMeta({
  ogTitle: () => t('legal.metaTitle'),
  ogDescription: () => t('legal.metaDescription'),
  ogType: 'website',
})
</script>
