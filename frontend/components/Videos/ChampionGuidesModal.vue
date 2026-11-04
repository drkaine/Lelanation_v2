<template>
  <Teleport to="body">
    <div v-if="champion" class="champion-guides-modal" role="presentation">
      <div class="champion-guides-modal__backdrop" aria-hidden="true" @click="emit('close')" />
      <div
        class="champion-guides-modal__dialog ui-build-card-surface"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <header
          class="flex shrink-0 items-center justify-between gap-3 border-b border-primary/25 px-4 py-3 md:px-6"
        >
          <div class="flex min-w-0 items-center gap-3">
            <img
              :src="getChampionImageUrl(version, champion.image.full)"
              :alt="champion.name"
              width="40"
              height="40"
              class="champion-guides-modal__icon shrink-0 rounded-md"
            />
            <h2 :id="titleId" class="truncate text-lg font-semibold text-text-accent md:text-xl">
              {{ t('championGuidesPage.heading', { champion: champion.name }) }}
            </h2>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <NuxtLink
              :to="localePath(`/statistics/champion/${champion.id.toLowerCase()}`)"
              class="ui-build-card-button hidden rounded-md px-3 py-1.5 text-sm font-semibold sm:inline-flex"
            >
              {{ t('championGuidesPage.stats') }}
            </NuxtLink>
            <button
              ref="closeRef"
              type="button"
              class="ui-build-card-button inline-flex items-center justify-center rounded-md p-2"
              :aria-label="t('championGuidesPage.close')"
              @click="emit('close')"
            >
              <Icon name="mdi:close" size="22" />
            </button>
          </div>
        </header>
        <div
          role="tablist"
          class="flex shrink-0 gap-2 border-b border-primary/25 px-4 py-2 md:px-6"
          :aria-label="t('championGuidesPage.heading', { champion: champion.name })"
        >
          <button
            v-for="tab in TABS"
            :key="tab"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab"
            :class="[
              'ui-build-card-button rounded-md px-3 py-1.5 text-sm font-semibold',
              activeTab === tab ? 'is-active' : '',
            ]"
            @click="activeTab = tab"
          >
            {{
              t(
                tab === 'videos' ? 'championGuidesPage.tabVideos' : 'championGuidesPage.tabMatchups'
              )
            }}
            <span v-if="tabCount(tab)" class="ml-1 text-xs opacity-75">({{ tabCount(tab) }})</span>
          </button>
        </div>
        <div class="champion-guides-modal__body px-4 py-4 md:px-6" role="tabpanel">
          <ChampionVideosTab :champion-name="champion.name" :section="activeTab" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import ChampionVideosTab from '~/components/statistics/ChampionVideosTab.vue'
import type { Champion } from '~/types/build'
import { getChampionImageUrl } from '~/utils/imageUrl'
import { defaultChampionGuidesTab, type ChampionGuidesTab } from '~/utils/matchupGuidesSheet'

const props = withDefaults(
  defineProps<{
    champion: Champion | null
    version: string
    videoCount?: number
    matchupCount?: number
  }>(),
  { videoCount: 0, matchupCount: 0 }
)
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const localePath = useLocalePath()
const titleId = useId()
const closeRef = ref<HTMLButtonElement | null>(null)

const TABS: ChampionGuidesTab[] = ['videos', 'matchups']
const activeTab = ref<ChampionGuidesTab>('videos')

function tabCount(tab: ChampionGuidesTab): number {
  return tab === 'videos' ? props.videoCount : props.matchupCount
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}

watch(
  () => props.champion,
  async champion => {
    if (!import.meta.client) return
    document.body.style.overflow = champion ? 'hidden' : ''
    if (champion) {
      activeTab.value = defaultChampionGuidesTab(props.videoCount, props.matchupCount)
      window.addEventListener('keydown', onKeydown)
      await nextTick()
      closeRef.value?.focus()
    } else {
      window.removeEventListener('keydown', onKeydown)
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.champion-guides-modal {
  position: fixed;
  inset: 0;
  z-index: 10070;
  display: flex;
  align-items: center;
  justify-content: center;
}

.champion-guides-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 0.7);
}

.champion-guides-modal__dialog {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 80vw;
  height: 80vh;
  overflow: hidden;
  border-radius: 1rem;
}

.champion-guides-modal__icon {
  width: 40px;
  height: 40px;
}

.champion-guides-modal__body {
  flex: 1 1 auto;
  overflow-y: auto;
}

@media (max-width: 640px) {
  .champion-guides-modal__dialog {
    width: calc(100vw - 1rem);
    height: calc(100dvh - 2rem);
  }
}
</style>
