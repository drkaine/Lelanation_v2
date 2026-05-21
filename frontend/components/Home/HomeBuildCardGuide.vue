<template>
  <section class="home-build-guide" aria-labelledby="home-build-guide-title">
    <h2 id="home-build-guide-title" class="home-build-guide__title text-text-accent">
      {{ t('home.buildCardGuide.title') }}
    </h2>
    <p class="home-build-guide__intro text-text-secondary">
      {{ t('home.buildCardGuide.intro') }}
    </p>

    <div ref="stageRef" class="home-build-guide__stage">
      <svg
        v-if="connectorLines.length > 0 && stageSize.w > 0"
        class="home-build-guide__lines"
        :width="stageSize.w"
        :height="stageSize.h"
        aria-hidden="true"
      >
        <defs>
          <marker
            id="home-guide-arrowhead"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <polygon points="0 0, 8 4, 0 8" fill="var(--color-gold-300)" />
          </marker>
        </defs>
        <line
          v-for="line in connectorLines"
          :key="line.id"
          :x1="line.x1"
          :y1="line.y1"
          :x2="line.x2"
          :y2="line.y2"
          stroke="var(--color-gold-300)"
          stroke-width="1.5"
          :marker-end="'url(#home-guide-arrowhead)'"
        />
      </svg>

      <div class="home-build-guide__layout">
        <ul class="home-build-guide__col home-build-guide__col--left" aria-label="Gauche">
          <li
            v-for="spot in leftSpots"
            :key="spot.id"
            :ref="el => setLabelRef(spot.id, el)"
            class="home-build-guide__item"
          >
            <p class="home-build-guide__text">{{ t(spot.labelKey) }}</p>
          </li>
        </ul>

        <div class="home-build-guide__center">
          <ul
            v-if="topSpots.length"
            class="home-build-guide__col home-build-guide__col--top"
            aria-label="Haut"
          >
            <li
              v-for="spot in topSpots"
              :key="spot.id"
              :ref="el => setLabelRef(spot.id, el)"
              class="home-build-guide__item"
            >
              <p class="home-build-guide__text">{{ t(spot.labelKey) }}</p>
            </li>
          </ul>

          <div ref="cardRef" class="home-build-guide__card">
            <img
              class="home-build-guide__image"
              src="/images/home-build-card-demo.png"
              :alt="t('home.buildCardGuide.imageAlt')"
              width="303"
              height="453"
              loading="lazy"
              decoding="async"
              @load="scheduleLineUpdate"
            />
            <span
              v-for="spot in allSpots"
              :key="`anchor-${spot.id}`"
              :ref="el => setAnchorRef(spot.id, el)"
              class="home-build-guide__anchor"
              :style="{ left: `${spot.anchor.x}%`, top: `${spot.anchor.y}%` }"
            />
          </div>
        </div>

        <ul class="home-build-guide__col home-build-guide__col--right" aria-label="Droite">
          <li
            v-for="spot in rightSpots"
            :key="spot.id"
            :ref="el => setLabelRef(spot.id, el)"
            class="home-build-guide__item"
          >
            <p class="home-build-guide__text">{{ t(spot.labelKey) }}</p>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

const { t } = useI18n()

type SpotSide = 'left' | 'right' | 'top'

interface GuideSpot {
  id: string
  labelKey: string
  /** Point cible sur la carte (% largeur / hauteur de l’image). */
  anchor: { x: number; y: number }
  side: SpotSide
}

interface ConnectorLine {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}

const topSpots: GuideSpot[] = [
  {
    id: 'champion',
    labelKey: 'home.buildCardGuide.champion',
    anchor: { x: 50, y: 16 },
    side: 'top',
  },
]

const leftSpots: GuideSpot[] = [
  {
    id: 'variants',
    labelKey: 'home.buildCardGuide.variants',
    anchor: { x: 12, y: 10 },
    side: 'left',
  },
  { id: 'tags', labelKey: 'home.buildCardGuide.tags', anchor: { x: 14, y: 34 }, side: 'left' },
  { id: 'runes', labelKey: 'home.buildCardGuide.runes', anchor: { x: 38, y: 48 }, side: 'left' },
  { id: 'items', labelKey: 'home.buildCardGuide.items', anchor: { x: 34, y: 74 }, side: 'left' },
]

