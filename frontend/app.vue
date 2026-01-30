<template>
  <div class="flex min-h-screen flex-col">
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
    <AppFooter />
    <CookieConsentBanner />
  </div>
</template>

<script setup lang="ts">
import CookieConsentBanner from '~/components/CookieConsentBanner.vue'
import AppFooter from '~/components/AppFooter.vue'

const localeHead = useLocaleHead({ addDirAttribute: true, addSeoAttributes: true })
const config = useRuntimeConfig().public
const matomoHost = (config.matomoHost as string)?.trim()
const matomoSiteId = config.matomoSiteId
const matomoScript =
  matomoHost && matomoSiteId
    ? [
        {
          innerHTML: `var _paq=window._paq=window._paq||[];_paq.push(["requireConsent"]);_paq.push(["setTrackerUrl",${JSON.stringify((matomoHost.endsWith('/') ? matomoHost : matomoHost + '/') + 'matomo.php')}]);_paq.push(["setSiteId",${JSON.stringify(String(matomoSiteId))}]);_paq.push(["enableLinkTracking"]);(function(){var u=${JSON.stringify(matomoHost.endsWith('/') ? matomoHost : matomoHost + '/')};var d=document,g=d.createElement("script"),s=d.getElementsByTagName("script")[0];g.async=true;g.src=u+"matomo.js";if(s&&s.parentNode)s.parentNode.insertBefore(g,s);})();`,
          type: 'text/javascript',
        },
      ]
    : []

useHead(() => ({
  htmlAttrs: localeHead.value.htmlAttrs,
  link: localeHead.value.link,
  meta: localeHead.value.meta,
  ...(matomoScript.length ? { script: matomoScript } : {}),
}))
</script>

<style>
@import './assets/css/tokens.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  /* Selectors: force black background */
  select {
    background-color: #000;
  }

  option {
    background-color: #000;
  }
}

/* Global graphic rules:
   - No pure white in UI (replace with the lightest blue).
*/
@layer utilities {
  .text-white {
    color: rgb(var(--rgb-primary-light) / 1) !important;
  }

  .bg-white {
    background-color: rgb(var(--rgb-primary-light) / 1) !important;
  }

  /* bg-surface should be transparent */
  .bg-surface {
    background-color: transparent !important;
  }

  /* All borders should be gold (accent) */
  [class*='border-primary'] {
    border-color: rgb(var(--rgb-accent) / 0.7) !important;
  }
}
</style>
