<template>
  <div class="build-shared min-h-screen p-4 text-text">
    <div class="mx-auto max-w-lg py-12 text-center">
      <p class="mb-2 text-text/90">Le partage de build par lien n’est plus disponible.</p>
      <p class="mb-6 text-sm text-text/70">
        Les builds ne sont plus enregistrés côté serveur. Utilisez les builds sauvegardés ou la page
        de découverte.
      </p>
      <NuxtLink
        :to="localePath('/builds')"
        class="inline-block rounded bg-primary px-6 py-2 text-white hover:bg-primary-dark"
      >
        Retour aux builds
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const localePath = useLocalePath()
</script>
