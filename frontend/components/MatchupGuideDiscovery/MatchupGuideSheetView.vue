<template>
  <div
    class="matchup-sheet"
    :class="{
      'matchup-sheet--detail': variant === 'detail',
      'matchup-sheet--card': variant === 'card',
    }"
  >
    <header class="matchup-sheet__header">
      <template v-if="variant === 'card'">
        <div class="matchup-sheet__card-top">
          <div class="matchup-sheet__identity matchup-sheet__identity--card">
            <img
              v-if="championImageSrc"
              :src="championImageSrc"
              :alt="guide.champion?.name ?? ''"
              class="matchup-sheet__champion-image"
              :class="{
                'matchup-sheet__champion-image--icon': !championSplashEnabled,
                'matchup-sheet__champion-image--splash': championSplashEnabled,
              }"
            />
            <div class="matchup-sheet__identity-meta">
              <div class="matchup-sheet__name-line">
                <h3 class="matchup-sheet__champion-name">
                  {{ guide.champion?.name ?? '?' }}
                </h3>
                <img
                  :src="roleIcon(guide.role)"
                  :alt="roleLabel(guide.role)"
                  class="matchup-sheet__role-icon"
                  :title="roleLabel(guide.role)"
                />
              </div>
              <div v-if="visibleTags.length" class="matchup-sheet__tags-inline">
                <span
                  v-for="tag in visibleTags"
                  :key="tag.id"
                  class="ui-tag"
                  :class="{
                    'ui-tag--pro': tag.id === 'pro',
                    'ui-tag--otp': tag.id === 'otp',
                  }"
                >
                  {{ tag.label }}
                </span>
              </div>
            </div>
          </div>

          <div class="matchup-sheet__version-block">
            <span
              class="matchup-sheet__version"
              :title="t('matchupGuideDiscovery.lastUpdateVersion')"
            >
              v{{ guide.gameVersion }}
            </span>
            <time v-if="formattedDate" class="matchup-sheet__date" :datetime="displayDateIso">
              {{ formattedDate }}
            </time>
            <span
              v-if="(guide.visibility ?? 'public') === 'private'"
              class="matchup-sheet__badge matchup-sheet__badge--private"
            >
              {{ t('buildsPage.private') }}
            </span>
            <span v-if="guide.patchStale" class="matchup-sheet__badge matchup-sheet__badge--stale">
              {{ t('matchupGuideDiscovery.outdated') }}
            </span>
          </div>
        </div>
      </template>

      <div v-else class="matchup-sheet__top-row">
        <div class="matchup-sheet__identity">
          <img
            v-if="championImageSrc"
            :src="championImageSrc"
            :alt="guide.champion?.name ?? ''"
            class="matchup-sheet__champion-image"
            :class="{
              'matchup-sheet__champion-image--icon': !championSplashEnabled,
              'matchup-sheet__champion-image--splash': championSplashEnabled,
            }"
          />
          <div class="matchup-sheet__identity-text">
            <div class="matchup-sheet__identity-meta">
              <div class="matchup-sheet__name-line">
                <h3 class="matchup-sheet__champion-name">
                  {{ guide.champion?.name ?? '?' }}
                </h3>
                <img
                  :src="roleIcon(guide.role)"
                  :alt="roleLabel(guide.role)"
                  class="matchup-sheet__role-icon"
                  :title="roleLabel(guide.role)"
                />
              </div>
              <div v-if="visibleTags.length" class="matchup-sheet__tags-inline">
                <span
                  v-for="tag in visibleTags"
                  :key="tag.id"
                  class="ui-tag"
                  :class="{
                    'ui-tag--pro': tag.id === 'pro',
                    'ui-tag--otp': tag.id === 'otp',
                  }"
                >
                  {{ tag.label }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <p class="matchup-sheet__author">
          {{ guide.author?.trim() || t('matchupGuideDiscovery.authorAnonymous') }}
        </p>

        <div class="matchup-sheet__version-block">
          <span
            class="matchup-sheet__version"
            :title="t('matchupGuideDiscovery.lastUpdateVersion')"
          >
            v{{ guide.gameVersion }}
          </span>
          <time v-if="formattedDate" class="matchup-sheet__date" :datetime="displayDateIso">
            {{ formattedDate }}
          </time>
          <button
            v-if="hasDetailContent"
            type="button"
            class="matchup-sheet__detail-toggle"
            :aria-expanded="detailExtrasExpanded"
            :aria-label="
              detailExtrasExpanded
                ? t('matchupGuideDiscovery.hideDetailExtras')
                : t('matchupGuideDiscovery.showDetailExtras')
            "
            @click="detailExtrasExpanded = !detailExtrasExpanded"
          >
            <svg
              class="matchup-sheet__detail-toggle-chevron"
              :class="{ 'matchup-sheet__detail-toggle-chevron--open': detailExtrasExpanded }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          <span
            v-if="(guide.visibility ?? 'public') === 'private'"
            class="matchup-sheet__badge matchup-sheet__badge--private"
          >
            {{ t('buildsPage.private') }}
          </span>
          <span v-if="guide.patchStale" class="matchup-sheet__badge matchup-sheet__badge--stale">
            {{ t('matchupGuideDiscovery.outdated') }}
          </span>
        </div>
      </div>
    </header>

    <template v-if="variant === 'detail'">
      <section
        v-if="hasDetailContent"
        v-show="detailExtrasExpanded"
        class="matchup-sheet__detail-layout"
      >
        <aside v-if="guideBuild" class="matchup-sheet__detail-build">
          <BuildCard :build="guideBuild" readonly hide-top-actions sheet-tooltips />
        </aside>

        <div class="matchup-sheet__detail-content">
          <section v-if="shortDescriptionText" class="matchup-sheet__labeled-block">
            <h4 class="matchup-sheet__label">
              {{ t('matchupGuideDiscovery.shortDescriptionLabel') }}
            </h4>
            <p class="matchup-sheet__short-description">{{ shortDescriptionText }}</p>
          </section>

          <section v-if="longDescriptionText" class="matchup-sheet__labeled-block">
            <h4 class="matchup-sheet__label">{{ t('matchupGuideDiscovery.descriptionLabel') }}</h4>
            <p class="matchup-sheet__description matchup-sheet__description--detail">
              {{ longDescriptionText }}
            </p>
          </section>

          <div v-if="hasMetaNotes" class="matchup-sheet__meta matchup-sheet__meta--detail">
            <section v-if="guide.meta?.authorAbout" class="matchup-sheet__meta-block">
              <h4 class="matchup-sheet__meta-title">
                {{ t('matchupGuideDiscovery.authorAbout') }}
              </h4>
              <p class="matchup-sheet__meta-text">{{ guide.meta.authorAbout }}</p>
            </section>
            <section v-if="guide.meta?.opggUrl" class="matchup-sheet__meta-block">
              <h4 class="matchup-sheet__meta-title">
                {{ t('matchupGuideDiscovery.opggProfile') }}
              </h4>
              <a
                :href="guide.meta.opggUrl"
                class="matchup-sheet__meta-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ guide.meta.opggUrl }}
              </a>
            </section>
            <section v-if="guide.meta?.permabanNotes" class="matchup-sheet__meta-block">
              <h4 class="matchup-sheet__meta-title">
                {{ t('matchupGuideDiscovery.permabanNotes') }}
              </h4>
              <p class="matchup-sheet__meta-text">{{ guide.meta.permabanNotes }}</p>
            </section>
          </div>
        </div>
      </section>
    </template>

    <div v-else-if="displayDescription || variant === 'card'" class="matchup-sheet__extras">
      <p
        v-if="displayDescription"
        class="matchup-sheet__description"
        :class="{ 'matchup-sheet__description--clamped': variant === 'card' }"
      >
        {{ displayDescription }}
      </p>
      <p
        v-else-if="variant === 'card'"
        class="matchup-sheet__description matchup-sheet__description--empty"
      />
    </div>

    <section
      v-if="variant === 'detail' && fullMatchups.length"
      class="matchup-sheet__table-section"
    >
      <h4 class="matchup-sheet__table-title">{{ t('matchupGuideDiscovery.fullMatchupTable') }}</h4>
      <MatchupGuideEntriesTable
        mode="readonly"
        :entries="fullMatchups"
        :build="guideBuild"
        :show-filters="false"
      />
    </section>

    <div v-if="showMatchupsSection" class="matchup-sheet__matchups-mirror">
      <section v-if="guide.bestMatchups?.length" class="matchup-sheet__matchups-col">
        <h4 class="matchup-sheet__matchups-title matchup-sheet__matchups-title--best">
          {{ t('matchupGuideDiscovery.bestMatchups') }}
        </h4>
        <ul class="matchup-sheet__matchup-list">
          <li
            v-for="row in bestMatchupRows"
            :key="`best-${row.opponent.id}`"
            class="matchup-sheet__matchup-item matchup-sheet__matchup-item--best"
          >
            <img
              :src="getChampionImageUrl(gameVersion, row.opponent.image.full)"
              :alt="row.opponent.name"
              class="matchup-sheet__matchup-portrait"
            />
            <span class="matchup-sheet__matchup-name">
              {{ row.opponent.name
              }}<span v-if="row.difficultyLabel" class="matchup-sheet__matchup-difficulty">
                · {{ row.difficultyLabel }}</span
              >
            </span>
          </li>
        </ul>
      </section>

      <section v-if="guide.worstMatchups?.length" class="matchup-sheet__matchups-col">
        <h4 class="matchup-sheet__matchups-title matchup-sheet__matchups-title--worst">
          {{ t('matchupGuideDiscovery.worstMatchups') }}
        </h4>
        <ul class="matchup-sheet__matchup-list">
          <li
            v-for="row in worstMatchupRows"
            :key="`worst-${row.opponent.id}`"
            class="matchup-sheet__matchup-item matchup-sheet__matchup-item--worst"
          >
            <img
              :src="getChampionImageUrl(gameVersion, row.opponent.image.full)"
              :alt="row.opponent.name"
              class="matchup-sheet__matchup-portrait"
            />
            <span class="matchup-sheet__matchup-name">
              {{ row.opponent.name
              }}<span v-if="row.difficultyLabel" class="matchup-sheet__matchup-difficulty">
                · {{ row.difficultyLabel }}</span
              >
            </span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  ChampionRef,
  MatchupEntry,
  MatchupGuide,
  MatchupGuideTag,
  Role,
} from '@lelanation/shared-types'
import { useI18n } from 'vue-i18n'
import BuildCard from '~/components/Build/BuildCard.vue'
import { useVersionStore } from '~/stores/VersionStore'
import { useChampionSplashPreference } from '~/composables/useChampionSplashPreference'
import { useClientHydrated } from '~/composables/useClientHydrated'
import { guideDisplayDate } from '~/composables/useMatchupGuideDetail'
import { hydrateBuild } from '~/utils/buildSerialize'
import { getChampionImageUrl, getChampionSplashImageUrl } from '~/utils/imageUrl'
import { matchupGuideCardDescription } from '~/utils/matchupGuideText'
import { formatMatchupDifficulty } from '~/utils/matchupEntryUtils'
import MatchupGuideEntriesTable from '~/components/matchups/MatchupGuideEntriesTable.vue'

