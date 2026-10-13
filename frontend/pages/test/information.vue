<!-- eslint-disable vue/no-v-html -- trusted i18n content from locale JSON -->
<template>
  <div class="ig-page text-text">
    <header class="ig-hero">
      <div class="ig-hero-inner">
        <p class="ig-eyebrow">
          <Icon name="mdi:information-outline" size="16px" />
          {{ t('informationTest.eyebrow') }}
        </p>
        <h1 class="ig-title">{{ t('information.title') }}</h1>
        <p class="ig-subtitle">{{ t('informationTest.subtitle') }}</p>
        <p class="ig-intro" v-html="t('information.intro')" />
      </div>
      <nav class="ig-tabs" role="tablist" :aria-label="t('information.tabsAria')">
        <button
          v-for="tab in INFO_TABS"
          :key="tab.id"
          type="button"
          role="tab"
          class="ig-tab"
          :class="{ 'is-active': activeTab === tab.id }"
          :aria-selected="activeTab === tab.id"
          @click="selectTab(tab.id)"
        >
          <Icon :name="tab.icon" size="18px" aria-hidden="true" />
          {{ t(tab.labelKey) }}
        </button>
      </nav>
    </header>

    <div class="ig-container">
      <nav class="ig-toc" :aria-label="t('informationTest.toc')">
        <p class="ig-toc-title">{{ t('informationTest.toc') }}</p>
        <p class="ig-toc-intro">{{ t(`informationTest.tabIntro.${activeTab}`) }}</p>
        <ol>
          <li v-for="entry in toc" :key="entry.anchor">
            <a :href="`#${entry.anchor}`" class="ig-toc-link">
              <span class="ig-toc-index">{{ entry.index }}</span>
              {{ t(entry.titleKey) }}
            </a>
          </li>
        </ol>
      </nav>

      <div class="ig-sections" role="tabpanel">
        <section
          v-for="entry in tocWithKeys"
          :id="entry.anchor"
          :key="entry.key"
          class="ig-section"
        >
          <h2 class="ig-h2">
            <span class="ig-h2-index">{{ entry.index }}</span>
            <Icon :name="entry.icon" size="22px" class="ig-h2-icon" />
            {{ t(entry.titleKey) }}
          </h2>

          <div class="ig-body">
            <template v-if="entry.key === 'filters'">
              <p v-html="t('information.filters.p1')" />
              <p v-html="t('information.filters.p2')" />
            </template>

            <template v-else-if="entry.key === 'ranks'">
              <p v-html="t('information.ranks.intro')" />
              <div class="ig-grid">
                <InfoGamingMetric prefix="information.ranks.individual" />
                <InfoGamingMetric prefix="information.ranks.fallback" />
              </div>
              <div class="ig-box">
                <h3 class="ig-h3">{{ t('information.ranks.filter.title') }}</h3>
                <p v-html="t('information.ranks.filter.p1')" />
                <ul class="ig-list">
                  <li v-for="i in 3" :key="i" v-html="t(`information.ranks.filter.li${i}`)" />
                </ul>
              </div>
            </template>

            <template v-else-if="entry.key === 'metrics'">
              <p>{{ t('information.metrics.intro') }}</p>
              <div class="ig-grid">
                <InfoGamingMetric
                  v-for="m in ['winrate', 'pickrate', 'banrate', 'presence']"
                  :key="m"
                  :prefix="`information.metrics.${m}`"
                />
              </div>
            </template>

            <template v-else-if="entry.key === 'tierList'">
              <p v-html="t('information.tierList.intro')" />
              <div class="ig-grid">
                <InfoGamingMetric prefix="information.tierList.tierScore" />
                <InfoGamingMetric prefix="information.tierList.pbi" />
              </div>
            </template>

            <template v-else-if="entry.key === 'matchups'">
              <p v-html="t('information.matchups.intro')" />
              <div class="ig-grid">
                <InfoGamingMetric prefix="information.matchups.delta" />
                <InfoGamingMetric prefix="information.matchups.score" />
              </div>
            </template>

            <template v-else-if="entry.key === 'laneProfile'">
              <p v-html="t('information.matchups.laneProfile.intro')" />
              <p v-html="t('information.matchups.laneProfile.method')" />
              <div class="ig-grid">
                <InfoGamingMetric prefix="information.matchups.laneProfile.laneScore" />
                <InfoGamingMetric prefix="information.matchups.laneProfile.intensity" />
              </div>
              <div class="ig-box">
                <h3 class="ig-h3">
                  {{ t('information.matchups.laneProfile.intensity.thresholdsTitle') }}
                </h3>
                <ul class="ig-list">
                  <li
                    v-for="key in INTENSITY_THRESHOLD_KEYS"
                    :key="key"
                    v-html="t(`information.matchups.laneProfile.intensity.thresholds.${key}`)"
                  />
                </ul>
              </div>
              <h3 class="ig-h3">{{ t('information.matchups.laneProfile.signalsTitle') }}</h3>
              <p>{{ t('information.matchups.laneProfile.signalsIntro') }}</p>
              <div class="ig-signals">
                <div v-for="key in SIGNAL_KEYS" :key="key" class="ig-signal">
                  <span class="ig-chip">
                    {{ t(`statisticsPage.championMatchupDominanceShort.${key}`) }}
                  </span>
                  <strong>{{ t(`statisticsPage.championMatchupDominance.${key}`) }}</strong>
                  <p>{{ t(`statisticsPage.championMatchupDominanceDetail.${key}`) }}</p>
                </div>
              </div>
              <div class="ig-box">
                <h3 class="ig-h3">
                  {{ t('information.matchups.laneProfile.eventDetectionTitle') }}
                </h3>
                <p v-html="t('information.matchups.laneProfile.eventDetectionIntro')" />
                <ul class="ig-list">
                  <li
                    v-for="key in EVENT_DETECTION_KEYS"
                    :key="key"
                    v-html="t(`information.matchups.laneProfile.eventDetection.${key}`)"
                  />
                </ul>
              </div>
            </template>

            <template v-else-if="entry.key === 'visibility'">
              <p v-html="t('information.builds.visibility.p1')" />
              <ul class="ig-list">
                <li
                  v-for="k in ['public', 'private', 'votes']"
                  :key="k"
                  v-html="t(`information.builds.visibility.${k}`)"
                />
              </ul>
              <p v-html="t('information.builds.visibility.p2')" />
            </template>

            <template v-else-if="entry.key === 'patchStale' || entry.key === 'championRegions'">
              <p v-html="t(`information.builds.${entry.key}.p1`)" />
              <ul class="ig-list">
                <li v-for="i in 3" :key="i" v-html="t(`information.builds.${entry.key}.li${i}`)" />
              </ul>
              <p v-html="t(`information.builds.${entry.key}.p2`)" />
              <p
                v-if="entry.key === 'patchStale'"
                class="ig-warning"
                v-html="t('information.builds.patchStale.note')"
              />
            </template>

            <template v-else-if="entry.key === 'surveillance'">
              <p v-html="t('information.surveillance.p1')" />
              <p v-html="t('information.surveillance.p2')" />
              <ul class="ig-list">
                <li v-for="i in 3" :key="i" v-html="t(`information.surveillance.li${i}`)" />
              </ul>
            </template>

            <template v-else-if="entry.key === 'shortcutsIntro'">
              <p v-html="t('information.shortcuts.intro')" />
            </template>

            <template
              v-else-if="entry.key === 'shortcutOptions' || entry.key === 'shortcutNavigation'"
            >
              <div class="ig-grid">
                <div
                  v-for="row in entry.key === 'shortcutOptions'
                    ? displayOptionShortcuts
                    : navigationShortcuts"
                  :key="row.id"
                  class="ig-shortcut"
                >
                  <div class="ig-shortcut-head">
                    <span>{{ row.label }}</span>
                    <kbd class="ig-kbd">{{ row.keys }}</kbd>
                  </div>
                  <p>{{ row.description }}</p>
                </div>
              </div>
              <p v-if="entry.key === 'shortcutNavigation'" class="ig-note">
                {{ t('information.shortcuts.editableNote') }}
              </p>
            </template>

            <template v-else-if="entry.key === 'data'">
              <p v-html="t('information.data.p1')" />
              <p>{{ t('information.data.p2') }}</p>
              <NuxtLink :to="localePath('/legal')" class="ig-link">
                <Icon name="mdi:arrow-right" size="16px" />
                {{ t('information.data.legalLink') }}
              </NuxtLink>
            </template>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import InfoGamingMetric from '~/components/Information/InfoGamingMetric.vue'
