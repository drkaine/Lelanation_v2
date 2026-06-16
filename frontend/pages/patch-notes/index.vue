<template>
  <main class="min-h-screen bg-background px-4 py-8 text-text">
    <h1 class="text-xl font-bold text-accent">
      {{ t('patchNotesPage.title', { version: displayVersion }) }}
    </h1>
    <p class="mt-2 text-sm text-text/70">{{ t('patchNotesPage.loading') }}</p>
  </main>
</template>

<script setup lang="ts">
import { normalizePatchNotesVersion, usePatchNotesStore } from '~/stores/PatchNotesStore'

const localePath = useLocalePath()
const patchNotesStore = usePatchNotesStore()
const requestFetch = useRequestFetch()
const { locale, t } = useI18n()
const runtimeConfig = useRuntimeConfig()
const fallbackVersion = normalizePatchNotesVersion(
  String(runtimeConfig.public.fallbackGameVersion ?? '16.12')
)

const { data: latestVersion } = await useAsyncData(
  () => `patch-notes-index-redirect-${locale.value}`,
  async () => {
    await patchNotesStore.loadIndex(false, requestFetch)
    const fromIndex = patchNotesStore.index?.latest
    return fromIndex || fallbackVersion
  },
  { watch: [locale] }
)

const displayVersion = computed(() => latestVersion.value || fallbackVersion)

useSeoMeta({
  title: () => t('patchNotesPage.metaTitle', { version: displayVersion.value }),
  description: () => t('patchNotesPage.metaDescription', { version: displayVersion.value }),
})

if (latestVersion.value) {
  await navigateTo(localePath(`/patch-notes/${latestVersion.value}`), { redirectCode: 301 })
}
</script>