type MatchupPreviewRow = {
  opponent: ChampionRef
  difficultyLabel: string
}

const props = withDefaults(
  defineProps<{
    guide: MatchupGuide
    variant?: 'card' | 'detail'
  }>(),
  { variant: 'card' }
)

const { t, locale } = useI18n()
const detailExtrasExpanded = ref(true)
const versionStore = useVersionStore()
const { championSplashEnabled } = useChampionSplashPreference()
const { hydrated } = useClientHydrated()
const gameVersion = computed(() => versionStore.currentVersion ?? 'latest')

const tagDefs: Array<{ id: MatchupGuideTag; label: string }> = [
  { id: 'pro', label: 'Pro' },
  { id: 'otp', label: 'OTP' },
]

const visibleTags = computed(() => tagDefs.filter(tag => props.guide.tags?.includes(tag.id)))

const shortDescriptionText = computed(() => props.guide.shortDescription?.trim() ?? '')

const longDescriptionText = computed(() => props.guide.description?.trim() ?? '')

const displayDescription = computed(() =>
  props.variant === 'detail' ? longDescriptionText.value : matchupGuideCardDescription(props.guide)
)

const showMatchupsSection = computed(() => {
  if (props.variant === 'detail' && fullMatchups.value.length) return false
  if (props.variant === 'card') return true
  return Boolean(props.guide.bestMatchups?.length || props.guide.worstMatchups?.length)
})

