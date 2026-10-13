<template>
  <div class="ig-metric">
    <h3 class="ig-metric-title">{{ t(`${prefix}.title`) }}</h3>
    <p class="ig-metric-def">{{ t(`${prefix}.definition`) }}</p>
    <pre class="ig-metric-formula">{{ t(`${prefix}.formula`) }}</pre>
    <p class="ig-metric-example">
      <Icon name="mdi:lightbulb-on-outline" size="14px" aria-hidden="true" />
      {{ t(`${prefix}.example`) }}
    </p>
  </div>
</template>

<script setup lang="ts">
/** Carte métrique « gaming » : titre, définition, formule, exemple (clés `${prefix}.*`). */
defineProps<{ prefix: string }>()

const { t } = useI18n()
</script>

<style scoped>
.ig-metric {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
  border: 1px solid rgb(var(--rgb-accent) / 0.22);
  border-left: 3px solid var(--color-accent);
  border-radius: 0.6rem;
  background: rgb(var(--rgb-chrome) / 0.55);
  padding: 0.9rem 1rem;
}

.ig-metric-title {
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-accent);
}

.ig-metric-def {
  font-size: 0.875rem;
  color: rgb(var(--rgb-text) / 0.82);
}

.ig-metric-formula {
  overflow-x: auto;
  white-space: pre-wrap;
  border: 1px solid rgb(var(--rgb-accent) / 0.2);
  border-radius: 0.4rem;
  background: var(--color-blue-600);
  padding: 0.5rem 0.75rem;
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
  line-height: 1.6;
  color: var(--color-text-accent);
}

.ig-metric-example {
  display: flex;
  gap: 0.35rem;
  font-size: 0.8rem;
  font-style: italic;
  color: rgb(var(--rgb-text) / 0.62);
}
</style>
