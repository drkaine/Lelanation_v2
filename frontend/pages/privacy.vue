<!-- eslint-disable vue/no-v-html -- trusted i18n content from locale JSON -->
<template>
  <div class="min-h-screen p-4 text-text">
    <div class="mx-auto max-w-3xl space-y-8">
      <h1 class="text-3xl font-bold text-text-accent">{{ t('privacy.title') }}</h1>

      <section>
        <h2 class="mt-8 text-xl font-bold text-text">{{ t('privacy.dataCollected.title') }}</h2>
        <p class="mt-2 text-text/80">{{ t('privacy.dataCollected.p1') }}</p>
        <p class="mt-2 text-text/80">{{ t('privacy.dataCollected.p2') }}</p>
      </section>

      <section>
        <h2 class="mt-8 text-xl font-bold text-text">{{ t('privacy.cookies.title') }}</h2>

        <h3 class="mt-4 text-lg font-semibold text-text">
          {{ t('privacy.cookies.essential.title') }}
        </h3>
        <p class="mt-2 text-text/80" v-html="t('privacy.cookies.essential.p1')" />
        <ul class="mt-2 list-inside list-disc space-y-1 text-text/80">
          <li>{{ t('privacy.cookies.essential.li1') }}</li>
          <li>{{ t('privacy.cookies.essential.li2') }}</li>
          <li>{{ t('privacy.cookies.essential.li3') }}</li>
          <li>{{ t('privacy.cookies.essential.li4') }}</li>
        </ul>
        <p class="mt-2 text-text/80">{{ t('privacy.cookies.essential.p2') }}</p>

        <h3 class="mt-6 text-lg font-semibold text-text">
          {{ t('privacy.cookies.nonEssential.title') }}
        </h3>
        <p class="mt-2 text-text/80" v-html="t('privacy.cookies.nonEssential.p1')" />
        <p class="mt-2 text-text/80">{{ t('privacy.cookies.nonEssential.p2') }}</p>

        <h3 class="mt-6 text-lg font-semibold text-text">
          {{ t('privacy.cookies.manage.title') }}
        </h3>
        <p class="mt-2 text-text/80">{{ t('privacy.cookies.manage.p1') }}</p>
        <ul class="mt-2 list-inside list-disc space-y-1 text-text/80">
          <li>{{ t('privacy.cookies.manage.li1') }}</li>
          <li>{{ t('privacy.cookies.manage.li2') }}</li>
          <li>{{ t('privacy.cookies.manage.li3') }}</li>
        </ul>
      </section>

      <section>
        <h2 class="mt-8 text-xl font-bold text-text">{{ t('privacy.shareBuilds.title') }}</h2>
        <p class="mt-2 text-text/80">{{ t('privacy.shareBuilds.p1') }}</p>
        <p class="mt-2 text-text/80">{{ t('privacy.shareBuilds.p2') }}</p>
      </section>

      <section>
        <h2 class="mt-8 text-xl font-bold text-text">{{ t('privacy.thirdParty.title') }}</h2>
        <p class="mt-2 text-text/80">{{ t('privacy.thirdParty.p1') }}</p>
        <p class="mt-2 text-text/80">{{ t('privacy.thirdParty.p2') }}</p>
      </section>

      <section>
        <h2 class="mt-8 text-xl font-bold text-text">{{ t('privacy.analytics.title') }}</h2>
        <p class="mt-2 text-text/80" v-html="t('privacy.analytics.p1')" />
        <p class="mt-2 text-text/80">{{ t('privacy.analytics.p2') }}</p>
      </section>

      <section>
        <h2 class="mt-8 text-xl font-bold text-text">{{ t('privacy.rights.title') }}</h2>
        <p class="mt-2 text-text/80">{{ t('privacy.rights.intro') }}</p>
        <ul class="mt-2 list-inside list-disc space-y-1 text-text/80">
          <li>{{ t('privacy.rights.access') }}</li>
          <li>{{ t('privacy.rights.rectification') }}</li>
          <li>{{ t('privacy.rights.erasure') }}</li>
          <li>{{ t('privacy.rights.portability') }}</li>
        </ul>
        <p class="mt-2 text-text/80">{{ t('privacy.rights.p2') }}</p>
      </section>

      <section>
        <h2 class="mt-8 text-xl font-bold text-text">{{ t('privacy.contact.title') }}</h2>
        <p class="mt-2 text-text/80">{{ t('privacy.contact.text') }}</p>
      </section>

      <section>
        <p class="mt-8 text-sm text-text/60">{{ t('privacy.lastUpdate') }} {{ lastUpdateDate }}</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t, locale } = useI18n()

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

const lastUpdateDate = computed(() =>
  new Date().toLocaleDateString(locale.value === 'fr' ? 'fr-FR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
)
</script>
