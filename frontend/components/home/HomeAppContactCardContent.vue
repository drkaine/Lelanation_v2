<script setup lang="ts">
defineProps<{
  section: 'app' | 'contact'
}>()

const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <template v-if="section === 'app'">
    <h2 class="home-section-title text-xl font-bold sm:text-2xl">{{ t('home.appTitle') }}</h2>
    <p class="home-section-subtitle mx-auto mt-2 max-w-xl text-sm sm:text-base">
      {{ t('home.appSubtitle') }}
    </p>
    <ul class="mx-auto mt-4 max-w-md space-y-1 text-sm text-text/70">
      <li>• {{ t('lelanationApp.features.importBuilds') }}</li>
      <li>• {{ t('lelanationApp.features.localFavorites') }}</li>
      <li>• {{ t('lelanationApp.features.settings') }}</li>
    </ul>
    <div class="mt-4 flex flex-wrap justify-center gap-3">
      <NuxtLink
        :to="localePath('/download')"
        class="inline-flex items-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background hover:bg-accent-dark"
      >
        {{ t('home.appDownload') }}
      </NuxtLink>
    </div>
  </template>

  <template v-else>
    <div class="home-section-header mb-2">
      <h2 class="home-section-title text-xl font-bold sm:text-2xl">
        {{ t('home.contactTitle') }}
      </h2>
      <p class="home-section-subtitle mt-1 text-sm">{{ t('home.contactSubtitle') }}</p>
    </div>
    <div class="mx-auto w-full max-w-2xl text-left">
      <ContactForm id-prefix="home-contact-" />
    </div>
  </template>
</template>

<style scoped>
.home-section-title {
  color: var(--color-gold-300);
}

.home-section-subtitle {
  color: rgb(125 211 252 / 0.88);
}
</style>
