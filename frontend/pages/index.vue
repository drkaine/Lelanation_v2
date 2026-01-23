<template>
  <div class="home-page min-h-screen text-text-primary">
    <!-- Hero Section -->
    <section class="profil pb-8 pt-4">
      <div class="mx-auto max-w-2xl px-2">
        <h1 class="title text-text-accent">Lelanation</h1>
        <img
          class="profil-image"
          src="/images/lelariva.png"
          alt="Lelanation - Plateforme de builds League of Legends"
          loading="lazy"
        />
        <h2 class="subtitle text-text-secondary">
          {{ t('home.subtitle') }}
        </h2>

        <!-- Social Links Section -->
        <div class="social-links-section mt-6">
          <div class="social-links">
            <a
              v-for="link in socialLinks"
              :key="link.href"
              class="social-link"
              :href="link.href"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon :name="link.icon" class="social-icon" size="22px" />
              <span class="social-text">{{ link.text }}</span>
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="py-16">
      <div class="mx-auto max-w-2xl px-2">
        <h2 class="mb-12 text-center text-3xl font-bold text-text-accent md:text-4xl">
          {{ t('home.features') }}
        </h2>
        <div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <!-- Feature 1: Build Creator -->
          <div
            class="rounded-lg border-2 border-primary bg-surface p-6 transition-transform hover:scale-105"
          >
            <div class="mb-4 text-4xl">⚔️</div>
            <h3 class="mb-3 text-xl font-bold text-text-primary">Créateur de Builds</h3>
            <p class="text-text-secondary">
              Créez des builds personnalisés avec calculs de statistiques en temps réel. Configurez
              items, runes, sorts d'invocateur et ordre de compétences.
            </p>
          </div>

          <!-- Feature 2: Build Discovery -->
          <div
            class="rounded-lg border-2 border-primary bg-surface p-6 transition-transform hover:scale-105"
          >
            <div class="mb-4 text-4xl">🔍</div>
            <h3 class="mb-3 text-xl font-bold text-text-primary">Découverte de Builds</h3>
            <p class="text-text-secondary">
              Explorez et comparez les builds de la communauté. Filtrez par version, champion, rôle
              et triez par popularité.
            </p>
          </div>

          <!-- Feature 3: Statistics -->
          <div
            class="rounded-lg border-2 border-primary bg-surface p-6 transition-transform hover:scale-105"
          >
            <div class="mb-4 text-4xl">📊</div>
            <h3 class="mb-3 text-xl font-bold text-text-primary">Statistiques Optimisées</h3>
            <p class="text-text-secondary">
              Visualisez les statistiques calculées de vos builds : AD, AP, armure, résistance
              magique, et bien plus.
            </p>
          </div>

          <!-- Feature 4: Data Sync -->
          <div
            class="rounded-lg border-2 border-primary bg-surface p-6 transition-transform hover:scale-105"
          >
            <div class="mb-4 text-4xl">🔄</div>
            <h3 class="mb-3 text-xl font-bold text-text-primary">Synchronisation Automatique</h3>
            <p class="text-text-secondary">
              Données de jeu synchronisées quotidiennement avec l'API Data Dragon de Riot Games.
              Toujours à jour.
            </p>
          </div>

          <!-- Feature 5: Build Management -->
          <div
            class="rounded-lg border-2 border-primary bg-surface p-6 transition-transform hover:scale-105"
          >
            <div class="mb-4 text-4xl">💾</div>
            <h3 class="mb-3 text-xl font-bold text-text-primary">Gestion de Builds</h3>
            <p class="text-text-secondary">
              Sauvegardez, modifiez et organisez vos builds. Accédez rapidement à vos configurations
              favorites.
            </p>
          </div>

          <!-- Feature 6: Community -->
          <div
            class="rounded-lg border-2 border-primary bg-surface p-6 transition-transform hover:scale-105"
          >
            <div class="mb-4 text-4xl">👥</div>
            <h3 class="mb-3 text-xl font-bold text-text-primary">Communauté</h3>
            <p class="text-text-secondary">
              Partagez vos builds avec la communauté et découvrez les meilleures configurations pour
              chaque champion.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Quick Actions Section -->
    <section class="py-16">
      <div class="mx-auto max-w-2xl px-2">
        <h2 class="mb-12 text-center text-3xl font-bold text-text-accent md:text-4xl">
          {{ t('home.quickActions') }}
        </h2>
        <div class="grid gap-6 md:grid-cols-3">
          <NuxtLink
            to="/builds/create"
            class="group rounded-lg border-2 border-accent p-8 text-center transition-all hover:border-accent-dark hover:bg-accent/10"
          >
            <div class="mb-4 text-5xl">✨</div>
            <h3 class="mb-2 text-xl font-bold text-text-primary">Créer un Build</h3>
            <p class="text-text-secondary">Commencez à créer votre build personnalisé</p>
          </NuxtLink>

          <NuxtLink
            to="/builds"
            class="group rounded-lg border-2 border-accent p-8 text-center transition-all hover:border-accent-dark hover:bg-accent/10"
          >
            <div class="mb-4 text-5xl">🌐</div>
            <h3 class="mb-2 text-xl font-bold text-text-primary">Les Builds</h3>
            <p class="text-text-secondary">Découvrez et gérez vos builds</p>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="py-16">
      <div class="mx-auto max-w-4xl px-4 text-center">
        <h2 class="mb-6 text-3xl font-bold text-text-accent md:text-4xl">
          {{ t('home.ctaTitle') }}
        </h2>
        <p class="mb-8 text-lg text-text-secondary">
          {{ t('home.ctaText') }}
        </p>
        <NuxtLink
          to="/builds/create"
          class="inline-block rounded-lg bg-accent px-8 py-4 text-lg font-semibold text-background transition-colors hover:bg-accent-dark"
        >
          {{ t('home.ctaButton') }}
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Page d'accueil - Landing page pour Lelanation
const { t } = useI18n()

