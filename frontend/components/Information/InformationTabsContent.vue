<!-- eslint-disable vue/no-v-html -- trusted i18n content from locale JSON -->
<template>
  <div class="information-tabs-content" :class="{ 'information-tabs-content--embedded': embedded }">
    <p
      v-if="embedded"
      class="max-w-5xl text-sm leading-relaxed text-text/80"
      v-html="t('information.intro')"
    />

    <div
      class="information-tabs-bar flex w-full shrink-0 items-start gap-2 overflow-x-hidden"
      :class="embedded ? 'pt-3' : 'bg-surface/30 px-3 pt-3 sm:px-5 lg:px-6'"
    >
      <nav
        class="flex w-full min-w-0 flex-wrap gap-1 border-b border-primary/30 pb-2"
        role="tablist"
        :aria-label="t('information.tabsAria')"
      >
        <button
          v-for="tab in infoTabs"
          :key="tab.id"
          type="button"
          role="tab"
          class="shrink-0 snap-start whitespace-nowrap rounded px-2.5 py-1.5 text-sm font-medium transition-colors lg:px-3"
          :class="
            activeTab === tab.id
              ? 'border border-accent/50 bg-accent/20 text-accent'
              : 'border border-transparent text-text/80 hover:bg-primary/10 hover:text-text'
          "
          :aria-selected="activeTab === tab.id"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <div
      class="w-full flex-1 space-y-4"
      :class="embedded ? 'py-3' : 'px-3 py-4 sm:px-5 lg:px-6 lg:py-6'"
    >
      <div v-show="activeTab === 'calculations'" class="grid w-full gap-4" role="tabpanel">
        <InfoSection :title="t('information.filters.title')">
          <p class="text-text/80" v-html="t('information.filters.p1')" />
          <p class="mt-3 text-text/80" v-html="t('information.filters.p2')" />
        </InfoSection>

        <InfoSection :title="t('information.ranks.title')">
          <p class="text-text/80" v-html="t('information.ranks.intro')" />
          <div class="mt-4 grid gap-3 lg:grid-cols-2">
            <MetricBlock
              :title="t('information.ranks.individual.title')"
              :definition="t('information.ranks.individual.definition')"
              :formula="t('information.ranks.individual.formula')"
              :example="t('information.ranks.individual.example')"
            />
            <MetricBlock
              :title="t('information.ranks.fallback.title')"
              :definition="t('information.ranks.fallback.definition')"
              :formula="t('information.ranks.fallback.formula')"
              :example="t('information.ranks.fallback.example')"
            />
          </div>
          <div class="mt-4 rounded-lg border border-primary/20 bg-surface/25 p-4">
            <h3 class="text-sm font-semibold text-text-accent">
              {{ t('information.ranks.filter.title') }}
            </h3>
            <p class="mt-2 text-sm text-text/80" v-html="t('information.ranks.filter.p1')" />
            <ul class="mt-3 list-inside list-disc space-y-2 text-sm text-text/80">
              <li v-html="t('information.ranks.filter.li1')" />
              <li v-html="t('information.ranks.filter.li2')" />
              <li v-html="t('information.ranks.filter.li3')" />
            </ul>
          </div>
        </InfoSection>

        <InfoSection :title="t('information.metrics.title')">
          <p class="mb-4 text-text/80">{{ t('information.metrics.intro') }}</p>
          <div class="grid gap-3 lg:grid-cols-2">
            <MetricBlock
              :title="t('information.metrics.winrate.title')"
              :definition="t('information.metrics.winrate.definition')"
              :formula="t('information.metrics.winrate.formula')"
              :example="t('information.metrics.winrate.example')"
            />
            <MetricBlock
              :title="t('information.metrics.pickrate.title')"
              :definition="t('information.metrics.pickrate.definition')"
              :formula="t('information.metrics.pickrate.formula')"
              :example="t('information.metrics.pickrate.example')"
            />
            <MetricBlock
              :title="t('information.metrics.banrate.title')"
              :definition="t('information.metrics.banrate.definition')"
              :formula="t('information.metrics.banrate.formula')"
              :example="t('information.metrics.banrate.example')"
            />
            <MetricBlock
              :title="t('information.metrics.presence.title')"
              :definition="t('information.metrics.presence.definition')"
              :formula="t('information.metrics.presence.formula')"
              :example="t('information.metrics.presence.example')"
            />
          </div>
        </InfoSection>

        <InfoSection :title="t('information.tierList.title')">
          <p class="text-text/80" v-html="t('information.tierList.intro')" />
          <div class="mt-4 grid gap-3 lg:grid-cols-2">
            <MetricBlock
              :title="t('information.tierList.tierScore.title')"
              :definition="t('information.tierList.tierScore.definition')"
              :formula="t('information.tierList.tierScore.formula')"
              :example="t('information.tierList.tierScore.example')"
            />
            <MetricBlock
              :title="t('information.tierList.pbi.title')"
              :definition="t('information.tierList.pbi.definition')"
              :formula="t('information.tierList.pbi.formula')"
              :example="t('information.tierList.pbi.example')"
            />
          </div>
        </InfoSection>

        <InfoSection :title="t('information.matchups.title')">
          <p class="text-text/80" v-html="t('information.matchups.intro')" />
          <div class="mt-4 grid gap-3 lg:grid-cols-2">
            <MetricBlock
              :title="t('information.matchups.delta.title')"
              :definition="t('information.matchups.delta.definition')"
              :formula="t('information.matchups.delta.formula')"
              :example="t('information.matchups.delta.example')"
            />
            <MetricBlock
              :title="t('information.matchups.score.title')"
              :definition="t('information.matchups.score.definition')"
              :formula="t('information.matchups.score.formula')"
              :example="t('information.matchups.score.example')"
            />
          </div>
        </InfoSection>

        <InfoSection :title="t('information.matchups.laneProfile.title')">
          <p class="text-text/80" v-html="t('information.matchups.laneProfile.intro')" />
          <p class="mt-3 text-text/80" v-html="t('information.matchups.laneProfile.method')" />
          <div class="mt-4 grid gap-3 lg:grid-cols-2">
            <MetricBlock
              :title="t('information.matchups.laneProfile.laneScore.title')"
              :definition="t('information.matchups.laneProfile.laneScore.definition')"
              :formula="t('information.matchups.laneProfile.laneScore.formula')"
              :example="t('information.matchups.laneProfile.laneScore.example')"
            />
            <MetricBlock
              :title="t('information.matchups.laneProfile.intensity.title')"
              :definition="t('information.matchups.laneProfile.intensity.definition')"
              :formula="t('information.matchups.laneProfile.intensity.formula')"
              :example="t('information.matchups.laneProfile.intensity.example')"
            />
          </div>
          <div class="mt-4 rounded-lg border border-primary/20 bg-surface/25 p-4">
            <h4 class="text-sm font-semibold text-text-accent">
              {{ t('information.matchups.laneProfile.intensity.thresholdsTitle') }}
            </h4>
            <ul class="mt-2 space-y-1.5 text-sm text-text/80">
              <li
                v-for="key in laneProfileIntensityThresholdKeys"
                :key="key"
                v-html="t(`information.matchups.laneProfile.intensity.thresholds.${key}`)"
              />
            </ul>
          </div>
          <h3 class="mt-6 text-sm font-semibold uppercase tracking-wide text-text/70">
            {{ t('information.matchups.laneProfile.signalsTitle') }}
          </h3>
          <p class="mt-2 text-sm text-text/75">
            {{ t('information.matchups.laneProfile.signalsIntro') }}
          </p>
          <div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <LaneSignalRow
              v-for="signal in laneProfileSignals"
              :key="signal.key"
              :short-label="signal.shortLabel"
              :title="signal.title"
              :detail="signal.detail"
            />
          </div>
          <div class="mt-6 rounded-lg border border-primary/20 bg-surface/25 p-4">
            <h4 class="text-sm font-semibold text-text-accent">
              {{ t('information.matchups.laneProfile.eventDetectionTitle') }}
            </h4>
            <p
              class="mt-2 text-sm text-text/75"
              v-html="t('information.matchups.laneProfile.eventDetectionIntro')"
            />
            <ul class="mt-3 space-y-2 text-sm text-text/80">
              <li
                v-for="key in laneProfileEventDetectionKeys"
                :key="key"
                v-html="t(`information.matchups.laneProfile.eventDetection.${key}`)"
              />
            </ul>
          </div>
        </InfoSection>
      </div>

      <div v-show="activeTab === 'builds'" class="grid w-full gap-4" role="tabpanel">
        <InfoSection :title="t('information.builds.visibility.title')">
          <p class="text-text/80" v-html="t('information.builds.visibility.p1')" />
          <ul class="mt-3 list-inside list-disc space-y-2 text-text/80">
            <li v-html="t('information.builds.visibility.public')" />
            <li v-html="t('information.builds.visibility.private')" />
            <li v-html="t('information.builds.visibility.votes')" />
          </ul>
          <p class="mt-3 text-text/80" v-html="t('information.builds.visibility.p2')" />
        </InfoSection>

        <InfoSection :title="t('information.builds.patchStale.title')">
          <p class="text-text/80" v-html="t('information.builds.patchStale.p1')" />
          <ul class="mt-3 list-inside list-disc space-y-2 text-text/80">
            <li v-html="t('information.builds.patchStale.li1')" />
            <li v-html="t('information.builds.patchStale.li2')" />
            <li v-html="t('information.builds.patchStale.li3')" />
          </ul>
          <p class="mt-3 text-text/80" v-html="t('information.builds.patchStale.p2')" />
          <p
            class="mt-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-text/70"
            v-html="t('information.builds.patchStale.note')"
          />
        </InfoSection>

        <InfoSection :title="t('information.builds.championRegions.title')">
          <p class="text-text/80" v-html="t('information.builds.championRegions.p1')" />
          <ul class="mt-3 list-inside list-disc space-y-2 text-text/80">
            <li v-html="t('information.builds.championRegions.li1')" />
            <li v-html="t('information.builds.championRegions.li2')" />
            <li v-html="t('information.builds.championRegions.li3')" />
          </ul>
          <p class="mt-3 text-text/80" v-html="t('information.builds.championRegions.p2')" />
        </InfoSection>
      </div>

      <div v-show="activeTab === 'surveillance'" class="grid w-full gap-4" role="tabpanel">
        <InfoSection :title="t('information.surveillance.title')">
          <p class="text-text/80" v-html="t('information.surveillance.p1')" />
          <p class="mt-3 text-text/80" v-html="t('information.surveillance.p2')" />
          <ul class="mt-3 list-inside list-disc space-y-2 text-text/80">
            <li v-html="t('information.surveillance.li1')" />
            <li v-html="t('information.surveillance.li2')" />
            <li v-html="t('information.surveillance.li3')" />
          </ul>
        </InfoSection>
      </div>

      <div v-show="activeTab === 'shortcuts'" class="grid w-full gap-4" role="tabpanel">
        <InfoSection :title="t('information.tabs.shortcuts')">
          <p class="text-text/80" v-html="t('information.shortcuts.intro')" />
        </InfoSection>

        <InfoSection :title="t('information.shortcuts.optionsTitle')">
          <div class="grid gap-3 lg:grid-cols-2">
            <ShortcutRow
              v-for="row in displayOptionShortcuts"
              :key="row.id"
              :keys="row.keys"
              :label="row.label"
              :description="row.description"
            />
          </div>
        </InfoSection>

        <InfoSection :title="t('information.shortcuts.navigationTitle')">
          <div class="grid gap-3 lg:grid-cols-2">
            <ShortcutRow
              v-for="row in navigationShortcuts"
              :key="row.id"
              :keys="row.keys"
              :label="row.label"
              :description="row.description"
            />
          </div>
          <p class="mt-4 text-xs text-text/55">{{ t('information.shortcuts.editableNote') }}</p>
        </InfoSection>
      </div>

      <div v-show="activeTab === 'data'" class="grid w-full gap-4" role="tabpanel">
        <InfoSection :title="t('information.data.title')">
          <p class="text-text/80" v-html="t('information.data.p1')" />
          <p class="mt-3 text-text/80">
            {{ t('information.data.p2') }}
            <NuxtLink
              :to="localePath('/legal')"
              class="text-accent underline hover:text-accent-dark"
            >
              {{ t('information.data.legalLink') }}
            </NuxtLink>
            .
          </p>
        </InfoSection>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import InfoSection from '~/components/Information/InfoSection.vue'
