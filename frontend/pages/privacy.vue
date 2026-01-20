<template>
  <div class="min-h-screen p-4 text-text">
    <div class="mx-auto max-w-3xl">
      <h1 class="text-3xl font-bold text-text-accent">Confidentialité</h1>
      <p class="text-text/80 mt-4">
        Lelanation utilise le stockage local du navigateur (localStorage) pour sauvegarder vos
        builds et certaines préférences (ex: votes, consentement). Aucun compte n’est requis.
      </p>
      <h2 class="mt-8 text-xl font-bold text-text">Cookies</h2>
      <p class="text-text/80 mt-2">
        Nous n’utilisons pas de cookies non essentiels par défaut. Si des outils de mesure
        d’audience (ex: Matomo) sont ajoutés, ils seront soumis à votre consentement.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'Confidentialité - Lelanation',
  meta: [{ name: 'robots', content: 'index,follow' }],
})
</script>