import { INFO_TABS, infoTabFromQuery, infoToc, type InfoTabId } from '~/utils/informationGaming'

const SIGNAL_KEYS = [
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

const INTENSITY_THRESHOLD_KEYS = [
  'bigPlus',
  'mediumPlus',
  'smallPlus',
  'even',
  'smallMinus',
  'mediumMinus',
  'bigMinus',
] as const

const EVENT_DETECTION_KEYS = ['gank', 'dive', 'roam', 'objectives'] as const

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()

const activeTab = computed(() => infoTabFromQuery(route.query.tab))
const toc = computed(() => infoToc(activeTab.value))
const tocWithKeys = computed(() => {
  const sections = INFO_TABS.find(tab => tab.id === activeTab.value)!.sections
  return toc.value.map((entry, i) => ({ ...entry, key: sections[i]!.key }))
})

function selectTab(id: InfoTabId) {
  const query = { ...route.query }
  if (id === 'calculations') delete query.tab
  else query.tab = id
  router.replace({ query })
}

const displayOptionShortcuts = computed(() => [
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

const navigationShortcuts = computed(() => [
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

useHead({
  title: () => t('information.metaTitle'),
  meta: [{ name: 'robots', content: 'noindex,nofollow' }],
})
</script>

<style scoped>
/* Couleurs : uniquement les tokens du site (même langage que /legal et la home). */
.ig-page {
  width: 100%;
  padding-bottom: 3rem;
}

.ig-hero {
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid rgb(var(--rgb-accent) / 0.3);
  background:
    radial-gradient(ellipse at 85% 0%, rgb(var(--rgb-accent) / 0.14), transparent 60%),
    var(--color-blue-600);
}

.ig-hero-inner {
  padding: 3rem 16px 1.5rem;
}

.ig-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: rgb(var(--rgb-accent) / 0.75);
}

.ig-title {
  margin-top: 0.35rem;
  font-size: clamp(2rem, 5vw, 3.75rem);
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--color-text-accent);
  text-shadow: 0 4px 24px rgb(0 0 0 / 0.5);
}

.ig-subtitle {
  margin-top: 0.75rem;
  max-width: 40rem;
  font-size: 1.05rem;
  color: rgb(var(--rgb-text) / 0.8);
}

.ig-intro {
  margin-top: 0.75rem;
  max-width: 52rem;
  font-size: 0.9rem;
  line-height: 1.6;
  color: rgb(var(--rgb-text) / 0.65);
}

.ig-tabs {
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  padding: 0 16px;
  scrollbar-width: none;
}

.ig-tab {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 0.6rem 0.6rem 0 0;
  padding: 0.65rem 1rem;
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgb(var(--rgb-text) / 0.65);
  transition:
    color 0.15s,
    background 0.15s;
}

.ig-tab:hover {
  color: var(--color-text);
  background: rgb(var(--rgb-accent) / 0.08);
}

.ig-tab.is-active {
  border-color: rgb(var(--rgb-accent) / 0.35);
  background: var(--color-background, rgb(var(--rgb-chrome)));
  color: var(--color-accent);
  box-shadow: inset 0 2px 0 var(--color-accent);
}

@media (min-width: 640px) {
  .ig-hero-inner {
    padding-inline: 2rem;
  }

  .ig-tabs {
    padding-inline: 2rem;
  }
}

.ig-container {
  display: grid;
  gap: 2rem;
  padding: 2rem 16px 0;
}

@media (min-width: 640px) {
  .ig-container {
    padding-inline: 2rem;
  }
}

@media (min-width: 1024px) {
  .ig-container {
    grid-template-columns: 16rem minmax(0, 1fr);
  }
}

.ig-toc {
  align-self: start;
  border: 1px solid rgb(var(--rgb-accent) / 0.25);
  border-radius: 0.75rem;
  background: rgb(var(--rgb-chrome) / 0.6);
  padding: 1rem;
}

@media (min-width: 1024px) {
  .ig-toc {
    position: sticky;
    top: 5rem;
  }
}

.ig-toc-title {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgb(var(--rgb-text) / 0.6);
}

.ig-toc-intro {
  margin: 0.4rem 0 0.6rem;
  font-size: 0.8rem;
  color: rgb(var(--rgb-text) / 0.6);
}

.ig-toc-link {
  display: flex;
  gap: 0.6rem;
  border-radius: 0.375rem;
  padding: 0.35rem 0.5rem;
  font-size: 0.85rem;
  color: rgb(var(--rgb-text) / 0.8);
  transition: background 0.15s;
}

.ig-toc-link:hover {
  background: rgb(var(--rgb-accent) / 0.12);
  color: var(--color-text);
}

.ig-toc-index {
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  color: var(--color-accent);
}

.ig-sections {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1.25rem;
}

.ig-section {
  scroll-margin-top: 5rem;
  border: 1px solid rgb(var(--rgb-accent) / 0.18);
  border-radius: 0.75rem;
  background: rgb(var(--rgb-chrome) / 0.45);
  padding: 1.25rem;
}

@media (min-width: 640px) {
  .ig-section {
    padding: 1.5rem 1.75rem;
  }
}

.ig-h2 {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1.2rem;
  font-weight: 900;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-accent);
}

.ig-h2-index {
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  color: rgb(var(--rgb-accent) / 0.7);
}

.ig-h2-icon {
  color: var(--color-accent);
}

.ig-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.85rem;
  line-height: 1.65;
  color: rgb(var(--rgb-text) / 0.82);
}

.ig-h3 {
  font-weight: 800;
  color: var(--color-text);
}

.ig-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  gap: 0.75rem;
}

