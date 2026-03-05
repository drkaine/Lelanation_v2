<script setup lang="ts">
import { ref, computed } from "vue";
import { BuildCardFlip } from "@lelanation/builds-ui";
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

const detailSubIdx = ref<number | null>(null);

const hasDescription = computed(() => {
  if (props.build.description?.trim()) return true;
  return (props.build.subBuilds ?? []).some(
    (s) => (s as SubBuild).description?.trim()
  );
});

const activeTab = ref<"description" | "stats">(
  hasDescription.value ? "description" : "stats"
);

/** Merged build for the stats table (mirrors the merge logic inside BuildCardFlip). */
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

function handleVariantChange(idx: number | null) {
  detailSubIdx.value = idx;
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
            <!-- Flip card : face avant = BuildSheet, face arrière = liste variantes -->
            <BuildCardFlip
              :build="build"
              :images="imageResolvers"
              :rune-lookup="runeLookup"
              :version="buildVersion(build)"
              :main-build-label="t('mainBuild')"
              :variant-label-fn="i => `${t('variant')} ${i + 1}`"
              @variant-change="handleVariantChange"
            />
          </div>

          <div class="detail-meta">
            <p v-if="build.createdAt" class="detail-date">
              {{ t('detailCreated') }} {{ formatDate(build.createdAt) }}
            </p>
          </div>
        </div>

        <div class="detail-stats-section">
          <div class="tabs-row">
            <button
              v-if="hasDescription"
              type="button"
              class="tab-btn"
              :class="{ active: activeTab === 'description' }"
              @click="activeTab = 'description'"
            >
              {{ t('detailDescriptionTab') }}
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

          <div class="tab-content">
            <div v-if="activeTab === 'description' && hasDescription" class="detail-description">
              <h2 class="tab-content-title">{{ t('detailDescriptionTab') }}</h2>
              <p class="description-text" v-html="linkifyDescription(detailDescription ?? '')" />
            </div>

            <div v-if="activeTab === 'stats'" class="detail-stats">
              <h2 class="stats-section-title">{{ t('stats.title') }}</h2>
              <BuildStatsTable :build="detailDisplayedBuild" :t="t" />
            </div>
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

.tab-content {
  margin-top: 0;
  min-height: 120px;
}

.tab-content-title {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: #c8aa6e;
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
