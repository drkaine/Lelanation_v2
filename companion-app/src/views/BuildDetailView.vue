<script setup lang="ts">
import { ref, computed } from "vue";
import { BuildSheet } from "@lelanation/builds-ui";
import type { ImageResolvers, RuneLookup } from "@lelanation/builds-ui";
import type { Build, SubBuild } from "@lelanation/shared-types";
import { linkifyDescription } from "../utils/linkifyDescription";
import BuildStatsTable from "../components/BuildStatsTable.vue";

const props = defineProps<{
  build: Build;
  imageResolvers: ImageResolvers;
  runeLookup: RuneLookup;
  buildVersion: (b: Build) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
}>();

const emit = defineEmits<{ back: [] }>();

const detailFlipped = ref(false);
const detailSubIdx = ref<number | null>(null);
const activeTab = ref<"description" | "stats">("description");

const detailDisplayedBuild = computed<Build>(() => {
  if (detailSubIdx.value === null) return props.build;
  const sub = props.build.subBuilds?.[detailSubIdx.value] as SubBuild | undefined;
  if (!sub) return props.build;
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
  } as Build;
});

const activeTitle = computed(() => {
  if (detailSubIdx.value === null) return props.build.name || props.build.id;
  const sub = props.build.subBuilds?.[detailSubIdx.value] as SubBuild | undefined;
  return sub?.title || props.build.name || props.build.id;
});

const detailDescription = computed(() =>
  detailSubIdx.value !== null
    ? (props.build.subBuilds?.[detailSubIdx.value]?.description ?? props.build.description)
    : props.build.description
);

function selectVariant(idx: number | null) {
  detailSubIdx.value = idx;
  detailFlipped.value = false;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
</script>

<template>
  <div class="build-detail-page">
    <header class="detail-header">
      <button type="button" class="back-btn" @click="emit('back')">
        ← {{ t('detailBack') }}
      </button>
      <div class="detail-title-wrap">
        <h1 class="detail-title">{{ activeTitle }}</h1>
        <p class="detail-author">{{ build.author || t('authorUnknown') }}</p>
      </div>
    </header>

    <div class="detail-content">
      <div class="detail-layout">
        <div class="detail-card-section">
          <div class="detail-card-wrap">
            <!-- Flip container variantes -->
            <div class="flip-container" :class="{ flipped: detailFlipped }">
              <div class="flip-inner">
                <!-- Face avant -->
                <div class="flip-front">
                  <BuildSheet
                    :build="detailDisplayedBuild"
                    :images="imageResolvers"
                    :rune-lookup="runeLookup"
                    :version="buildVersion(build)"
                  />
                  <button
                    v-if="build.subBuilds && build.subBuilds.length > 0"
                    type="button"
                    class="flip-btn"
                    :title="t('variants')"
                    @click.stop="detailFlipped = !detailFlipped"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flip-icon">
                      <path d="M17 2.1l4 4-4 4"/><path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8M7 21.9l-4-4 4-4"/><path d="M21 11.8v2a4 4 0 0 1-4 4H4.2"/>
                    </svg>
                  </button>
                </div>
                <!-- Face arrière : liste variantes -->
                <div class="flip-back">
                  <div class="back-content">
                    <p class="back-title">{{ build.name || build.id }}</p>
                    <ul class="variant-list">
                      <li>
                        <button
                          type="button"
                          class="variant-btn"
                          :class="{ active: detailSubIdx === null }"
                          @click="selectVariant(null)"
                        >
                          {{ t('mainBuild') }}
                        </button>
                      </li>
                      <li v-for="(sub, si) in build.subBuilds" :key="si">
                        <button
                          type="button"
                          class="variant-btn"
                          :class="{ active: detailSubIdx === si }"
                          @click="selectVariant(si)"
                        >
                          {{ sub.title || `${t('variant')} ${si + 1}` }}
                        </button>
                      </li>
                    </ul>
                    <button type="button" class="flip-btn back-close" @click="detailFlipped = false">✕</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="detail-meta">
            <p v-if="build.createdAt" class="detail-date">
              {{ t('detailCreated') }} {{ formatDate(build.createdAt) }}
            </p>

            <div v-if="detailDescription && activeTab === 'description'" class="detail-description">
              <p class="description-text" v-html="linkifyDescription(detailDescription)" />
            </div>
          </div>
        </div>

        <div class="detail-stats-section">
          <div class="tabs-row">
            <button
              type="button"
              class="tab-btn"
              :class="{ active: activeTab === 'description' }"
              @click="activeTab = 'description'"
            >
              {{ t('detailDescriptionTab') || 'Description' }}
            </button>
            <button
              type="button"
              class="tab-btn"
              :class="{ active: activeTab === 'stats' }"
              @click="activeTab = 'stats'"
            >
              {{ t('stats.title') }}
            </button>
          </div>

          <div v-if="activeTab === 'stats'">
            <h2 class="stats-section-title">{{ t('stats.title') }}</h2>
            <BuildStatsTable :build="detailDisplayedBuild" :t="t" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.build-detail-page {
  max-width: 1320px;
  margin: 0 auto;
  padding: 1rem;
  color: #f0e6d2;
  min-height: 100vh;
}

.detail-header {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 1.5rem;
}

.back-btn {
  flex-shrink: 0;
  border: 1px solid rgba(200, 155, 60, 0.5);
  border-radius: 8px;
  background: rgba(30, 40, 45, 0.8);
  color: #c8aa6e;
  padding: 0.5rem 0.9rem;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}
.back-btn:hover {
  background: rgba(200, 155, 60, 0.2);
  border-color: #c89b3c;
  color: #f0e6d2;
}

.detail-title-wrap {
  flex: 1;
  text-align: center;
  margin: 0 1rem;
}

.detail-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #f0e6d2;
}

