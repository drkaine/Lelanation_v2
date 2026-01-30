<template>
  <header role="banner">
    <nav class="header">
      <div class="left-header">
        <LanguageSwitcher />
        <NuxtLink :to="localePath('/')" class="link" :aria-label="t('nav.home')">
          <span>Lelariva</span>
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
          :to="localePath('/videos')"
          :title="t('nav.videos')"
          class="version"
          @click="toggleMenu"
        >
          {{ t('nav.videos') }}
        </NuxtLink>
        <NuxtLink
          :to="localePath('/builds/create')"
          :title="t('nav.build')"
          class="version"
          @click="toggleMenu"
        >
          {{ t('nav.build') }}
        </NuxtLink>
        <NuxtLink
          :to="localePath('/builds')"
          :title="t('nav.builds')"
          class="version"
          @click="toggleMenu"
        >
          {{ t('nav.builds') }}
        </NuxtLink>
        <a
          :href="patchNotesUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="version"
          @click="toggleMenu"
        >
          {{ gameVersion }}
        </a>
      </div>

      <div class="right-header">
        <NuxtLink :to="localePath('/builds')" :title="t('nav.builds')" class="version">
          {{ t('nav.builds') }}
        </NuxtLink>
        <NuxtLink :to="localePath('/builds/create')" :title="t('nav.build')" class="version">
          {{ t('nav.build') }}
        </NuxtLink>
        <NuxtLink :to="localePath('/videos')" :title="t('nav.videos')" class="version">
          {{ t('nav.videos') }}
        </NuxtLink>
        <a
          :href="patchNotesUrl"
          title="Patch Notes"
          target="_blank"
          rel="noopener noreferrer"
          class="link"
        >
          {{ gameVersion }}
        </a>
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import LanguageSwitcher from '~/components/LanguageSwitcher.vue'
import { useVersionStore } from '~/stores/VersionStore'

const isMenuOpen = ref(false)
const { t, locale } = useI18n()
const localePath = useLocalePath()
const versionStore = useVersionStore()
const gameVersion = computed(() => versionStore.currentVersion || '14.1.1')

// Map i18n locale to Riot Games locale code
const getRiotLocale = (locale: string): string => {
  const localeMap: Record<string, string> = {
    fr: 'fr-fr',
    en: 'en-us',
    // Add more locales as needed
  }
  return localeMap[locale] || 'en-us'
}

const patchNotesUrl = computed(() => {
  const riotLocale = getRiotLocale(locale.value)
  // DataDragon-like version (ex: 16.1.1) maps to patch notes (ex: 26.1)
  const v = String(gameVersion.value || '').trim()
  const parts = v.match(/\d+/g) ?? []
  const gameMajor = Number(parts[0] ?? NaN)
  const gameMinor = Number(parts[1] ?? NaN)

  if (Number.isFinite(gameMajor) && Number.isFinite(gameMinor)) {
    const patchMajor = gameMajor + 10
    return `https://www.leagueoflegends.com/${riotLocale}/news/game-updates/patch-${patchMajor}-${gameMinor}-notes/`
  }

  // Fallback: best-effort formatting
  const slug = v.replace(/\./g, '-')
  return `https://www.leagueoflegends.com/${riotLocale}/news/game-updates/patch-${slug}-notes/`
})

onMounted(() => {
  if (!versionStore.currentVersion && versionStore.status === 'idle') {
    versionStore.loadCurrentVersion()
  }
})

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
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 15px;
  backdrop-filter: blur(10px);
  background: color-mix(in srgb, var(--color-blue-600), transparent 65%);
}

.left-header .link {
  color: var(--color-accent);
}

.left-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.right-header {
  text-align: right;
  display: flex;
  align-items: center;
  gap: 18px;
}

.header a {
  color: var(--color-blue-50);
  font-weight: 600;
  text-decoration: none;
}

.header a.router-link-active,
.header a.router-link-exact-active {
  color: var(--color-accent);
}

.link {
  color: var(--color-blue-50);
}

.version {
  color: var(--color-blue-50);
}

.menu-mobile {
  display: none;
  cursor: pointer;
  border: none;
  background: none;
  color: var(--color-blue-50);
}

.mobile-nav {
  display: none;
  position: absolute;
  top: 64px;
  left: 0;
  right: 0;
  background: var(--gradient-secondary);
  padding: 14px 15px;
  flex-direction: column;
  gap: 12px;
}

.mobile-nav.is-open {
  display: flex !important;
  z-index: 1000;
}

.mobile-nav a {
  color: var(--color-blue-50);
  padding: 6px 8px;
  display: block;
}

@media (hover: hover) {
  .header a:hover {
    text-decoration: underline;
  }
}

@media (max-width: 700px) {
  .menu-mobile {
    display: block;
  }

  .right-header {
    display: none;
  }
}
</style>
