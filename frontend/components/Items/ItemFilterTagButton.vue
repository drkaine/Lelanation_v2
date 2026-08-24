<template>
  <button
    type="button"
    class="item-filter-btn ui-build-card-button text-sm font-semibold"
    :class="{ 'is-active': active }"
    @click="emit('click')"
  >
    <span
      v-if="iconSrc"
      class="stat-inline-icon stat-inline-icon--sm shrink-0"
      :class="iconToneClass"
    >
      <img
        :src="iconSrc"
        alt=""
        class="stat-inline-icon-image"
        :class="iconImageClass"
        width="16"
        height="16"
      />
    </span>
    <span>{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  iconSrc?: string | null
  iconToneClass?: string
  iconImageClass?: string
  active?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<style scoped>
.item-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.6rem;
  margin: 0;
}
</style>
