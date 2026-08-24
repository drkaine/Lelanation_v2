<template>
  <button
    type="button"
    class="item-category-sort-btn ui-build-card-button"
    :class="{ 'is-active': active }"
    :title="title"
    :aria-label="title"
    @click="emit('click')"
  >
    <svg
      class="item-category-sort-btn__icon"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"
      />
    </svg>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  active?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<style scoped>
.item-category-sort-btn {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.125rem;
  height: 2.125rem;
  padding: 0;
  border: 1px solid rgb(var(--rgb-accent) / 0.25);
  border-radius: 0.5rem;
  background: rgb(var(--rgb-background) / 0.35);
  color: rgb(var(--rgb-text) / 0.85);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.item-category-sort-btn.is-active,
.item-category-sort-btn:hover {
  border-color: rgb(var(--rgb-accent) / 0.65);
  background: rgb(var(--rgb-accent) / 0.15);
  color: var(--color-accent);
}

.item-category-sort-btn__icon {
  width: 1.125rem;
  height: 1.125rem;
}
</style>
