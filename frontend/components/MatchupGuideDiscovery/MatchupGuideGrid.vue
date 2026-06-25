<template>
  <div class="matchup-guide-grid">
    <div v-if="discoveryStore.loading" class="py-12 text-center text-text/70">
      {{ t('matchupGuideDiscovery.loading') }}
    </div>

    <div v-else-if="discoveryStore.loadError" class="py-12 text-center">
      <p class="text-lg text-red-400">{{ t('matchupGuideDiscovery.loadError') }}</p>
      <p class="mt-2 text-sm text-text/70">{{ discoveryStore.loadError }}</p>
    </div>

    <div v-else-if="guides.length === 0" class="py-12 text-center">
      <p class="text-lg text-text">{{ t('matchupGuideDiscovery.noGuidesFound') }}</p>
      <p class="mt-2 text-sm text-text/70">
        {{
          hasActiveFilters
            ? t('matchupGuideDiscovery.adjustFilters')
            : t('matchupGuideDiscovery.emptyState')
        }}
      </p>
    </div>

    <template v-else>
      <p class="mb-3 text-sm text-text-secondary">
        {{ guides.length }}
        {{
          guides.length === 1
            ? t('matchupGuideDiscovery.guideFound')
            : t('matchupGuideDiscovery.guidesFound')
        }}
      </p>

      <div class="matchup-guide-grid-list">
        <MatchupGuideCard v-for="guide in guides" :key="guide.id" :guide="guide" />
      </div>

      <div v-if="showPagination" class="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          class="pagination-btn disabled:opacity-50"
          :disabled="discoveryStore.currentPage <= 1"
          :aria-label="t('matchupGuideDiscovery.previousPage')"
          @click="discoveryStore.setPage(discoveryStore.currentPage - 1)"
        >
          ‹
        </button>
        <span class="text-sm text-text/80">
          {{
            t('matchupGuideDiscovery.pageXOfY', {
              current: discoveryStore.currentPage,
              total: discoveryStore.totalPages,
            })
          }}
        </span>
        <button
          type="button"
          class="pagination-btn disabled:opacity-50"
          :disabled="discoveryStore.currentPage >= discoveryStore.totalPages"
          :aria-label="t('matchupGuideDiscovery.nextPage')"
          @click="discoveryStore.setPage(discoveryStore.currentPage + 1)"
        >
          ›
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import MatchupGuideCard from '~/components/MatchupGuideDiscovery/MatchupGuideCard.vue'
import { useMatchupGuideDiscoveryStore } from '~/stores/MatchupGuideDiscoveryStore'

const { t } = useI18n()
const discoveryStore = useMatchupGuideDiscoveryStore()

const guides = computed(() => discoveryStore.paginatedGuides)
const hasActiveFilters = computed(() => discoveryStore.hasActiveFilters)
const showPagination = computed(() => discoveryStore.totalPages > 1)
</script>

<style scoped>
.matchup-guide-grid-list {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 0.85rem;
}

@media (min-width: 768px) {
  .matchup-guide-grid-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .matchup-guide-grid-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.pagination-btn {
  border-radius: 0.5rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.8);
  background: rgb(var(--rgb-background) / 0.25);
  padding: 0.45rem 0.85rem;
  font-size: 1rem;
  color: rgb(var(--rgb-text));
  transition: background-color 0.2s ease;
}

.pagination-btn:hover:not(:disabled) {
  background: rgb(var(--rgb-primary) / 0.2);
}
</style>
