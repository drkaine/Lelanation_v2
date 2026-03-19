<template>
  <div class="build-search w-full flex-shrink-0 sm:w-56 md:w-64 lg:w-72">
    <div class="relative">
      <input
        v-model="localSearchQuery"
        type="text"
        :placeholder="t('buildDiscovery.searchPlaceholder')"
        class="w-full rounded-lg border border-primary bg-surface px-3 py-2 pl-9 text-sm text-text"
        @input="handleSearch"
      />
      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text/50">🔍</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useDebounce } from '~/composables/useDebounce'

const { t } = useI18n()
const discoveryStore = useBuildDiscoveryStore()

const localSearchQuery = ref(discoveryStore.searchQuery)
const debouncedQuery = useDebounce(localSearchQuery, 300)

const handleSearch = () => {
  // Search is handled by debounced watcher
}

watch(debouncedQuery, newQuery => {
  discoveryStore.setSearchQuery(newQuery)
})
</script>
