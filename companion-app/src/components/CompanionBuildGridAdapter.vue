<template>
  <div class="build-grid-list">
    <div v-for="build in builds" :key="build.id" class="build-grid-item">
      <div class="mb-[3px] flex w-full items-center justify-center">
        <div class="build-grid-author-row">
          <span class="truncate font-semibold">
            {{ build.author || ctx.t("authorUnknown") }}
          </span>
          <span v-if="ctx.importedBuildIds.value.has(build.id)" class="perso-badge">{{ ctx.t("badge.personal") }}</span>
        </div>
      </div>

      <BuildCardFlip
        :build="build"
        :images="ctx.imageResolvers.value"
        :rune-lookup="ctx.runeLookup.value"
        :version="ctx.buildVersion(build)"
        :main-build-label="ctx.t('mainBuild')"
        :variant-label-fn="i => `${ctx.t('variant')} ${i + 1}`"
        @variant-change="idx => ctx.onVariantChange(build.id, idx)"
      />

      <div class="mt-[5px] flex w-full items-stretch justify-end gap-1.5">
        <button class="action-btn" @click="ctx.toggleFavorite(build.id)">★</button>
        <button class="action-btn" @click="ctx.openDetail(build)">{{ ctx.t("detail") }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import type { Build } from "@lelanation/shared-types";
import { BuildCardFlip } from "@lelanation/builds-ui";
import { CompanionBuildsUiKey } from "../buildsUiContext";

interface Props {
  customBuilds?: Build[];
}

const props = defineProps<Props>();
const ctx = inject(CompanionBuildsUiKey);
if (!ctx) throw new Error("CompanionBuildGridAdapter requires CompanionBuildsUiKey provider");

const builds = computed(() => props.customBuilds ?? ctx.discoverBuilds.value);
</script>

<style scoped>
.build-grid-list { display: flex; flex-wrap: wrap; justify-content: space-evenly; gap: 10px; }
.build-grid-item { width: min(100%, 300px); display: flex; flex-direction: column; gap: 0; }
.build-grid-author-row { display: flex; align-items: center; justify-content: center; gap: 6px; color: #c8aa6e; font-weight: 700; text-transform: uppercase; min-height: 28px; }
.perso-badge { font-size: 0.6rem; font-weight: 700; border: 1px solid rgba(200,155,60,.5); border-radius: 4px; padding: 0.05rem 0.35rem; }
.action-btn { border: 1px solid rgba(200,155,60,.6); border-radius: 8px; background: rgba(10,20,40,.35); color: #c8aa6e; padding: 0.3rem 0.6rem; font-size: 0.75rem; }
</style>
