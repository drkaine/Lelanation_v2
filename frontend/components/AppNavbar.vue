<template>
  <header role="banner">
    <nav class="header">
      <div class="left-header">
        <NuxtLink to="/" class="link" :aria-label="t('nav.home')">
          <span>Lelanation</span>
        </NuxtLink>
      </div>
      <button
        class="menu-mobile"
        aria-label="Toggle menu"
        aria-controls="mobile-nav"
        :aria-expanded="String(isMenuOpen)"
        @click="toggleMenu"
      >
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

      <div id="mobile-nav" class="mobile-nav" :class="{ 'is-open': isMenuOpen }">
        <NuxtLink to="/builds" :title="t('nav.builds')" class="version" @click="toggleMenu">
          {{ t('nav.builds') }}
        </NuxtLink>
        <NuxtLink to="/videos" title="Vidéos" class="version" @click="toggleMenu">
          {{ t('nav.videos') }}
        </NuxtLink>
        <NuxtLink
          to="/builds/create"
          :title="t('nav.createBuild')"
          class="version"
          :aria-label="t('nav.createBuild')"
          @click="toggleMenu"
        >
          {{ t('nav.createBuild') }}
        </NuxtLink>
        <button class="version" type="button" @click="toggleLanguage">
          {{ t('nav.language') }}: {{ locale.toUpperCase() }}
        </button>
      </div>
      <div class="right-header">
        <NuxtLink to="/builds" :title="t('nav.builds')" class="version">
          {{ t('nav.builds') }}
        </NuxtLink>
        <NuxtLink to="/videos" :title="t('nav.videos')" class="version">
          {{ t('nav.videos') }}
        </NuxtLink>
        <NuxtLink :title="t('nav.createBuild')" class="version" to="/builds/create">
          {{ t('nav.createBuild') }}
        </NuxtLink>
        <button class="version" type="button" @click="toggleLanguage">
          {{ locale.toUpperCase() }}
        </button>
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const isMenuOpen = ref(false)
const { t, locale } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const toggleLanguage = () => {
  const next = locale.value === 'fr' ? 'en' : 'fr'
  navigateTo(switchLocalePath(next))
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
