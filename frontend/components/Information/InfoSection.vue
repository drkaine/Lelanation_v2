<template>
  <section class="rounded-xl border border-primary/25 bg-surface/30 p-4 sm:p-6">
    <h2 class="text-xl font-bold text-text-accent">{{ title }}</h2>
    <div class="mt-3 space-y-3">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>
