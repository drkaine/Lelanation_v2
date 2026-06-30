<template>
  <nav class="mobile-tab-bar" :aria-label="t('mobileTabBar.ariaLabel')">
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.id"
      :to="tab.path"
      class="mobile-tab-bar__item"
      :class="{ 'mobile-tab-bar__item--active': isTabActive(tab.id) }"
      :aria-current="isTabActive(tab.id) ? 'page' : undefined"
    >
      <span class="mobile-tab-bar__icon-wrap" aria-hidden="true">
        <Icon :name="tab.icon" size="22" />
        <span v-if="tab.badge" class="mobile-tab-bar__badge">{{ tab.badge }}</span>
      </span>
      <span class="mobile-tab-bar__label">{{ t(tab.labelKey) }}</span>
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAppMobileTabBar } from '~/composables/useAppMobileTabBar'

const { t } = useI18n()
const { tabs, isTabActive } = useAppMobileTabBar()
</script>

<style scoped>
.mobile-tab-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 55;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0;
  height: var(--app-mobile-tab-bar-height, 3.5rem);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  border-top: 1px solid rgb(var(--rgb-accent) / 0.22);
  background: rgb(8 16 31 / 0.97);
  backdrop-filter: blur(12px);
}

.mobile-tab-bar__item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  padding: 0.35rem 0.15rem 0.2rem;
  color: rgb(148 163 184 / 0.9);
  text-decoration: none;
  transition: color 0.15s ease;
}

.mobile-tab-bar__item--active {
  color: var(--color-accent);
}

.mobile-tab-bar__icon-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.mobile-tab-bar__badge {
  position: absolute;
  top: -0.35rem;
  right: -0.55rem;
  display: inline-flex;
  min-width: 0.95rem;
  height: 0.95rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: #dc2626;
  color: #fff;
  font-size: 0.58rem;
  font-weight: 700;
  line-height: 1;
  padding: 0 0.2rem;
}

.mobile-tab-bar__label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1.1;
}
</style>