const rightSpots: GuideSpot[] = [
  {
    id: 'version',
    labelKey: 'home.buildCardGuide.version',
    anchor: { x: 88, y: 8 },
    side: 'right',
  },
  { id: 'roles', labelKey: 'home.buildCardGuide.roles', anchor: { x: 90, y: 28 }, side: 'right' },
  {
    id: 'summonerSpells',
    labelKey: 'home.buildCardGuide.summonerSpells',
    anchor: { x: 50, y: 26 },
    side: 'right',
  },
  { id: 'shards', labelKey: 'home.buildCardGuide.shards', anchor: { x: 88, y: 50 }, side: 'right' },
  {
    id: 'firstThreeUps',
    labelKey: 'home.buildCardGuide.firstThreeUps',
    anchor: { x: 72, y: 68 },
    side: 'right',
  },
  {
    id: 'skillMaxOrder',
    labelKey: 'home.buildCardGuide.skillMaxOrder',
    anchor: { x: 86, y: 84 },
    side: 'right',
  },
]

const allSpots: GuideSpot[] = [...topSpots, ...leftSpots, ...rightSpots]

const DESKTOP_MIN = 900

const stageRef = ref<HTMLElement | null>(null)
const cardRef = ref<HTMLElement | null>(null)
const labelRefs = new Map<string, HTMLElement>()
const anchorRefs = new Map<string, HTMLElement>()
const connectorLines = ref<ConnectorLine[]>([])
const stageSize = ref({ w: 0, h: 0 })

let resizeObserver: ResizeObserver | null = null
let lineUpdateFrame = 0

function setLabelRef(id: string, el: Element | ComponentPublicInstance | null) {
  const node = el as HTMLElement | null
  if (node) labelRefs.set(id, node)
  else labelRefs.delete(id)
}

function setAnchorRef(id: string, el: Element | ComponentPublicInstance | null) {
  const node = el as HTMLElement | null
  if (node) anchorRefs.set(id, node)
  else anchorRefs.delete(id)
}

function labelAttachPoint(
  rect: DOMRect,
  stageRect: DOMRect,
  side: SpotSide
): { x: number; y: number } {
  if (side === 'left') {
    return {
      x: rect.right - stageRect.left,
      y: rect.top + rect.height / 2 - stageRect.top,
    }
  }
  if (side === 'right') {
    return {
      x: rect.left - stageRect.left,
      y: rect.top + rect.height / 2 - stageRect.top,
    }
  }
  return {
    x: rect.left + rect.width / 2 - stageRect.left,
    y: rect.bottom - stageRect.top,
  }
}

function updateConnectorLines() {
  if (!import.meta.client) return
  const stage = stageRef.value
  if (!stage || window.innerWidth < DESKTOP_MIN) {
    connectorLines.value = []
    stageSize.value = { w: 0, h: 0 }
    return
  }

  const stageRect = stage.getBoundingClientRect()
  stageSize.value = { w: stage.offsetWidth, h: stage.offsetHeight }

  const next: ConnectorLine[] = []
  for (const spot of allSpots) {
    const labelEl = labelRefs.get(spot.id)
    const anchorEl = anchorRefs.get(spot.id)
    if (!labelEl || !anchorEl) continue

    const labelRect = labelEl.getBoundingClientRect()
    const anchorRect = anchorEl.getBoundingClientRect()
    const start = labelAttachPoint(labelRect, stageRect, spot.side)
    const x2 = anchorRect.left + anchorRect.width / 2 - stageRect.left
    const y2 = anchorRect.top + anchorRect.height / 2 - stageRect.top

    next.push({
      id: spot.id,
      x1: start.x,
      y1: start.y,
      x2,
      y2,
    })
  }
  connectorLines.value = next
}

function scheduleLineUpdate() {
  if (!import.meta.client) return
  cancelAnimationFrame(lineUpdateFrame)
  lineUpdateFrame = requestAnimationFrame(() => {
    nextTick(updateConnectorLines)
  })
}

