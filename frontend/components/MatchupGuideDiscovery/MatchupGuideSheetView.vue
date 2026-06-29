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
                  class="matchup-sheet__tag"
                  :class="{
                    'matchup-sheet__tag--pro': tag.id === 'pro',
                    'matchup-sheet__tag--otp': tag.id === 'otp',
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
                  class="matchup-sheet__tag"
                  :class="{
                    'matchup-sheet__tag--pro': tag.id === 'pro',
                    'matchup-sheet__tag--otp': tag.id === 'otp',
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

    <div v-if="showMatchupsSection" class="matchup-sheet__matchups-mirror">
      <section v-if="guide.bestMatchups?.length" class="matchup-sheet__matchups-col">
        <h4 class="matchup-sheet__matchups-title matchup-sheet__matchups-title--best">
          {{ t('matchupGuideDiscovery.bestMatchups') }}
        </h4>
        <ul class="matchup-sheet__matchup-list">
          <li
            v-for="opponent in guide.bestMatchups.slice(0, 3)"
            :key="`best-${opponent.id}`"
            class="matchup-sheet__matchup-item matchup-sheet__matchup-item--best"
          >
            <img
              :src="getChampionImageUrl(gameVersion, opponent.image.full)"
              :alt="opponent.name"
              class="matchup-sheet__matchup-portrait"
            />
            <span class="matchup-sheet__matchup-name">{{ opponent.name }}</span>
          </li>
        </ul>
      </section>

      <section v-if="guide.worstMatchups?.length" class="matchup-sheet__matchups-col">
        <h4 class="matchup-sheet__matchups-title matchup-sheet__matchups-title--worst">
          {{ t('matchupGuideDiscovery.worstMatchups') }}
        </h4>
        <ul class="matchup-sheet__matchup-list">
          <li
            v-for="opponent in guide.worstMatchups.slice(0, 3)"
            :key="`worst-${opponent.id}`"
            class="matchup-sheet__matchup-item matchup-sheet__matchup-item--worst"
          >
            <img
              :src="getChampionImageUrl(gameVersion, opponent.image.full)"
              :alt="opponent.name"
              class="matchup-sheet__matchup-portrait"
            />
            <span class="matchup-sheet__matchup-name">{{ opponent.name }}</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MatchupGuide, MatchupGuideTag, Role } from '@lelanation/shared-types'
import { useI18n } from 'vue-i18n'
import { useVersionStore } from '~/stores/VersionStore'
import { useChampionSplashPreference } from '~/composables/useChampionSplashPreference'
import { useClientHydrated } from '~/composables/useClientHydrated'
import { guideDisplayDate } from '~/composables/useMatchupGuideDetail'
import { getChampionImageUrl, getChampionSplashImageUrl } from '~/utils/imageUrl'
import {
  matchupGuideCardDescription,
  matchupGuideDetailDescription,
} from '~/utils/matchupGuideText'

const props = withDefaults(
  defineProps<{
    guide: MatchupGuide
    variant?: 'card' | 'detail'
  }>(),
  { variant: 'card' }
)

const { t, locale } = useI18n()
const versionStore = useVersionStore()
const { championSplashEnabled } = useChampionSplashPreference()
const { hydrated } = useClientHydrated()
const gameVersion = computed(() => versionStore.currentVersion ?? 'latest')

const tagDefs: Array<{ id: MatchupGuideTag; label: string }> = [
  { id: 'pro', label: 'Pro' },
  { id: 'otp', label: 'OTP' },
]

const visibleTags = computed(() => tagDefs.filter(tag => props.guide.tags?.includes(tag.id)))

const displayDescription = computed(() =>
  props.variant === 'detail'
    ? matchupGuideDetailDescription(props.guide)
    : matchupGuideCardDescription(props.guide)
)

const showMatchupsSection = computed(() => {
  if (props.variant === 'card') return true
  return Boolean(props.guide.bestMatchups?.length || props.guide.worstMatchups?.length)
})

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
  color: rgb(255 255 255);
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

.matchup-sheet__tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.75rem;
  height: 1.35rem;
  padding: 0 0.4rem;
  border-radius: 9999px;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  border: 1px solid rgb(255 255 255 / 0.28);
  color: rgba(255, 255, 255, 0.95);
}

.matchup-sheet__tag--pro {
  background: linear-gradient(130deg, #bd9700 0%, #704b00 100%);
}

.matchup-sheet__tag--otp {
  background: linear-gradient(130deg, #00b4dd 0%, #003366 100%);
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

.matchup-sheet--detail .matchup-sheet__matchup-portrait {
  width: 3.5rem;
  height: 3.5rem;
}
</style>