.ig-box {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border: 1px solid rgb(var(--rgb-accent) / 0.2);
  border-radius: 0.6rem;
  background: rgb(var(--rgb-accent) / 0.05);
  padding: 0.9rem 1rem;
}

.ig-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.ig-list li {
  position: relative;
  padding-left: 1.1rem;
}

.ig-list li::before {
  content: '';
  position: absolute;
  top: 0.65em;
  left: 0.2rem;
  width: 0.4rem;
  height: 0.4rem;
  transform: rotate(45deg);
  background: var(--color-accent);
}

.ig-signals {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
  gap: 0.6rem;
}

.ig-signal {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  border: 1px solid rgb(var(--rgb-accent) / 0.18);
  border-radius: 0.5rem;
  background: rgb(var(--rgb-chrome) / 0.55);
  padding: 0.6rem 0.75rem;
}

.ig-signal strong {
  font-size: 0.875rem;
  color: var(--color-text);
}

.ig-signal p {
  font-size: 0.75rem;
  line-height: 1.4;
  color: rgb(var(--rgb-text) / 0.62);
}

.ig-chip {
  align-self: flex-start;
  border: 1px solid rgb(var(--rgb-accent) / 0.35);
  border-radius: 0.3rem;
  background: rgb(var(--rgb-accent) / 0.12);
  padding: 0.05rem 0.4rem;
  font-family: ui-monospace, monospace;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-accent);
}

.ig-warning {
  border: 1px solid rgb(var(--rgb-warning) / 0.35);
  border-radius: 0.5rem;
  background: rgb(var(--rgb-warning) / 0.06);
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
}

.ig-shortcut {
  border: 1px solid rgb(var(--rgb-accent) / 0.18);
  border-radius: 0.5rem;
  background: rgb(var(--rgb-chrome) / 0.55);
  padding: 0.6rem 0.75rem;
}

.ig-shortcut-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--color-text);
}

.ig-shortcut p {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  line-height: 1.4;
  color: rgb(var(--rgb-text) / 0.6);
}

.ig-kbd {
  flex-shrink: 0;
  white-space: nowrap;
  border: 1px solid rgb(var(--rgb-accent) / 0.4);
  border-bottom-width: 3px;
  border-radius: 0.4rem;
  background: var(--color-blue-600);
  padding: 0.1rem 0.5rem;
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-accent);
}

.ig-note {
  font-size: 0.75rem;
  color: rgb(var(--rgb-text) / 0.55);
}

.ig-link {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: 0.35rem;
  font-weight: 700;
  color: var(--color-accent);
}

.ig-link:hover {
  text-decoration: underline;
}
</style>
