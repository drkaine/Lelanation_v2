<template>
  <div />
</template>

<script setup lang="ts">
const localePath = useLocalePath()
const patchNotesStore = usePatchNotesStore()
const { locale } = useI18n()

await useAsyncData(
  () => `patch-notes-index-redirect-${locale.value}`,
  async () => {
    await patchNotesStore.loadIndex()
    const latest = patchNotesStore.latestVersion
    if (!latest) return null
    await navigateTo(localePath(`/patch-notes/${latest}`), { redirectCode: 301 })
    return latest
  },
  { watch: [locale] }
)
</script>