import LaneSignalRow from '~/components/Information/LaneSignalRow.vue'
import MetricBlock from '~/components/Information/MetricBlock.vue'
import ShortcutRow from '~/components/Information/ShortcutRow.vue'

withDefaults(
  defineProps<{
    /** Compact layout for embedding in settings (no duplicate page padding). */
    embedded?: boolean
  }>(),
  { embedded: false }
)

const LANE_PROFILE_SIGNAL_KEYS = [
  'early',
  'laneEconomy',
  'kills',
  'level',
  'cs',
  'vision',
  'items',
  'gank',
  'dive',
  'roam',
  'objectives',
  'pressure',
] as const

const LANE_PROFILE_INTENSITY_THRESHOLD_KEYS = [
  'bigPlus',
  'mediumPlus',
  'smallPlus',
  'even',
  'smallMinus',
  'mediumMinus',
  'bigMinus',
] as const

const LANE_PROFILE_EVENT_DETECTION_KEYS = ['gank', 'dive', 'roam', 'objectives'] as const

type InfoTabId = 'calculations' | 'builds' | 'surveillance' | 'shortcuts' | 'data'

type ShortcutRowData = {
  id: string
  keys: string
  label: string
  description?: string
}

const { t } = useI18n()
const localePath = useLocalePath()

