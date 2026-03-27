<template>
  <div class="flex flex-1 flex-wrap items-center gap-2">
    <div class="flex items-center gap-1 overflow-x-auto whitespace-nowrap">
      <button
        v-for="role in ctx.roleOptions.value"
        :key="role.value"
        type="button"
        class="inline-flex h-7 w-7 items-center justify-center rounded-full p-0 transition-all"
        :class="ctx.selectedRole.value === role.value ? 'bg-accent/15' : 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0'"
        :title="role.label"
        @click="ctx.selectedRole.value = ctx.selectedRole.value === role.value ? null : role.value"
      >
        <img :src="role.icon" alt="" class="h-5 w-5" />
      </button>
    </div>

    <label class="inline-flex items-center gap-1 text-sm text-text-secondary">
      <input v-model="ctx.onlyUpToDate.value" type="checkbox" />
      <span>{{ ctx.t("upToDate") }}</span>
    </label>

    <select v-model="ctx.sortBy.value" class="filter-select">
      <option v-for="opt in ctx.sortOptions.value" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>

    <button v-if="ctx.hasActiveFilters.value" class="filter-clear" @click="ctx.clearFilters()">
      {{ ctx.t("clearFilters") }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { inject } from "vue";
import { CompanionBuildsUiKey } from "../buildsUiContext";

const ctx = inject(CompanionBuildsUiKey);
if (!ctx) throw new Error("CompanionBuildFiltersAdapter requires CompanionBuildsUiKey provider");
</script>

<style scoped>
.filter-select {
  min-width: 7.5rem;
  border-radius: 0.5rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.8);
  background: rgb(var(--rgb-background) / 0.25);
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
  color: rgb(var(--rgb-text));
}
.filter-clear {
  border-radius: 0.5rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.8);
  background: rgb(var(--rgb-background) / 0.25);
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
  color: rgb(var(--rgb-text));
}
</style>
