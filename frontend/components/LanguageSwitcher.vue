<template>
  <div class="language-switcher">
    <select :value="locale" :aria-label="t('nav.language')" @change="onLocaleChange">
      <option value="fr">FR</option>
      <option value="en">EN</option>
    </select>
  </div>
</template>

<script setup lang="ts">
const { locale, setLocale, t } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const onLocaleChange = (e: Event) => {
  const next = (e.target as HTMLSelectElement | null)?.value as 'fr' | 'en'
  if (!next) return
  setLocale(next)
  navigateTo(switchLocalePath(next))
}
</script>

<style scoped>
.language-switcher select {
  height: 28px;
  width: 52px;
  appearance: none;
  border-radius: 6px;
  border: 1px solid var(--color-accent);
  background: #000;
  padding: 0 18px 0 8px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  color: var(--color-accent);
}

.language-switcher {
  position: relative;
  display: inline-flex;
}

.language-switcher::after {
  content: '▼';
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  font-size: 10px;
  color: color-mix(in srgb, var(--color-accent), transparent 20%);
}
</style>
