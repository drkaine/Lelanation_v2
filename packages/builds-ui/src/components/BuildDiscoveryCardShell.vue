<script setup lang="ts">
defineProps<{
  author: string
  showBadge?: boolean
  badgeLabel?: string
}>()
</script>

<template>
  <div class="build-entry">
    <div class="build-meta">
      <h3 class="author">
        {{ author }}
        <span v-if="showBadge" class="perso-badge">{{ badgeLabel }}</span>
      </h3>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.build-entry {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.build-meta {
  width: 300px;
  text-align: center;
}

.author {
  margin: 0;
  color: #f0e6d2;
  font-size: 0.94rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.perso-badge {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  background: rgba(200, 155, 60, 0.25);
  color: #c89b3c;
  border: 1px solid rgba(200, 155, 60, 0.5);
  border-radius: 4px;
  padding: 0.05rem 0.35rem;
  letter-spacing: 0.04em;
}
</style>
