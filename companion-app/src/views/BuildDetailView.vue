<script setup lang="ts">
import { BuildSheet } from "@lelanation/builds-ui";
import type { ImageResolvers, RuneLookup } from "@lelanation/builds-ui";
import type { Build } from "@lelanation/shared-types";
import { linkifyDescription } from "../utils/linkifyDescription";
import BuildStatsTable from "../components/BuildStatsTable.vue";

defineProps<{
  build: Build;
  imageResolvers: ImageResolvers;
  runeLookup: RuneLookup;
  buildVersion: (b: Build) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
}>();

const emit = defineEmits<{ back: [] }>();

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
        <h1 class="detail-title">{{ build.name || build.id }}</h1>
        <p class="detail-author">{{ build.author || t('authorUnknown') }}</p>
      </div>
    </header>

    <div class="detail-content">
      <div class="detail-layout">
        <div class="detail-card-section">
          <div class="detail-card-wrap">
            <BuildSheet
              :build="build"
              :images="imageResolvers"
              :rune-lookup="runeLookup"
              :version="buildVersion(build)"
            />
          </div>

          <div class="detail-meta">
            <p v-if="build.createdAt" class="detail-date">
              {{ t('detailCreated') }} {{ formatDate(build.createdAt) }}
            </p>

            <div v-if="build.description" class="detail-description">
              <p
                class="description-text"
                v-html="linkifyDescription(build.description)"
              />
            </div>
          </div>
        </div>

        <div class="detail-stats-section">
          <h2 class="stats-section-title">{{ t('stats.title') }}</h2>
          <BuildStatsTable :build="build" :t="t" />
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