const activeTab = ref<InfoTabId>('calculations')

const infoTabs = computed(() => [
  { id: 'calculations' as const, label: t('information.tabs.calculations') },
  { id: 'builds' as const, label: t('information.tabs.builds') },
  { id: 'surveillance' as const, label: t('information.tabs.surveillance') },
  { id: 'shortcuts' as const, label: t('information.tabs.shortcuts') },
  { id: 'data' as const, label: t('information.tabs.data') },
])

const displayOptionShortcuts = computed((): ShortcutRowData[] => [
  {
    id: 'open-modal',
    keys: 'Alt + H',
    label: t('commandBar.openShortcutsModal'),
    description: t('home.customizeShortcutOpenModal'),
  },
  {
    id: 'tooltips',
    keys: 'Alt + T',
    label: t('nav.disableTooltips'),
    description: t('home.customizeToolbarTooltips'),
  },
  {
    id: 'streamer',
    keys: 'Alt + P',
    label: t('footer.presentationMode'),
    description: t('home.customizeToolbarStreamer'),
  },
  {
    id: 'zoom',
    keys: 'Alt + Z',
    label: t('commandBar.presentationZoom'),
    description: t('home.customizeToolbarZoom'),
  },
  {
    id: 'splash',
    keys: 'Alt + S',
    label: t('commandBar.championSplash'),
    description: t('home.customizeToolbarSplash'),
  },
  {
    id: 'simplified',
    keys: 'Alt + C',
    label: t('commandBar.simplifiedStats'),
    description: t('home.customizeToolbarSimplified'),
  },
  {
    id: 'split-transform',
    keys: 'Shift + T',
    label: t('commandBar.splitTransformStats'),
    description: t('home.customizeToolbarSplitTransform'),
  },
])

