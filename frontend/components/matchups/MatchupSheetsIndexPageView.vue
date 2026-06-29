<template>
  <ShowIf :show-if="isAdmin">
    <div class="matchup-sheets-page min-h-screen px-[10px] pb-4 text-text">
      <div class="max-w-8xl mx-auto px-0">
        <div class="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <div class="scrollable-tabs-scroll-wrap min-w-0 max-w-full">
            <div class="matchup-sheets-tabs scrollable-tabs-nav">
              <button
                type="button"
                class="matchup-sheets-tab-button"
                :class="{ 'is-active': activeTab === 'discover' }"
                @click="setTab('discover')"
              >
                {{ t('buildsPage.discover') }}
              </button>
              <button
                v-if="myGuides.length > 0"
                type="button"
                class="matchup-sheets-tab-button"
                :class="{ 'is-active': activeTab === 'my-guides' }"
                @click="setTab('my-guides')"
              >
                {{ t('matchupGuidePage.myGuides') }}
              </button>
              <button
                v-if="favoriteGuides.length > 0"
                type="button"
                class="matchup-sheets-tab-button"
                :class="{ 'is-active': activeTab === 'favoris' }"
                @click="setTab('favoris')"
              >
                {{ t('buildsPage.myFavorites') }}
              </button>
              <button type="button" class="matchup-sheets-tab-button" @click="goToCreateGuide">
                {{ t('matchupGuidePage.createGuide') }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'discover'" class="tab-content">
          <div class="mb-3">
            <div class="flex flex-wrap items-center gap-2">
              <MatchupGuideSearch />
              <MatchupGuideFilters />
            </div>
          </div>
          <MatchupGuideGrid :show-favorite-toggle="true" />
        </div>

        <div v-if="activeTab === 'my-guides'" class="tab-content">
          <div class="mb-3">
            <div class="flex flex-wrap items-center gap-2">
              <MatchupGuideSearch />
              <MatchupGuideFilters />
            </div>
          </div>
          <MatchupGuideGrid :custom-guides="myGuides" :show-favorite-toggle="true" />
        </div>

        <div v-if="activeTab === 'favoris'" class="tab-content">
          <div class="mb-3">
            <div class="flex flex-wrap items-center gap-2">
              <MatchupGuideSearch />
              <MatchupGuideFilters />
            </div>
          </div>
          <MatchupGuideGrid :custom-guides="favoriteGuides" :show-favorite-toggle="true" />
        </div>
      </div>
    </div>
  </ShowIf>
</template>

<script setup lang="ts">
import ShowIf from '~/components/ShowIf.vue'
import MatchupGuideSearch from '~/components/MatchupGuideDiscovery/MatchupGuideSearch.vue'
import MatchupGuideFilters from '~/components/MatchupGuideDiscovery/MatchupGuideFilters.vue'
import MatchupGuideGrid from '~/components/MatchupGuideDiscovery/MatchupGuideGrid.vue'
import {
  useMatchupSheetsIndexPage,
  type MatchupSheetsTab,
} from '~/composables/useMatchupSheetsIndexPage'

const props = defineProps<{
  tab: MatchupSheetsTab
}>()

const { t, isAdmin, activeTab, myGuides, favoriteGuides, setTab, goToCreateGuide } =
  useMatchupSheetsIndexPage(props.tab)
</script>

<style scoped>
.matchup-sheets-page {
  padding-top: 10px;
}

.tab-content {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.matchup-sheets-tabs {
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border: 1px solid rgb(var(--rgb-accent) / 0.2);
  border-radius: 9999px;
  background: rgb(var(--rgb-background) / 0.22);
  padding: 0.2rem;
  max-width: 100%;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.matchup-sheets-tabs::-webkit-scrollbar {
  display: none;
}

.matchup-sheets-tab-button {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  scroll-snap-align: start;
  white-space: nowrap;
  border: none;
  border-radius: 9999px;
  background: transparent;
  min-height: 36px;
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.1;
  color: rgb(var(--rgb-text) / 0.75);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.matchup-sheets-tab-button.is-active {
  background: rgb(var(--rgb-accent) / 0.18);
  color: rgb(var(--rgb-text-accent));
}

.matchup-sheets-tab-button:hover {
  color: rgb(var(--rgb-text));
}
</style>
