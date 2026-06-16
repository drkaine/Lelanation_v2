<script setup lang="ts">
import { onMounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import OnboardingView from "./views/OnboardingView.vue";
import BuildsView from "./views/BuildsView.vue";
import type { CompanionConfig } from "./companionConfig";

const booted = ref(false);
const needsOnboarding = ref(true);
const isDev = import.meta.env.DEV;
const DEV_ONBOARDING_BYPASS_KEY = "lelanation-companion-dev-onboarding-bypass";

function devSkipsOnboarding(): boolean {
  if (!isDev) return false;
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(DEV_ONBOARDING_BYPASS_KEY) !== "0";
}

onMounted(async () => {
  try {
    const cfg = await invoke<CompanionConfig>("companion_get_config");
    needsOnboarding.value = cfg.onboardingComplete !== true && !devSkipsOnboarding();
  } catch {
    needsOnboarding.value = !devSkipsOnboarding();
  } finally {
    booted.value = true;
  }
});

function onOnboardingDone() {
  needsOnboarding.value = false;
}
</script>

<template>
  <div v-if="booted" class="app-root">
    <OnboardingView v-if="needsOnboarding" @done="onOnboardingDone" />
    <BuildsView v-else />
  </div>
  <div v-else class="boot">…</div>
</template>

<style>
:root {
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  font-size: 15px;
  line-height: 1.45;
  font-weight: 400;
  color: #f0e6d2;
  background:
    radial-gradient(circle at 15% 10%, rgba(3, 151, 171, 0.22), transparent 38%),
    linear-gradient(135deg, #0a1428 0%, #091428 45%, #0a323c 100%);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
body {
  margin: 0;
  color: #f0e6d2;
  background: transparent;
}
html,
body,
#app {
  height: 100%;
  overflow: hidden;
}
#app,
.app-root {
  height: 100%;
  min-height: 100vh;
  min-height: 100dvh;
}
.app-root {
  display: flex;
  flex-direction: column;
}
.boot {
  padding: 2rem;
  text-align: center;
  color: rgba(240, 230, 210, 0.85);
}
</style>
