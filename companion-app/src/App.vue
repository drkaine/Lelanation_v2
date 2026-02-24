<script setup lang="ts">
import { ref, onMounted } from "vue";
import { hasConsent } from "./consent";
import ConsentView from "./views/ConsentView.vue";
import MainView from "./views/MainView.vue";

const consented = ref(false);

onMounted(() => {
  consented.value = hasConsent();
});

function onConsentAccepted() {
  consented.value = true;
}
</script>

<template>
  <ConsentView v-if="!consented" @accepted="onConsentAccepted" />
  <MainView v-else />
</template>

<style>
:root {
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  color: #0f0f0f;
  background-color: #f6f6f6;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
body {
  margin: 0;
}
#app {
  min-height: 100vh;
}
</style>
