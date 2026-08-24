<template>
  <div class="item-shop-page min-h-screen text-text">
    <ItemShopBrowser />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ItemShopBrowser from '~/components/Items/ItemShopBrowser.vue'

const { t } = useI18n()

useHead({
  title: () => t('itemShopPage.metaTitle'),
  meta: [
    {
      name: 'description',
      content: () => t('itemShopPage.metaDescription'),
    },
  ],
})
</script>

<style scoped>
.item-shop-page {
  width: 100%;
  padding: var(--build-create-page-padding-top, 1rem) 0.75rem 1rem;
  margin-top: var(--build-create-page-lift, 0);
}
</style>
