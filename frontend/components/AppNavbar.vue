<template>
  <header role="banner">
    <nav class="header">
      <div class="left-header">
        <NuxtLink to="/" class="link" aria-label="Accueil">
          <span>Lelanation</span>
        </NuxtLink>
      </div>
      <button class="menu-mobile" aria-label="Toggle menu" @click="toggleMenu">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M4 6l16 0"></path>
          <path d="M4 12l16 0"></path>
          <path d="M4 18l16 0"></path>
        </svg>
      </button>

      <div class="mobile-nav" :class="{ 'is-open': isMenuOpen }">
        <NuxtLink
          to="/builds/discover"
          title="Découvrir des builds"
          class="version"
          @click="toggleMenu"
        >
          Découvrir
        </NuxtLink>
        <NuxtLink
          to="/builds/create"
          title="Créer un build"
          class="version"
          aria-label="Créer un build"
          @click="toggleMenu"
        >
          Créer un Build
        </NuxtLink>
        <NuxtLink to="/builds" title="Mes builds" class="version" @click="toggleMenu">
          Mes Builds
        </NuxtLink>
      </div>
      <div class="right-header">
        <NuxtLink to="/builds/discover" title="Découvrir" class="version"> Découvrir </NuxtLink>
        <NuxtLink title="Créer un Build" class="version" to="/builds/create">
          Créer un Build
        </NuxtLink>
        <NuxtLink title="Mes builds" class="version" to="/builds"> Mes Builds </NuxtLink>
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const isMenuOpen = ref(false)

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}
</script>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  width: 100%;
  height: 4rem;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2px solid var(--color-primary);
  padding: 0 1rem;
  backdrop-filter: blur(8px);
  background: transparent;
}

.left-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.right-header {
  display: none;
  align-items: center;
  gap: 1rem;
}

@media (min-width: 768px) {
  .right-header {
    display: flex;
  }
}

.link {
  color: var(--color-text-accent);
  font-weight: 700;
  transition: color 0.2s;
  text-decoration: none;
}

.link:hover {
  color: var(--color-accent-light);
}

.version {
  color: var(--color-text-primary);
  transition: color 0.2s;
  text-decoration: none;
}

.version:hover {
  color: var(--color-accent);
}

.menu-mobile {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-primary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  transition: color 0.2s;
}

.menu-mobile:hover {
  color: var(--color-accent);
}

@media (min-width: 768px) {
  .menu-mobile {
    display: none;
  }
}

.mobile-nav {
  position: fixed;
  left: 0;
  top: 4rem;
  z-index: 40;
  width: 100%;
  border-bottom: 2px solid var(--color-primary);
  background: transparent;
  transition:
    max-height 0.3s ease-in-out,
    padding 0.3s ease-in-out;
  max-height: 0;
  overflow: hidden;
  padding: 0 1rem;
}

.mobile-nav.is-open {
  max-height: 100vh;
  padding: 1rem;
}

.mobile-nav .version {
  display: block;
  padding: 0.75rem 0;
  font-size: 1.125rem;
}

.mobile-nav .version:not(:last-child) {
  border-bottom: 1px solid rgba(10, 50, 60, 0.3);
}
</style>