interface SocialLink {
  href: string
  icon: string
  text: string
}

const socialLinks: SocialLink[] = [
  {
    href: 'https://discord.com/invite/RrXCpsFGrw',
    icon: 'mdi:discord',
    text: t('home.links.discord'),
  },
  {
    href: 'https://www.patreon.com/c/Lelariva/posts',
    icon: 'mdi:patreon',
    text: t('home.links.patreon'),
  },
  {
    href: 'https://www.youtube.com/@Lelariva_LoL/featured',
    icon: 'mdi:youtube',
    text: t('home.links.youtube'),
  },
  {
    href: 'https://www.twitch.tv/lelariva',
    icon: 'mdi:twitch',
    text: t('home.links.twitch'),
  },
  {
    href: 'https://x.com/Lelariva_fr',
    icon: 'mdi:twitter',
    text: t('home.links.twitter'),
  },
  {
    href: 'https://www.tiktok.com/@lelariva_fr',
    icon: 'mdi:music-note',
    text: t('home.links.tiktok'),
  },
  {
    href: 'https://www.lelariva.fr/',
    icon: 'mdi:web',
    text: t('home.links.website'),
  },
]

// Meta tags SEO
useHead({
  title: t('seo.homeTitle'),
  meta: [
    {
      name: 'description',
      content: t('seo.homeDescription'),
    },
    {
      property: 'og:title',
      content: t('seo.homeTitle'),
    },
    {
      property: 'og:description',
      content: t('seo.homeDescription'),
    },
    {
      property: 'og:url',
      content: 'https://lelanation.fr/',
    },
    {
      property: 'og:type',
      content: 'website',
    },
  ],
})
</script>

<style scoped>
.profil {
  text-align: center;
}

.title {
  margin-bottom: 1.5rem;
  font-size: 3rem;
  font-weight: 700;
}

@media (min-width: 768px) {
  .title {
    font-size: 3.75rem;
  }
}

@media (min-width: 1024px) {
  .title {
    font-size: 4.5rem;
  }
}

.profil-image {
  margin: 0 auto 2rem;
  width: 20rem;
  height: 20rem;
  object-fit: cover;
  border-radius: 50%;
  border: 3px solid var(--color-gold-300);
  box-shadow: 0 0 10px rgba(200, 155, 60, 0.3);
}

@media (max-width: 768px) {
  .profil-image {
    width: 15rem;
    height: 15rem;
  }
}

.subtitle {
  margin: 0 auto;
  max-width: 42rem;
  font-size: 1.25rem;
}

@media (min-width: 768px) {
  .subtitle {
    font-size: 1.5rem;
  }
}

.social-links-section {
  text-align: center;
  margin-top: 1.5rem;
}

.social-links {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
}

.social-link {
  font-family: var(--font-beaufort, ui-sans-serif, system-ui, sans-serif);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.8rem 1.5rem;
  border: var(--border-size, 2px) solid var(--color-gold-400);
  border-radius: 4px;
  color: var(--color-gold-200);
  text-decoration: none;
  transition: all 0.2s ease;
}

.social-link :deep(svg) {
  width: var(--title-sm, 1.25rem);
  height: var(--title-sm, 1.25rem);
}

.social-link:hover {
  background-color: var(--color-gold-500);
  transform: translateY(-2px);
}

.social-icon {
  color: currentColor;
}

.social-text {
  font-weight: 500;
}

@media (max-width: 600px) {
  .social-link {
    width: var(--width-all, 100%);
  }
}
</style>
