<template>
  <article class="matchup-guide-card">
    <header class="matchup-guide-card__header">
      <div class="matchup-guide-card__identity">
        <img
          v-if="championImageSrc"
          :src="championImageSrc"
          :alt="guide.champion?.name ?? ''"
          class="matchup-guide-card__champion-image"
          :class="{ 'matchup-guide-card__champion-image--icon': !championSplashEnabled }"
        />
        <div class="matchup-guide-card__identity-text">
          <h3 class="matchup-guide-card__champion-name">
            {{ guide.champion?.name ?? '?' }}
          </h3>
          <div class="matchup-guide-card__meta-row">
            <img
              :src="roleIcon(guide.role)"
              :alt="roleLabel(guide.role)"
              class="matchup-guide-card__role-icon"
              :title="roleLabel(guide.role)"
            />
            <div v-if="visibleTags.length" class="matchup-guide-card__tags">
              <span
                v-for="tag in visibleTags"
                :key="tag.id"
                class="matchup-guide-card__tag"
                :class="{
                  'matchup-guide-card__tag--pro': tag.id === 'pro',
                  'matchup-guide-card__tag--otp': tag.id === 'otp',
                }"
              >
                {{ tag.label }}
              </span>
            </div>
          </div>
          <div class="matchup-guide-card__submeta">
            <span
              class="matchup-guide-card__version"
              :title="t('matchupGuideDiscovery.lastUpdateVersion')"
            >
              v{{ guide.gameVersion }}
            </span>
            <span v-if="guide.author" class="matchup-guide-card__author">{{ guide.author }}</span>
            <span
              v-if="(guide.visibility ?? 'public') === 'private'"
              class="matchup-guide-card__private"
            >
              {{ t('buildsPage.private') }}
            </span>
            <span v-if="guide.patchStale" class="matchup-guide-card__stale">
              {{ t('matchupGuideDiscovery.outdated') }}
            </span>
          </div>
        </div>
      </div>
    </header>

    <p v-if="guide.description" class="matchup-guide-card__description">
      {{ guide.description }}
    </p>

    <div
      v-if="guide.bestMatchups?.length || guide.worstMatchups?.length"
      class="matchup-guide-card__matchups-mirror"
    >
      <section v-if="guide.bestMatchups?.length" class="matchup-guide-card__matchups-col">
        <h4 class="matchup-guide-card__matchups-title matchup-guide-card__matchups-title--best">
          {{ t('matchupGuideDiscovery.bestMatchups') }}
        </h4>
        <ul class="matchup-guide-card__matchup-list">
          <li
            v-for="opponent in guide.bestMatchups.slice(0, 3)"
            :key="`best-${opponent.id}`"
            class="matchup-guide-card__matchup-item matchup-guide-card__matchup-item--best"
          >
            <img
              :src="getChampionImageUrl(gameVersion, opponent.image.full)"
              :alt="opponent.name"
              class="matchup-guide-card__matchup-portrait"
            />
            <span class="matchup-guide-card__matchup-name">{{ opponent.name }}</span>
          </li>
        </ul>
      </section>

      <section v-if="guide.worstMatchups?.length" class="matchup-guide-card__matchups-col">
        <h4 class="matchup-guide-card__matchups-title matchup-guide-card__matchups-title--worst">
          {{ t('matchupGuideDiscovery.worstMatchups') }}
        </h4>
        <ul class="matchup-guide-card__matchup-list">
          <li
            v-for="opponent in guide.worstMatchups.slice(0, 3)"
            :key="`worst-${opponent.id}`"
            class="matchup-guide-card__matchup-item matchup-guide-card__matchup-item--worst"
          >
            <img
              :src="getChampionImageUrl(gameVersion, opponent.image.full)"
              :alt="opponent.name"
              class="matchup-guide-card__matchup-portrait"
            />
            <span class="matchup-guide-card__matchup-name">{{ opponent.name }}</span>
          </li>
        </ul>
      </section>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MatchupGuide, MatchupGuideTag, Role } from '@lelanation/shared-types'
import { useI18n } from 'vue-i18n'
import { useVersionStore } from '~/stores/VersionStore'
import { useChampionSplashPreference } from '~/composables/useChampionSplashPreference'
import { getChampionImageUrl, getChampionSplashImageUrl } from '~/utils/imageUrl'

const props = defineProps<{
  guide: MatchupGuide
}>()

const { t } = useI18n()
const versionStore = useVersionStore()
const { championSplashEnabled } = useChampionSplashPreference()
const gameVersion = computed(() => versionStore.currentVersion ?? 'latest')

const tagDefs: Array<{ id: MatchupGuideTag; label: string }> = [
  { id: 'pro', label: 'Pro' },
  { id: 'otp', label: 'OTP' },
]