const navigationShortcuts = computed((): ShortcutRowData[] => [
  {
    id: 'builder-prev',
    keys: 'Ctrl + ←',
    label: t('home.customizeShortcutBuilderPrev'),
    description: t('home.customizeShortcutBuilder'),
  },
  {
    id: 'builder-next',
    keys: 'Ctrl + →',
    label: t('home.customizeShortcutBuilderNext'),
    description: t('home.customizeShortcutBuilder'),
  },
  {
    id: 'stats-tabs',
    keys: 'Ctrl + ← / →',
    label: t('information.shortcuts.statsTabs'),
    description: t('information.shortcuts.statsTabsDesc'),
  },
  {
    id: 'champion-tabs',
    keys: 'Ctrl + ← / →',
    label: t('information.shortcuts.championTabs'),
    description: t('information.shortcuts.championTabsDesc'),
  },
  {
    id: 'item-tabs',
    keys: 'Ctrl + ← / →',
    label: t('information.shortcuts.itemTabs'),
    description: t('information.shortcuts.itemTabsDesc'),
  },
])

const laneProfileIntensityThresholdKeys = LANE_PROFILE_INTENSITY_THRESHOLD_KEYS
const laneProfileEventDetectionKeys = LANE_PROFILE_EVENT_DETECTION_KEYS

const laneProfileSignals = computed(() =>
  LANE_PROFILE_SIGNAL_KEYS.map(key => ({
    key,
    shortLabel: t(`statisticsPage.championMatchupDominanceShort.${key}`),
    title: t(`statisticsPage.championMatchupDominance.${key}`),
    detail: t(`statisticsPage.championMatchupDominanceDetail.${key}`),
  }))
)
</script>

<style scoped>
.information-tabs-content--embedded {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
</style>
