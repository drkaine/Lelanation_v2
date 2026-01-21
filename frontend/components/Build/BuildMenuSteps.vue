<template>
  <div class="menu-build" role="navigation" aria-label="Build steps">
    <a :class="linkClass('champion')" @click="go('champion')">
      {{ t('menu-build.champion') }}
    </a>
    <span class="arrow" aria-hidden="true"></span>
    <a :class="linkClass('rune')" @click="go('rune')">
      {{ t('menu-build.rune') }}
    </a>
    <span class="arrow" aria-hidden="true"></span>
    <a :class="linkClass('item')" @click="go('item')">
      {{ t('menu-build.item') }}
    </a>
    <span class="arrow" aria-hidden="true"></span>
    <a :class="[linkClass('info'), !hasChampion ? 'disabled' : '']" @click="go('info')">
      {{ t('menu-build.info') }}
    </a>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  currentStep: string
  hasChampion: boolean
}>()

const emit = defineEmits<{
  (e: 'navigate', step: 'champion' | 'runes' | 'items' | 'review'): void
}>()

const { t } = useI18n()

const stepMap = {
  champion: 'champion',
  rune: 'runes',
  item: 'items',
  info: 'review',
} as const

const isActive = (key: keyof typeof stepMap) => props.currentStep === stepMap[key]

const linkClass = (key: keyof typeof stepMap) => (isActive(key) ? 'active' : '')

const go = (key: keyof typeof stepMap) => {
  if (key === 'info' && !props.hasChampion) return
  emit('navigate', stepMap[key])
}
</script>

<style scoped>
.menu-build {
  font-family: var(--font-beaufort, ui-sans-serif, system-ui, sans-serif);
  align-items: center;
  user-select: none;
  font-size: var(--text-base, 1rem);
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem 0.5rem;
  justify-content: center;
}

.menu-build a {
  cursor: pointer;
  color: var(--color-blue-50);
  font-weight: 700;
  text-decoration: none;
}

.menu-build a.active {
  color: var(--color-accent);
}

.menu-build a.disabled {
  opacity: 0.45;
  pointer-events: none;
}

.menu-build .arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
}

.menu-build .arrow::before {
  content: '›';
  color: color-mix(in srgb, var(--color-accent), transparent 35%);
  font-weight: 900;
}

@media (hover: hover) {
  .menu-build a:hover {
    text-decoration: underline;
  }
}

@media (max-width: 768px) {
  .menu-build {
    width: var(--width-all, 100%);
    gap: 0.25rem;
    padding: 0.5rem;
  }
}

@media (max-width: 500px) {
  .menu-build .arrow {
    margin: 0 0.4em;
  }
}
</style>
