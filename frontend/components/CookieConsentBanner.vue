<template>
  <div
    v-if="shouldShow"
    class="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-accent p-4 text-text"
    style="background-color: var(--color-surface); opacity: 1"
    role="dialog"
    aria-label="Cookie consent"
  >
    <div
      class="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between"
    >
      <div>
        <p class="text-sm font-semibold text-text-accent">{{ t('cookies.title') }}</p>
        <p class="mt-1 text-sm text-text/80">
          {{ t('cookies.text') }}
          <NuxtLink
            :to="localePath('/privacy')"
            class="ml-2 font-semibold text-accent hover:text-accent-dark"
          >
            {{ t('cookies.learnMore') }}
          </NuxtLink>
        </p>
      </div>
      <div class="flex gap-2">
        <button
          class="rounded-lg border border-accent/70 bg-surface px-4 py-2 text-sm text-text transition-colors hover:bg-accent/10"
          @click="reject"
        >
          {{ t('cookies.reject') }}
        </button>
        <button
          class="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-dark"
          @click="accept"
        >
          {{ t('cookies.accept') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCookieConsentStore } from '~/stores/CookieConsentStore'

const { t } = useI18n()
const consent = useCookieConsentStore()
const localePath = useLocalePath()

const shouldShow = computed(() => consent.choice === 'unknown')

const accept = () => consent.accept()
const reject = () => consent.reject()

onMounted(() => consent.load())
</script>
