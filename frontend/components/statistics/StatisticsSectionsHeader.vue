<template>
  <!-- En-tête + nav à 9 sections (maquette Redesign Statistiques) -->
  <header class="stats-head">
    <div class="stats-head-inner">
      <nav :aria-label="t('statisticsPage.navAria')" class="stats-nav">
        <template v-for="group in groups" :key="group.id">
          <NuxtLink
            v-if="group.route || linkTabs"
            :to="localePath(navGroupTarget(group))"
            :aria-current="currentGroupId === group.id ? 'page' : undefined"
            :class="['stats-nav-link', currentGroupId === group.id ? 'is-active' : '']"
          >
            {{ t(group.labelKey) }}
          </NuxtLink>
          <button
            v-else
            type="button"
            :aria-current="currentGroupId === group.id ? 'page' : undefined"
            :class="['stats-nav-link', currentGroupId === group.id ? 'is-active' : '']"
            @click="emit('select', group)"
          >
            {{ t(group.labelKey) }}
          </button>
        </template>
      </nav>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  navGroupTarget,
  type StatisticsNavGroup,
  type StatisticsNavGroupId,
} from '~/utils/statistics/statisticsNavGroups'

withDefaults(
  defineProps<{
    groups: readonly StatisticsNavGroup[]
    currentGroupId: StatisticsNavGroupId | null
    /** Hors page index : chaque section est un lien (`/statistics?tab=…`). */
    linkTabs?: boolean
  }>(),
  { linkTabs: false }
)

const emit = defineEmits<{ select: [group: StatisticsNavGroup] }>()

const { t } = useI18n()
const localePath = useLocalePath()
</script>

<style>
/* En-tête + nav sections (maquette Redesign Statistiques) */
.statistics .stats-head {
  border-bottom: 1px solid var(--color-gold-500);
  background: var(--color-blue-600);
}
.statistics .stats-head-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 8px 32px 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.statistics .stats-nav {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}
.statistics .stats-nav-link {
  padding: 12px 16px;
  font-weight: 500;
  color: var(--color-grey-50);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  background: none;
}
.statistics .stats-nav-link:hover {
  color: var(--color-gold-50);
}
.statistics .stats-nav-link.is-active {
  font-weight: 600;
  color: var(--color-gold-50);
  border-bottom-color: var(--color-gold-100);
}
@media (max-width: 767px) {
  .statistics .stats-head-inner {
    padding: 4px 16px 0;
    gap: 12px;
  }
  .statistics .stats-nav-link {
    padding: 10px 12px;
    font-size: 13px;
  }
}
</style>
