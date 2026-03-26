<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Build, SubBuild } from '@lelanation/shared-types'
import BuildSheet from './BuildSheet.vue'
import type { ImageResolvers, RuneLookup } from './BuildSheet.vue'

const props = defineProps<{
  build: Build
  images: ImageResolvers
  runeLookup: RuneLookup
  version?: string
  /** Label for the main build button in the variant list. Defaults to 'Build principal'. */
  mainBuildLabel?: string
  /** Returns the label for sub-build at index i. Defaults to `Variante ${i + 1}`. */
  variantLabelFn?: (index: number) => string
}>()

const emit = defineEmits<{
  'variant-change': [subIndex: number | null]
}>()

const flipped = ref(false)
const subIdx = ref<number | null>(null)

const subBuilds = computed(() => (props.build.subBuilds as SubBuild[] | undefined) ?? [])
const variantCount = computed(() => 1 + subBuilds.value.length)

function isDefaultBuildName(name: string | null | undefined): boolean {
  if (!name) return true
  const trimmed = name.trim()
  if (!trimmed) return true
  return trimmed.toLowerCase() === 'new build'
}

/** Title to display on the card in place of the champion name. undefined = show champion name. */
const cardTitle = computed<string | undefined>(() => {
  if (subIdx.value === null) {
    if (!isDefaultBuildName(props.build.name)) return props.build.name as string
    return undefined
  }
  const sub = subBuilds.value[subIdx.value]
  if (sub?.title && sub.title.trim()) return sub.title
  if (!isDefaultBuildName(props.build.name)) return props.build.name as string
  return undefined
})

const displayedBuild = computed<Build>(() => {
  if (subIdx.value === null) return props.build
  const sub = subBuilds.value[subIdx.value]
  if (!sub) return props.build
  return {
    ...props.build,
    items: sub.items,
    runes: sub.runes,
    shards: sub.shards,
    summonerSpells: sub.summonerSpells,
    skillOrder: sub.skillOrder,
    roles: sub.roles,
    description: sub.description ?? props.build.description,
    gameVersion: sub.gameVersion || props.build.gameVersion,
  } as Build
})

function getVariantLabel(i: number): string {
  return props.variantLabelFn ? props.variantLabelFn(i) : `Variante ${i + 1}`
}

function selectVariant(idx: number | null) {
  subIdx.value = idx
  flipped.value = false
  emit('variant-change', idx)
}
</script>

<template>
  <div class="flip-container" :class="{ flipped }">
    <div class="flip-inner">
      <!-- Front face: BuildSheet + optional flip button -->
      <div class="flip-front">
        <BuildSheet
          :build="displayedBuild"
          :images="images"
          :rune-lookup="runeLookup"
          :version="version"
          :title="cardTitle"
        />
        <button
          v-if="subBuilds.length > 0"
          type="button"
          class="flip-btn"
          @click.stop="flipped = !flipped"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="flip-icon"
          >
            <path d="M17 2.1l4 4-4 4" />
            <path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8M7 21.9l-4-4 4-4" />
            <path d="M21 11.8v2a4 4 0 0 1-4 4H4.2" />
          </svg>
          <span class="flip-badge">{{ variantCount }}</span>
        </button>
      </div>

      <!-- Back face: variant selector list -->
      <div class="flip-back">
        <div class="back-content">
          <p class="back-title">{{ build.name || build.id }}</p>
          <ul class="variant-list">
            <li>
              <button
                type="button"
                class="variant-btn"
                :class="{ active: subIdx === null }"
                @click="selectVariant(null)"
              >
                {{ mainBuildLabel ?? 'Build principal' }}
              </button>
            </li>
            <li v-for="(sub, i) in subBuilds" :key="i">
              <button
                type="button"
                class="variant-btn"
                :class="{ active: subIdx === i }"
                @click="selectVariant(i)"
              >
                {{ sub.title || getVariantLabel(i) }}
              </button>
            </li>
          </ul>
          <button type="button" class="flip-btn back-close" @click="flipped = false">✕</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Flip container ──────────────────────────────────────────────────── */
.flip-container {
  perspective: 1000px;
  width: 300px;
  height: 450px;
  position: relative;
}

.flip-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}

.flip-container.flipped .flip-inner {
  transform: rotateY(180deg);
}

.flip-front,
.flip-back {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

/* ── Back face ───────────────────────────────────────────────────────── */
.flip-back {
  transform: rotateY(180deg);
  background: linear-gradient(135deg, #0a1428 0%, #091428 45%, #0a323c 100%);
  border: 2px solid #c89b3c;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 1rem;
  width: 100%;
}

.back-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #c89b3c;
  text-align: center;
}

.variant-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 100%;
}

.variant-btn {
  width: 100%;
  background: rgba(30, 40, 45, 0.8);
  border: 1px solid rgba(200, 155, 60, 0.4);
  border-radius: 6px;
  color: #c8aa6e;
  padding: 0.4rem 0.75rem;
  font-size: 0.82rem;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}

.variant-btn:hover,
.variant-btn.active {
  background: rgba(200, 155, 60, 0.2);
  border-color: #c89b3c;
  color: #f0e6d2;
}

/* ── Flip button ─────────────────────────────────────────────────────── */
.flip-btn {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid rgba(200, 155, 60, 0.6);
  background: rgba(10, 20, 40, 0.85);
  color: #c89b3c;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  z-index: 5;
}

.flip-btn:hover {
  background: rgba(200, 155, 60, 0.2);
  border-color: #c89b3c;
}

.flip-icon {
  width: 14px;
  height: 14px;
}

.flip-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: #c89b3c;
  color: #0a1428;
  font-size: 9px;
  font-weight: 700;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.back-close {
  position: static;
  width: auto;
  height: auto;
  border-radius: 6px;
  padding: 0.3rem 0.6rem;
  font-size: 0.82rem;
  margin-top: 0.4rem;
}
</style>
