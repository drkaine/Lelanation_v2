<template>
  <Teleport to="body">
    <div v-if="open" class="community-post-modal" role="presentation">
      <div class="community-post-modal__backdrop" aria-hidden="true" @click="emit('close')" />

      <div
        class="community-post-modal__dialog ui-build-card-surface"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @click.stop
      >
        <header
          class="flex shrink-0 items-start justify-between gap-3 border-b border-primary/25 px-4 py-3 md:px-6"
        >
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-wide text-text/60">
              {{ post.channelTitle }}
            </p>
            <h2 :id="titleId" class="mt-1 text-lg font-semibold md:text-xl">
              <a
                :href="post.url"
                target="_blank"
                rel="noopener noreferrer"
                class="community-post-modal__title-link"
              >
                <span>{{ post.title }}</span>
                <Icon name="mdi:open-in-new" size="16" class="shrink-0" />
              </a>
            </h2>
            <p class="mt-1 text-xs text-text/65">{{ formattedDate }}</p>
          </div>
          <button
            type="button"
            class="ui-build-card-button inline-flex shrink-0 items-center justify-center rounded-md p-2"
            :aria-label="t('communityPostModal.close')"
            @click="emit('close')"
          >
            <Icon name="mdi:close" size="22" />
          </button>
        </header>

        <div class="community-post-modal__body">
          <div v-if="loadingImages" class="community-post-modal__loading">
            {{ t('communityPostModal.loadingImages') }}
          </div>

          <div v-else-if="images.length > 0" class="community-post-modal__carousel">
            <div ref="trackRef" class="community-post-modal__track" @scroll.passive="onTrackScroll">
              <div
                v-for="(url, index) in images"
                :key="`${url}-${index}`"
                class="community-post-modal__slide"
              >
                <img
                  :src="url"
                  :alt="imageAlt(index)"
                  class="community-post-modal__image"
                  decoding="async"
                />
              </div>
            </div>

            <button
              v-if="images.length > 1"
              type="button"
              class="community-post-modal__nav community-post-modal__nav--prev"
              :aria-label="t('communityPostModal.previousImage')"
              @click="showPrevious"
            >
              <Icon name="mdi:chevron-left" size="28" />
            </button>
            <button
              v-if="images.length > 1"
              type="button"
              class="community-post-modal__nav community-post-modal__nav--next"
              :aria-label="t('communityPostModal.nextImage')"
              @click="showNext"
            >
              <Icon name="mdi:chevron-right" size="28" />
            </button>

            <span v-if="images.length > 1" class="community-post-modal__counter" aria-live="polite">
              {{ activeIndex + 1 }} / {{ images.length }}
            </span>

            <div v-if="images.length > 1" class="community-post-modal__dots">
              <button
                v-for="(_, index) in images"
                :key="index"
                type="button"
                class="community-post-modal__dot"
                :class="{ 'is-active': index === activeIndex }"
                :aria-label="t('communityPostModal.goToImage', { index: index + 1 })"
                @click="scrollToIndex(index)"
              />
            </div>
          </div>

          <div class="community-post-modal__content px-4 py-4 md:px-6 md:py-5">
            <p class="whitespace-pre-wrap text-sm leading-relaxed text-text/90">
              {{ post.description }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { YouTubeVideo } from '~/types/youtube'
import { getCommunityPostImages, loadCommunityPostImages } from '~/utils/communityPostImages'

const props = defineProps<{
  open: boolean
  post: YouTubeVideo
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const titleId = 'community-post-modal-title'
const trackRef = ref<HTMLElement | null>(null)
const activeIndex = ref(0)
const images = ref<string[]>([])
const loadingImages = ref(false)

const formattedDate = computed(() => {
  const d = new Date(props.post.publishedAt)
  if (Number.isNaN(d.getTime())) return props.post.publishedAt
  return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: '2-digit' })
})

const imageAlt = (index: number) =>
  t('communityPostModal.imageAlt', {
    title: props.post.title,
    index: index + 1,
    total: images.value.length,
  })

const scrollToIndex = (index: number, behavior: ScrollBehavior = 'smooth') => {
  const track = trackRef.value
  if (!track) return
  const next = Math.max(0, Math.min(index, images.value.length - 1))
  track.scrollTo({ left: next * track.clientWidth, behavior })
  activeIndex.value = next
}