const fullMatchups = computed(() => props.guide.matchups ?? [])

const matchupByOpponentId = computed(() => {
  const map = new Map<string, MatchupEntry>()
  for (const entry of fullMatchups.value) {
    map.set(entry.opponent.id, entry)
  }
  return map
})

function toMatchupPreviewRow(opponent: ChampionRef): MatchupPreviewRow {
  const entry = matchupByOpponentId.value.get(opponent.id)
  const difficultyLabel = entry ? formatMatchupDifficulty(entry, t) : ''
  return { opponent, difficultyLabel: difficultyLabel === '—' ? '' : difficultyLabel }
}

const bestMatchupRows = computed(() =>
  (props.guide.bestMatchups ?? []).slice(0, 3).map(toMatchupPreviewRow)
)

const worstMatchupRows = computed(() =>
  (props.guide.worstMatchups ?? []).slice(0, 3).map(toMatchupPreviewRow)
)

const guideBuild = computed(() => {
  if (!props.guide.build) return null
  try {
    return hydrateBuild(props.guide.build)
  } catch {
    return null
  }
})

const hasMetaNotes = computed(
  () =>
    Boolean(props.guide.meta?.authorAbout?.trim()) ||
    Boolean(props.guide.meta?.opggUrl?.trim()) ||
    Boolean(props.guide.meta?.permabanNotes?.trim())
)

