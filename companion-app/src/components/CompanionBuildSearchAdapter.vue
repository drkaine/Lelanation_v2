<template>
  <div class="w-full flex-shrink-0 sm:w-56 md:w-64 lg:w-72">
    <div class="relative">
      <input
        v-model="ctx.searchQuery.value"
        type="text"
        :placeholder="ctx.t('search')"
        class="w-full rounded-lg border border-primary bg-surface px-3 py-2 pl-9 text-sm text-text"
      />
      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text/50">🔍</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from "vue";
import { CompanionBuildsUiKey } from "../buildsUiContext";

const ctx = inject(CompanionBuildsUiKey);
if (!ctx) throw new Error("CompanionBuildSearchAdapter requires CompanionBuildsUiKey provider");
</script>