.detail-author {
  margin: 0.35rem 0 0;
  font-size: 0.9rem;
  color: rgba(240, 230, 210, 0.75);
}

.detail-content {
  width: 100%;
}

.detail-layout {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

@media (min-width: 900px) {
  .detail-layout {
    flex-direction: row;
    align-items: flex-start;
    justify-content: center;
  }
}

.detail-card-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
}

.detail-card-wrap {
  flex-shrink: 0;
}

.detail-meta {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.detail-date {
  margin: 0;
  font-size: 0.82rem;
  color: rgba(240, 230, 210, 0.6);
}

.detail-description {
  width: 100%;
  text-align: left;
}

.description-text {
  margin: 0;
  font-size: 0.88rem;
  color: rgba(240, 230, 210, 0.9);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.description-text :deep(.linkified) {
  color: #c89b3c;
  text-decoration: underline;
}
.description-text :deep(.linkified:hover) {
  color: #e6b800;
}

/* ── Flip card ─────────────────────────────────────────────────────── */
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
  top: 0; left: 0;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
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
.flip-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 28px;
  height: 28px;
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
.flip-icon { width: 14px; height: 14px; }
.back-close {
  position: static;
  width: auto;
  height: auto;
  border-radius: 6px;
  padding: 0.3rem 0.6rem;
  font-size: 0.82rem;
  margin-top: 0.4rem;
}

.detail-stats-section {
  width: 100%;
  max-width: 520px;
  padding: 1rem;
  border: 1px solid rgba(200, 155, 60, 0.3);
  border-radius: 10px;
  background: rgba(30, 40, 45, 0.5);
}

.tabs-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.tab-btn {
  border: 1px solid rgba(200, 155, 60, 0.5);
  border-radius: 8px;
  background: rgba(30, 40, 45, 0.75);
  color: #f0e6d2;
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.tab-btn.active {
  background: rgba(200, 155, 60, 0.25);
  border-color: #c89b3c;
  color: #f0e6d2;
}

@media (min-width: 900px) {
  .detail-stats-section {
    flex: 1;
    min-width: 0;
    max-width: 480px;
  }
}

.stats-section-title {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  font-weight: 600;
  color: #c8aa6e;
}
</style>
