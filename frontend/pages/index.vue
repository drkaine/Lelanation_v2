<template>
  <div class="home-page min-h-screen bg-background text-text">
    <!-- Hero Section -->
    <section class="from-primary/20 relative overflow-hidden bg-gradient-to-b to-background py-20">
      <div class="mx-auto max-w-7xl px-4">
        <div class="text-center">
          <h1 class="mb-6 text-5xl font-bold text-text md:text-6xl lg:text-7xl">Lelanation</h1>
          <p class="text-text/80 mx-auto mb-8 max-w-2xl text-xl md:text-2xl">
            La plateforme de référence pour créer, optimiser et partager vos builds League of
            Legends
          </p>
          <div class="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <NuxtLink
              to="/builds/create"
              class="rounded-lg bg-accent px-8 py-4 text-lg font-semibold text-background transition-colors hover:bg-accent-dark"
            >
              Créer un Build
            </NuxtLink>
            <NuxtLink
              to="/builds/discover"
              class="rounded-lg border-2 border-primary bg-surface px-8 py-4 text-lg font-semibold text-text transition-colors hover:bg-primary hover:text-white"
            >
              Découvrir des Builds
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="py-16">
      <div class="mx-auto max-w-7xl px-4">
        <h2 class="mb-12 text-center text-3xl font-bold text-text md:text-4xl">Fonctionnalités</h2>
        <div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <!-- Feature 1: Build Creator -->
          <div
            class="rounded-lg border-2 border-primary bg-surface p-6 transition-transform hover:scale-105"
          >
            <div class="mb-4 text-4xl">⚔️</div>
            <h3 class="mb-3 text-xl font-bold text-text">Créateur de Builds</h3>
            <p class="text-text/80">
              Créez des builds personnalisés avec calculs de statistiques en temps réel. Configurez
              items, runes, sorts d'invocateur et ordre de compétences.
            </p>
          </div>

          <!-- Feature 2: Build Discovery -->
          <div
            class="rounded-lg border-2 border-primary bg-surface p-6 transition-transform hover:scale-105"
          >
            <div class="mb-4 text-4xl">🔍</div>
            <h3 class="mb-3 text-xl font-bold text-text">Découverte de Builds</h3>
            <p class="text-text/80">
              Explorez et comparez les builds de la communauté. Filtrez par version, champion, rôle
              et triez par popularité.
            </p>
          </div>

          <!-- Feature 3: Statistics -->
          <div
            class="rounded-lg border-2 border-primary bg-surface p-6 transition-transform hover:scale-105"
          >
            <div class="mb-4 text-4xl">📊</div>
            <h3 class="mb-3 text-xl font-bold text-text">Statistiques Optimisées</h3>
            <p class="text-text/80">
              Visualisez les statistiques calculées de vos builds : AD, AP, armure, résistance
              magique, et bien plus.
            </p>
          </div>

          <!-- Feature 4: Data Sync -->
          <div
            class="rounded-lg border-2 border-primary bg-surface p-6 transition-transform hover:scale-105"
          >
            <div class="mb-4 text-4xl">🔄</div>
            <h3 class="mb-3 text-xl font-bold text-text">Synchronisation Automatique</h3>
            <p class="text-text/80">
              Données de jeu synchronisées quotidiennement avec l'API Data Dragon de Riot Games.
              Toujours à jour.
            </p>
          </div>

          <!-- Feature 5: Build Management -->
          <div
            class="rounded-lg border-2 border-primary bg-surface p-6 transition-transform hover:scale-105"
          >
            <div class="mb-4 text-4xl">💾</div>
            <h3 class="mb-3 text-xl font-bold text-text">Gestion de Builds</h3>
            <p class="text-text/80">
              Sauvegardez, modifiez et organisez vos builds. Accédez rapidement à vos configurations
              favorites.
            </p>
          </div>

          <!-- Feature 6: Community -->
          <div
            class="rounded-lg border-2 border-primary bg-surface p-6 transition-transform hover:scale-105"
          >
            <div class="mb-4 text-4xl">👥</div>
            <h3 class="mb-3 text-xl font-bold text-text">Communauté</h3>
            <p class="text-text/80">
              Partagez vos builds avec la communauté et découvrez les meilleures configurations pour
              chaque champion.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Quick Actions Section -->
    <section class="bg-surface py-16">
      <div class="mx-auto max-w-7xl px-4">
        <h2 class="mb-12 text-center text-3xl font-bold text-text md:text-4xl">Actions Rapides</h2>
        <div class="grid gap-6 md:grid-cols-3">
          <NuxtLink
            to="/builds/create"
            class="hover:bg-accent/10 group rounded-lg border-2 border-accent bg-background p-8 text-center transition-all hover:border-accent-dark"
          >
            <div class="mb-4 text-5xl">✨</div>
            <h3 class="mb-2 text-xl font-bold text-text">Créer un Build</h3>
            <p class="text-text/70">Commencez à créer votre build personnalisé</p>
          </NuxtLink>

          <NuxtLink
            to="/builds/discover"
            class="hover:bg-accent/10 group rounded-lg border-2 border-accent bg-background p-8 text-center transition-all hover:border-accent-dark"
          >
            <div class="mb-4 text-5xl">🌐</div>
            <h3 class="mb-2 text-xl font-bold text-text">Découvrir</h3>
            <p class="text-text/70">Explorez les builds de la communauté</p>
          </NuxtLink>

          <NuxtLink
            to="/builds"
            class="hover:bg-accent/10 group rounded-lg border-2 border-accent bg-background p-8 text-center transition-all hover:border-accent-dark"
          >
            <div class="mb-4 text-5xl">📁</div>
            <h3 class="mb-2 text-xl font-bold text-text">Mes Builds</h3>
            <p class="text-text/70">Accédez à vos builds sauvegardés</p>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="py-16">
      <div class="mx-auto max-w-4xl px-4 text-center">
        <h2 class="mb-6 text-3xl font-bold text-text md:text-4xl">
          Prêt à créer votre premier build ?
        </h2>
        <p class="text-text/80 mb-8 text-lg">
          Rejoignez la communauté Lelanation et partagez vos meilleures configurations
        </p>
        <NuxtLink
          to="/builds/create"
          class="inline-block rounded-lg bg-accent px-8 py-4 text-lg font-semibold text-background transition-colors hover:bg-accent-dark"
        >
          Commencer Maintenant
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Page d'accueil - Landing page pour Lelanation
// Aucune logique nécessaire pour l'instant
</script>