const hasDetailContent = computed(
  () =>
    Boolean(shortDescriptionText.value) ||
    Boolean(longDescriptionText.value) ||
    Boolean(guideBuild.value) ||
    hasMetaNotes.value
)

const championImageSrc = computed(() => {
  const champion = props.guide.champion
  if (!champion?.image?.full) return ''
  if (championSplashEnabled.value) {
    return getChampionSplashImageUrl(gameVersion.value, champion.id)
  }
  return getChampionImageUrl(gameVersion.value, champion.image.full)
})

const displayDateIso = computed(() => guideDisplayDate(props.guide))

const formattedDate = computed(() => {
  const iso = displayDateIso.value
  if (!iso || !hydrated.value) return ''
  return new Date(iso).toLocaleDateString(locale.value, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
})

const roleIcons: Record<Role, string> = {
  top: '/icons/roles/top.png',
  jungle: '/icons/roles/jungle.png',
  mid: '/icons/roles/mid.png',
  adc: '/icons/roles/bot.png',
  support: '/icons/roles/support.png',
}

function roleIcon(role: Role) {
  return roleIcons[role] ?? '/icons/roles/all-role.png'
}

function roleLabel(role: Role) {
  const labels: Record<Role, string> = {
    top: 'Top',
    jungle: 'Jungle',
    mid: 'Mid',
    adc: 'ADC',
    support: 'Support',
  }
  return labels[role]
}
</script>

<style scoped>
.matchup-sheet {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
  max-width: 100%;
}

.matchup-sheet--detail {
  overflow-x: clip;
}

.matchup-sheet__header {
  padding-bottom: 0;
}

.matchup-sheet--card {
  flex: 1 1 auto;
  min-height: 0;
}

.matchup-sheet__identity-meta {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
}

.matchup-sheet__name-line {
  display: flex;
  max-width: 100%;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.matchup-sheet__tags-inline {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.25rem;
}

.matchup-sheet__card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.matchup-sheet__identity--card {
  flex: 1;
  min-width: 0;
  align-items: flex-start;
}

.matchup-sheet__identity--card .matchup-sheet__champion-name {
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.matchup-sheet__champion-name {
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.2;
  color: rgb(var(--rgb-text));
  margin: 0;
}

.matchup-sheet__identity {
  display: flex;
  min-width: 0;
  justify-self: start;
  gap: 0.65rem;
  align-items: flex-start;
}

.matchup-sheet__champion-image {
  width: 4.5rem;
  height: 4.5rem;
  flex-shrink: 0;
  border-radius: 0.5rem;
  border: 2px solid var(--card-border-color-soft, rgb(var(--rgb-primary) / 0.4));
  object-fit: cover;
  object-position: top center;
}

.matchup-sheet__champion-image--icon {
  border-radius: 9999px;
  object-position: center;
}

.matchup-sheet__champion-image--splash {
  width: auto;
  max-width: 200px;
  height: 72px;
  border: none;
  border-radius: 0.35rem;
  object-fit: contain;
  object-position: left center;
}

.matchup-sheet__identity-text {
  min-width: 0;
}

.matchup-sheet__top-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 0.5rem;
}

.matchup-sheet__role-icon {
  width: 1.35rem;
  height: 1.35rem;
  flex-shrink: 0;
}

.matchup-sheet__version-block {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: flex-end;
  justify-self: end;
  gap: 0.2rem;
  text-align: right;
}

.matchup-sheet__version {
  border-radius: 0.35rem;
  border: 1px solid var(--card-border-color-soft, rgb(var(--rgb-primary) / 0.35));
  padding: 0.12rem 0.45rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: rgb(var(--rgb-text) / 0.85);
}

.matchup-sheet__date {
  font-size: 0.68rem;
  line-height: 1.3;
  color: rgb(var(--rgb-text) / 0.65);
}

.matchup-sheet__detail-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 0.15rem;
  border: none;
  background: transparent;
  padding: 0;
  color: #d4af37;
  cursor: pointer;
  line-height: 1;
}

.matchup-sheet__detail-toggle:hover {
  color: #f0d060;
}

.matchup-sheet__detail-toggle-chevron {
  width: 1.15rem;
  height: 1.15rem;
  transition: transform 0.2s ease;
}

.matchup-sheet__detail-toggle-chevron--open {
  transform: rotate(180deg);
}

.matchup-sheet__badge {
  border-radius: 0.35rem;
  padding: 0.1rem 0.35rem;
  font-size: 0.58rem;
  font-weight: 700;
  text-transform: uppercase;
}

.matchup-sheet__badge--private {
  border: 1px solid rgb(244 63 94 / 0.45);
  background: rgb(244 63 94 / 0.12);
  color: rgb(251 113 133);
}

.matchup-sheet__badge--stale {
  border: 1px solid rgb(248 113 113 / 0.45);
  background: rgb(248 113 113 / 0.12);
  color: rgb(248 113 113);
}

.matchup-sheet__author {
  justify-self: center;
  max-width: 100%;
  padding: 0 0.35rem;
  text-align: center;
  font-size: 1.15rem;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: 0.01em;
  color: rgb(var(--rgb-accent));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.matchup-sheet--detail .matchup-sheet__author {
  font-size: 1.45rem;
}

.matchup-sheet__description {
  font-size: 0.82rem;
  line-height: 1.45;
  color: rgb(var(--rgb-text) / 0.82);
  border-top: 1px solid var(--card-border-color-soft, rgb(var(--rgb-primary) / 0.35));
  padding-top: 0.65rem;
  margin: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.matchup-sheet--card .matchup-sheet__description {
  flex: 0 0 auto;
  min-height: 2.9rem;
}

.matchup-sheet__description--empty {
  min-height: 2.9rem;
}

.matchup-sheet__description--clamped {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.matchup-sheet--detail .matchup-sheet__description {
  font-size: 0.92rem;
}

.matchup-sheet__matchups-mirror {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.5rem 0.65rem;
  border-top: 1px solid var(--card-border-color-soft, rgb(var(--rgb-primary) / 0.35));
  padding-top: 0.65rem;
}

.matchup-sheet--card .matchup-sheet__matchups-mirror {
  flex: 1 1 auto;
  min-height: 11.5rem;
}

.matchup-sheet__matchups-col {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.35rem;
}

.matchup-sheet__matchups-col + .matchup-sheet__matchups-col {
  border-left: 1px solid var(--card-border-color-soft, rgb(var(--rgb-primary) / 0.15));
  padding-left: 0.65rem;
}

.matchup-sheet__matchups-col:first-child:last-child {
  grid-column: 1 / -1;
}

.matchup-sheet__matchups-title {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.matchup-sheet__matchups-title--best {
  color: rgb(74 222 128);
  text-align: left;
}

.matchup-sheet__matchups-title--worst {
  color: rgb(248 113 113);
  text-align: right;
}

.matchup-sheet__matchup-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.matchup-sheet__matchup-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.matchup-sheet__matchup-item--best {
  flex-direction: row;
  justify-content: flex-start;
}

.matchup-sheet__matchup-item--worst {
  flex-direction: row-reverse;
  justify-content: flex-start;
}

.matchup-sheet__matchup-item--best .matchup-sheet__matchup-name {
  text-align: left;
}

.matchup-sheet__matchup-item--worst .matchup-sheet__matchup-name {
  text-align: right;
}

.matchup-sheet__matchup-portrait {
  width: 3.3rem;
  height: 3.3rem;
  flex-shrink: 0;
  border-radius: 9999px;
  border: 1px solid var(--card-border-color-soft, rgb(var(--rgb-primary) / 0.35));
  object-fit: cover;
}

.matchup-sheet__matchup-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.82rem;
  font-weight: 600;
  color: rgb(var(--rgb-text) / 0.9);
}

.matchup-sheet__matchup-difficulty {
  font-weight: 500;
  color: rgb(var(--rgb-text) / 0.62);
}

.matchup-sheet--detail .matchup-sheet__matchup-portrait {
  width: 3.5rem;
  height: 3.5rem;
}

.matchup-sheet__meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-top: 1px solid var(--card-border-color-soft, rgb(var(--rgb-primary) / 0.35));
  padding-top: 0.65rem;
}

.matchup-sheet__meta-block {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 0.75rem 1rem;
}

.matchup-sheet__meta-title {
  margin: 0;
  flex: 0 0 auto;
  min-width: 7.5rem;
  max-width: 11rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgb(var(--rgb-text-accent));
  line-height: 1.45;
}

.matchup-sheet__meta-text {
  margin: 0;
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  font-size: 0.82rem;
  line-height: 1.45;
  color: rgb(var(--rgb-text));
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.matchup-sheet__meta-link {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 0.82rem;
  line-height: 1.45;
  color: rgb(var(--rgb-text-accent));
  word-break: break-all;
}

.matchup-sheet__meta-block--builds {
  align-items: flex-start;
}

.matchup-sheet__build-card-wrap {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 300px;
}

.matchup-sheet__build-card-wrap :deep(.build-card-wrapper) {
  --build-card-width: 300px;
}

.matchup-sheet__description-section {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  border-top: 1px solid var(--card-border-color-soft, rgb(var(--rgb-primary) / 0.35));
  padding-top: 0.65rem;
}

.matchup-sheet__detail-layout {
  display: grid;
  grid-template-columns: minmax(280px, 300px) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
  border-top: 1px solid var(--card-border-color-soft, rgb(var(--rgb-primary) / 0.35));
  padding-top: 0.65rem;
  min-width: 0;
  max-width: 100%;
}

.matchup-sheet__detail-build {
  position: sticky;
  top: 0.75rem;
  max-width: 100%;
}

.matchup-sheet__detail-build :deep(.build-card-wrapper) {
  --build-card-width: 300px;
  max-width: 100%;
}

@media (max-width: 640px) {
  .matchup-sheet__detail-build :deep(.build-card-wrapper) {
    --build-card-width: 100%;
  }
}

.matchup-sheet__detail-content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.65rem;
}

.matchup-sheet__labeled-block {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  max-width: 100%;
}

.matchup-sheet__label {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgb(var(--rgb-text-accent));
  overflow-wrap: anywhere;
}

.matchup-sheet__description--detail {
  border-top: none;
  padding-top: 0;
}

.matchup-sheet__meta--detail {
  border-top: none;
  padding-top: 0;
  margin-top: 0.35rem;
}

@media (max-width: 900px) {
  .matchup-sheet__detail-layout {
    grid-template-columns: 1fr;
  }

  .matchup-sheet__detail-build {
    position: static;
    justify-self: start;
  }
}

.matchup-sheet__short-description {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.45;
  color: rgb(var(--rgb-text) / 0.92);
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.matchup-sheet__extras--detail {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.matchup-sheet__extras--detail .matchup-sheet__description {
  border-top: none;
  padding-top: 0;
}

.matchup-sheet__extras--detail .matchup-sheet__meta {
  border-top: none;
  padding-top: 0;
}

.matchup-sheet__extras {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

@media (max-width: 640px) {
  .matchup-sheet__meta-block {
    flex-direction: column;
    gap: 0.2rem;
  }

  .matchup-sheet__meta-title {
    max-width: none;
  }
}

.matchup-sheet__table-section {
  border-top: 1px solid var(--card-border-color-soft, rgb(var(--rgb-primary) / 0.35));
  padding-top: 0.65rem;
}

.matchup-sheet__table-title {
  margin: 0 0 0.5rem;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgb(var(--rgb-text-accent));
}

.matchup-sheet__table-wrap {
  overflow-x: auto;
}

.matchup-sheet__table {
  width: 100%;
  min-width: 960px;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.matchup-sheet__table th,
.matchup-sheet__table td {
  border: 1px solid rgb(var(--rgb-primary) / 0.25);
  padding: 0.4rem 0.45rem;
  vertical-align: top;
  text-align: left;
}

.matchup-sheet__table th {
  background: rgb(var(--rgb-background) / 0.45);
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: rgb(var(--rgb-text) / 0.75);
}

.matchup-sheet__table-champion {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 6.5rem;
}

.matchup-sheet__table-portrait {
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  border-radius: 9999px;
  object-fit: cover;
}

.matchup-sheet__table-comments {
  min-width: 12rem;
  max-width: 22rem;
  white-space: pre-wrap;
  line-height: 1.4;
}

.matchup-sheet__table-phase {
  min-width: 7rem;
  max-width: 14rem;
  white-space: pre-wrap;
  line-height: 1.35;
  font-size: 0.74rem;
}
</style>
