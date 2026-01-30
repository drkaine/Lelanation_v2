<!-- eslint-disable vue/no-v-html -- trusted i18n content from locale JSON -->
<template>
  <div class="min-h-screen p-4 text-text">
    <div class="mx-auto max-w-3xl space-y-8">
      <h1 class="text-3xl font-bold text-text-accent">{{ t('legal.title') }}</h1>

      <section>
        <h2 class="mt-8 text-xl font-bold text-text">{{ t('legal.siteInfo.title') }}</h2>
        <p class="mt-2 text-text/80" v-html="t('legal.siteInfo.intro')" />
      </section>

      <section>
        <h2 class="mt-8 text-xl font-bold text-text">{{ t('legal.riotData.title') }}</h2>
        <p class="mt-2 text-text/80" v-html="t('legal.riotData.p1')" />
        <p class="mt-2 text-text/80" v-html="t('legal.riotData.p2')" />
        <p class="mt-2 text-text/80" v-html="t('legal.riotData.p3')" />
        <p class="mt-2 text-text/80">
          {{ t('legal.riotData.p4') }}
          <a
            :href="t('legal.riotData.riotLegalUrl')"
            target="_blank"
            rel="noopener noreferrer"
            class="text-accent underline hover:text-accent-dark"
          >
            {{ t('legal.riotData.riotLegalUrl') }}
          </a>
        </p>
      </section>

      <section>
        <h2 class="mt-8 text-xl font-bold text-text">{{ t('legal.lelariva.title') }}</h2>
        <p class="mt-2 text-text/80" v-html="t('legal.lelariva.p1')" />
        <p class="mt-2 text-text/80" v-html="t('legal.lelariva.p2')" />
        <p class="mt-2 text-text/80" v-html="t('legal.lelariva.p3')" />
      </section>

      <section>
        <h2 class="mt-8 text-xl font-bold text-text">{{ t('legal.ip.title') }}</h2>
        <p class="mt-2 text-text/80" v-html="t('legal.ip.p1')" />
        <p class="mt-2 text-text/80" v-html="t('legal.ip.p2')" />
      </section>

      <section>
        <h2 class="mt-8 text-xl font-bold text-text">{{ t('legal.liability.title') }}</h2>
        <p class="mt-2 text-text/80" v-html="t('legal.liability.p1')" />
        <p class="mt-2 text-text/80" v-html="t('legal.liability.p2')" />
      </section>

      <section>
        <h2 class="mt-8 text-xl font-bold text-text">{{ t('legal.analytics.title') }}</h2>
        <p class="mt-2 text-text/80" v-html="t('legal.analytics.p1')" />
      </section>

      <section>
        <h2 class="mt-8 text-xl font-bold text-text">{{ t('legal.contact.title') }}</h2>
        <p class="mt-2 text-text/80">{{ t('legal.contact.text') }}</p>
      </section>

      <section>
        <p class="mt-8 text-sm text-text/60">{{ t('legal.lastUpdate') }} {{ lastUpdateDate }}</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t, locale } = useI18n()

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

const lastUpdateDate = computed(() =>
  new Date().toLocaleDateString(locale.value === 'fr' ? 'fr-FR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
)
</script>
