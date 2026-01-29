<template>
  <footer class="border-t border-primary/30 bg-surface/50 py-6 text-text/60">
    <div class="max-w-8xl mx-auto px-4">
      <div class="flex flex-col items-center justify-center gap-2 text-xs md:flex-row md:gap-4">
        <span class="text-text/50">© {{ currentYear }} Lelanation</span>
        <span class="hidden md:inline">•</span>
        <NuxtLink to="/legal" class="transition-colors hover:text-accent" title="Mentions légales">
          Mentions légales
        </NuxtLink>
        <span class="hidden md:inline">•</span>
        <NuxtLink
          to="/privacy"
          class="transition-colors hover:text-accent"
          title="Politique de confidentialité"
        >
          Confidentialité & Cookies
        </NuxtLink>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
const currentYear = new Date().getFullYear()
</script>

<style scoped>
footer {
  margin-top: auto;
}
</style>
