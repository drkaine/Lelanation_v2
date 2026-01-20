<template>
  <div>
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-4 focus:py-2 focus:text-text"
    >
      Skip to content
    </a>
    <AppNavbar />
    <main id="main" tabindex="-1">
      <NuxtPage />
    </main>
    <CookieConsentBanner />
  </div>
</template>

<script setup lang="ts">
import CookieConsentBanner from '~/components/CookieConsentBanner.vue'

const localeHead = useLocaleHead({ addDirAttribute: true, addSeoAttributes: true })
useHead(() => ({
  htmlAttrs: localeHead.value.htmlAttrs,
  link: localeHead.value.link,
  meta: localeHead.value.meta,
}))
</script>

<style>
@import './assets/css/tokens.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
</style>
