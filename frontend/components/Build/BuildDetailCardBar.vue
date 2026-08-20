<template>
  <div class="build-detail-card-bar mb-[3px] flex w-full items-center gap-2">
    <div class="build-detail-card-bar__icon-slot">
      <slot name="icon">
        <div class="build-detail-card-bar__icon-spacer" aria-hidden="true" />
      </slot>
    </div>
    <div class="build-detail-card-bar__author-row">
      <span class="truncate">
        {{ author?.trim() || t('buildDiscovery.anonymous') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  author?: string | null
}>()

const { t } = useI18n()
</script>

<style scoped>
.build-detail-card-bar__icon-slot {
  width: 28px;
  flex-shrink: 0;
}

.build-detail-card-bar__icon-spacer {
  width: 28px;
  height: 28px;
}

.build-detail-card-bar__author-row {
  display: flex;
  min-width: 0;
  flex: 1;
  min-height: 28px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 6px;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-gold-300);
  text-align: center;
  text-transform: uppercase;
}
</style>
