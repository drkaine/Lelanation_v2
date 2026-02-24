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
#app {
  min-height: 100vh;
}
</style>