const visibleTags = computed(() => tagDefs.filter(tag => props.guide.tags?.includes(tag.id)))

const championImageSrc = computed(() => {
  const champion = props.guide.champion
  if (!champion?.image?.full) return ''
  if (championSplashEnabled.value) {
    return getChampionSplashImageUrl(gameVersion.value, champion.id)
  }
  return getChampionImageUrl(gameVersion.value, champion.image.full)
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
.matchup-guide-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid rgb(var(--rgb-accent) / 0.45);
  background: rgb(var(--rgb-surface) / 0.45);
  padding: 0.85rem;
  min-height: 100%;
}

.matchup-guide-card__header {
  border-bottom: 1px solid rgb(var(--rgb-primary) / 0.2);
  padding-bottom: 0.65rem;
}

.matchup-guide-card__identity {
  display: flex;
  gap: 0.65rem;
  align-items: flex-start;
}

.matchup-guide-card__champion-image {
  width: 4.5rem;
  height: 4.5rem;
  flex-shrink: 0;
  border-radius: 0.5rem;
  border: 2px solid rgb(var(--rgb-primary) / 0.4);
  object-fit: cover;
  object-position: top center;
}

.matchup-guide-card__champion-image--icon {
  border-radius: 9999px;
  object-position: center;
}

.matchup-guide-card__identity-text {
  min-width: 0;
  flex: 1;
}

.matchup-guide-card__champion-name {
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.2;
  color: rgb(var(--rgb-text-accent));
}

.matchup-guide-card__meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.35rem;
}

.matchup-guide-card__role-icon {
  width: 1.35rem;
  height: 1.35rem;
}

.matchup-guide-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.matchup-guide-card__tag {
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

.matchup-guide-card__tag--pro {
  background: linear-gradient(130deg, #bd9700 0%, #704b00 100%);
}

.matchup-guide-card__tag--otp {
  background: linear-gradient(130deg, #00b4dd 0%, #003366 100%);
}

.matchup-guide-card__submeta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.4rem;
  font-size: 0.72rem;
}

.matchup-guide-card__version {
  border-radius: 0.35rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  padding: 0.1rem 0.4rem;
  color: rgb(var(--rgb-text) / 0.75);
  font-weight: 600;
}

.matchup-guide-card__author {
  font-weight: 600;
  color: rgb(var(--rgb-text) / 0.85);
}

.matchup-guide-card__private {
  border-radius: 0.35rem;
  border: 1px solid rgb(244 63 94 / 0.45);
  background: rgb(244 63 94 / 0.12);
  padding: 0.1rem 0.35rem;
  color: rgb(251 113 133);
  font-weight: 700;
  text-transform: uppercase;
}

.matchup-guide-card__stale {
  border-radius: 0.35rem;
  border: 1px solid rgb(248 113 113 / 0.45);
  background: rgb(248 113 113 / 0.12);
  padding: 0.1rem 0.35rem;
  color: rgb(248 113 113);
  font-weight: 600;
}

.matchup-guide-card__description {
  font-size: 0.82rem;
  line-height: 1.45;
  color: rgb(var(--rgb-text) / 0.82);
}

.matchup-guide-card__matchups-mirror {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.5rem 0.65rem;
  border-top: 1px solid rgb(var(--rgb-primary) / 0.15);
  padding-top: 0.65rem;
}

.matchup-guide-card__matchups-col {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.35rem;
}

.matchup-guide-card__matchups-col + .matchup-guide-card__matchups-col {
  border-left: 1px solid rgb(var(--rgb-primary) / 0.15);
  padding-left: 0.65rem;
}

.matchup-guide-card__matchups-col:first-child:last-child {
  grid-column: 1 / -1;
}

.matchup-guide-card__matchups-title {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.matchup-guide-card__matchups-title--best {
  color: rgb(74 222 128);
  text-align: left;
}

.matchup-guide-card__matchups-title--worst {
  color: rgb(248 113 113);
  text-align: right;
}

.matchup-guide-card__matchup-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.matchup-guide-card__matchup-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.matchup-guide-card__matchup-item--best {
  flex-direction: row;
  justify-content: flex-start;
}

.matchup-guide-card__matchup-item--worst {
  flex-direction: row-reverse;
  justify-content: flex-start;
}

.matchup-guide-card__matchup-item--best .matchup-guide-card__matchup-name {
  text-align: left;
}

.matchup-guide-card__matchup-item--worst .matchup-guide-card__matchup-name {
  text-align: right;
}

.matchup-guide-card__matchup-portrait {
  width: 1.65rem;
  height: 1.65rem;
  flex-shrink: 0;
  border-radius: 9999px;
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  object-fit: cover;
}

.matchup-guide-card__matchup-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.78rem;
  font-weight: 600;
  color: rgb(var(--rgb-text) / 0.9);
}
</style>