const showPrevious = () => {
  scrollToIndex(activeIndex.value - 1)
}

const showNext = () => {
  scrollToIndex(activeIndex.value + 1)
}

const onTrackScroll = () => {
  const track = trackRef.value
  if (!track || track.clientWidth <= 0) return
  activeIndex.value = Math.round(track.scrollLeft / track.clientWidth)
}

const loadImages = async () => {
  loadingImages.value = true
  try {
    images.value = await loadCommunityPostImages(props.post)
  } finally {
    loadingImages.value = false
    await nextTick()
    scrollToIndex(0, 'auto')
  }
}

const refreshImages = () => {
  loadImages().catch(() => {})
}

function onKeydown(event: KeyboardEvent) {
  if (!props.open) return

  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }

  if (images.value.length <= 1) return

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    showPrevious()
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    showNext()
  }
}

watch(
  () => props.open,
  isOpen => {
    if (!import.meta.client) return
    document.body.style.overflow = isOpen ? 'hidden' : ''
    if (isOpen) {
      activeIndex.value = 0
      refreshImages()
    }
  }
)

watch(
  () => props.post.id,
  () => {
    activeIndex.value = 0
    if (props.open) refreshImages()
  }
)

onMounted(() => {
  if (!import.meta.client) return
  document.addEventListener('keydown', onKeydown)
  if (props.open) {
    images.value = getCommunityPostImages(props.post)
    refreshImages()
  }
})

onUnmounted(() => {
  if (!import.meta.client) return
  document.removeEventListener('keydown', onKeydown)
  if (props.open) document.body.style.overflow = ''
})
</script>

<style scoped>
.community-post-modal {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.community-post-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 0.72);
}

.community-post-modal__dialog {
  position: relative;
  display: flex;
  max-height: min(92vh, 960px);
  width: min(100%, 760px);
  flex-direction: column;
  overflow: hidden;
  border-radius: 1rem;
}

.community-post-modal__body {
  min-height: 0;
  overflow: auto;
}

.community-post-modal__title-link {
  display: inline-flex;
  align-items: flex-start;
  gap: 0.5rem;
  color: var(--color-gold-300, rgb(253 224 71));
  text-decoration: none;
  transition: color 0.15s ease;
}

.community-post-modal__title-link:hover {
  color: var(--color-accent, rgb(125 211 252));
  text-decoration: underline;
}

.community-post-modal__loading {
  padding: 2rem 1rem;
  text-align: center;
  font-size: 0.875rem;
  color: rgb(255 255 255 / 0.7);
}

.community-post-modal__carousel {
  position: relative;
  border-bottom: 1px solid rgb(125 211 252 / 0.2);
}

.community-post-modal__track {
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.community-post-modal__track::-webkit-scrollbar {
  display: none;
}

.community-post-modal__slide {
  flex: 0 0 100%;
  scroll-snap-align: start;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: min(70vh, 720px);
  background: rgb(0 0 0 / 0.45);
}

.community-post-modal__image {
  display: block;
  width: 100%;
  height: auto;
  max-height: min(70vh, 720px);
  object-fit: contain;
}

.community-post-modal__nav {
  position: absolute;
  top: 50%;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 9999px;
  background: rgb(0 0 0 / 0.55);
  color: white;
  transform: translateY(-50%);
  transition: background 0.15s ease;
}

.community-post-modal__nav:hover {
  background: rgb(0 0 0 / 0.75);
}

.community-post-modal__nav--prev {
  left: 0.75rem;
}

.community-post-modal__nav--next {
  right: 0.75rem;
}

.community-post-modal__counter {
  position: absolute;
  right: 0.75rem;
  bottom: 0.75rem;
  z-index: 2;
  border-radius: 9999px;
  background: rgb(0 0 0 / 0.65);
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
  pointer-events: none;
}

.community-post-modal__dots {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.75rem 1rem;
}

.community-post-modal__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background: rgb(125 211 252 / 0.35);
  transition:
    transform 0.15s ease,
    background 0.15s ease;
}

.community-post-modal__dot.is-active {
  transform: scale(1.15);
  background: var(--color-accent, rgb(125 211 252));
}
</style>