onMounted(() => {
  scheduleLineUpdate()
  window.addEventListener('resize', scheduleLineUpdate, { passive: true })
  if (typeof ResizeObserver !== 'undefined' && stageRef.value) {
    resizeObserver = new ResizeObserver(() => scheduleLineUpdate())
    resizeObserver.observe(stageRef.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', scheduleLineUpdate)
  resizeObserver?.disconnect()
  cancelAnimationFrame(lineUpdateFrame)
})
</script>

<style scoped>
.home-build-guide {
  margin: 2.5rem auto 0;
  max-width: 72rem;
  padding: 0 0.75rem 2rem;
  text-align: center;
}

.home-build-guide__title {
  margin-bottom: 0.75rem;
  font-family: var(--font-beaufort, ui-sans-serif, system-ui, sans-serif);
  font-size: 1.75rem;
  font-weight: 700;
}

@media (min-width: 768px) {
  .home-build-guide__title {
    font-size: 2.25rem;
  }
}

.home-build-guide__intro {
  margin: 0 auto 1.5rem;
  max-width: 48rem;
  font-size: 1rem;
  line-height: 1.5;
}

.home-build-guide__stage {
  position: relative;
  margin: 0 auto;
  max-width: 68rem;
}

.home-build-guide__lines {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  overflow: visible;
}

.home-build-guide__layout {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
  align-items: start;
  text-align: left;
}

@media (min-width: 900px) {
  .home-build-guide__layout {
    grid-template-columns: minmax(11rem, 1fr) auto minmax(11rem, 1fr);
    gap: 1.25rem 0.75rem;
    align-items: center;
  }
}

.home-build-guide__col {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.home-build-guide__col--left,
.home-build-guide__col--right {
  order: 2;
}

.home-build-guide__center {
  order: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

@media (min-width: 900px) {
  .home-build-guide__col--left {
    order: 0;
    align-self: stretch;
    justify-content: space-between;
    padding-right: 0.25rem;
  }

  .home-build-guide__center {
    order: 0;
  }

  .home-build-guide__col--right {
    order: 0;
    align-self: stretch;
    justify-content: space-between;
    padding-left: 0.25rem;
  }
}

.home-build-guide__col--top {
  width: 100%;
  max-width: 20rem;
  align-items: center;
}

.home-build-guide__item {
  position: relative;
  z-index: 3;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-gold-400);
  border-radius: 4px;
  background: rgba(1, 10, 19, 0.96);
}

.home-build-guide__col--right .home-build-guide__item {
  text-align: right;
}

.home-build-guide__col--top .home-build-guide__item {
  text-align: center;
}

.home-build-guide__text {
  margin: 0;
  color: var(--color-gold-50);
  font-size: 0.8rem;
  line-height: 1.4;
  font-family: var(--font-spiegel, ui-sans-serif, system-ui, sans-serif);
}

@media (min-width: 900px) {
  .home-build-guide__text {
    font-size: 0.78rem;
  }
}

.home-build-guide__card {
  position: relative;
  flex-shrink: 0;
}

.home-build-guide__image {
  display: block;
  width: min(100%, 280px);
  height: auto;
  margin: 0 auto;
  border-radius: 4px;
  box-shadow: 0 0 24px rgba(200, 155, 60, 0.25);
}

@media (min-width: 900px) {
  .home-build-guide__image {
    width: 303px;
  }
}

.home-build-guide__anchor {
  position: absolute;
  z-index: 4;
  width: 8px;
  height: 8px;
  margin: -4px 0 0 -4px;
  border-radius: 50%;
  background: var(--color-gold-300);
  box-shadow: 0 0 8px var(--color-gold-300);
  pointer-events: none;
}

@media (max-width: 899px) {
  .home-build-guide__lines {
    display: none;
  }

  .home-build-guide__anchor {
    display: none;
  }

  .home-build-guide__col--left,
  .home-build-guide__col--right {
    max-width: 28rem;
    margin-left: auto;
    margin-right: auto;
    width: 100%;
  }

  .home-build-guide__col--right .home-build-guide__item {
    text-align: left;
  }
}
</style>
