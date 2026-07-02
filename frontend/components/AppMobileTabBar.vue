<template>
  <div class="mobile-tab-bar-shell">
    <div
      v-if="openSubmenuTabId"
      class="mobile-tab-bar-backdrop"
      aria-hidden="true"
      @click="closeSubmenu"
    />

    <div v-if="openSubmenuTabId" class="mobile-tab-bar-submenu" role="menu">
      <NuxtLink
        v-for="item in activeSubmenuItems"
        :key="item.id"
        :to="item.path"
        class="mobile-tab-bar-submenu__link"
        :class="{
          'mobile-tab-bar-submenu__link--active': isSubmenuItemActive(openSubmenuTabId, item.id),
        }"
        role="menuitem"
        @click="closeSubmenu"
      >
        <span>{{ t(item.labelKey) }}</span>
        <span v-if="item.badge" class="mobile-tab-bar__badge">{{ item.badge }}</span>
      </NuxtLink>
    </div>

    <nav
      class="mobile-tab-bar"
      :style="{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }"
      :aria-label="t('mobileTabBar.ariaLabel')"
    >
      <template v-for="tab in tabs" :key="tab.id">
        <button
          v-if="tab.hasSubmenu"
          type="button"
          class="mobile-tab-bar__item"
          :class="{
            'mobile-tab-bar__item--active': isTabActive(tab.id) || openSubmenuTabId === tab.id,
          }"
          :aria-expanded="openSubmenuTabId === tab.id"
          @click="toggleSubmenu(tab.id)"
        >
          <span class="mobile-tab-bar__icon-wrap" aria-hidden="true">
            <Icon :name="tab.icon" size="22" />
            <span v-if="tab.badge" class="mobile-tab-bar__badge">{{ tab.badge }}</span>
          </span>
          <span class="mobile-tab-bar__label">{{ t(tab.labelKey) }}</span>
        </button>

        <NuxtLink
          v-else
          :to="tab.path"
          class="mobile-tab-bar__item"
          :class="{ 'mobile-tab-bar__item--active': isTabActive(tab.id) }"
          :aria-current="isTabActive(tab.id) ? 'page' : undefined"
          @click="closeSubmenu"
        >
          <span class="mobile-tab-bar__icon-wrap" aria-hidden="true">
            <Icon :name="tab.icon" size="22" />
          </span>
          <span class="mobile-tab-bar__label">{{ t(tab.labelKey) }}</span>
        </NuxtLink>
      </template>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAppMobileTabBar } from '~/composables/useAppMobileTabBar'

const { t } = useI18n()
const {
  tabs,
  isTabActive,
  openSubmenuTabId,
  activeSubmenuItems,
  toggleSubmenu,
  closeSubmenu,
  isSubmenuItemActive,
} = useAppMobileTabBar()
</script>

<style scoped>
.mobile-tab-bar-shell {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 55;
}

.mobile-tab-bar-backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
  background: rgb(0 0 0 / 0.35);
}

.mobile-tab-bar-submenu {
  border-top: 1px solid rgb(var(--rgb-accent) / 0.22);
  background: rgb(8 16 31 / 0.98);
  backdrop-filter: blur(12px);
  padding: 0.5rem 0.75rem calc(0.35rem + env(safe-area-inset-bottom, 0px));
}

.mobile-tab-bar-submenu__link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-radius: 0.5rem;
  padding: 0.65rem 0.75rem;
  color: rgb(148 163 184 / 0.95);
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.mobile-tab-bar-submenu__link--active {
  background: rgb(var(--rgb-accent) / 0.14);
  color: var(--color-accent);
}

.mobile-tab-bar {
  display: grid;
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
  border: none;
  background: transparent;
  color: rgb(148 163 184 / 0.9);
  text-decoration: none;
  cursor: pointer;
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
