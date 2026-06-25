<template>
  <div
    ref="rootEl"
    class="matchup-guide-search flex shrink-0 transition-[width] duration-200 ease-out"
    :class="expanded ? 'w-full sm:w-56 md:w-64 lg:w-72' : 'w-auto'"
  >
    <button
      v-show="!expanded"
      type="button"
      class="search-toggle inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-primary/80 bg-background/25 text-text transition-colors hover:bg-primary/20"
      :aria-label="t('matchupGuideDiscovery.searchPlaceholder')"
      :aria-expanded="false"
      @click="expand"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5 text-text/70"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </button>
    <div v-show="expanded" class="relative min-w-0 flex-1">
      <input
        ref="inputRef"
        v-model="localSearchQuery"
        type="text"
        :placeholder="t('matchupGuideDiscovery.searchPlaceholder')"
        class="w-full rounded-lg border border-primary bg-surface px-3 py-2 pl-9 text-sm text-text"
        :aria-label="t('matchupGuideDiscovery.searchPlaceholder')"
        :aria-expanded="true"
      />
      <span
        class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text/50"
        aria-hidden="true"
      >
        🔍
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMatchupGuideDiscoveryStore } from '~/stores/MatchupGuideDiscoveryStore'
import { useDebounce } from '~/composables/useDebounce'

const { t } = useI18n()
const discoveryStore = useMatchupGuideDiscoveryStore()

const rootEl = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const expanded = ref(Boolean(discoveryStore.searchQuery.trim()))

const localSearchQuery = ref(discoveryStore.searchQuery)
const debouncedQuery = useDebounce(localSearchQuery, 300)

function expand() {
  expanded.value = true
  nextTick(() => inputRef.value?.focus())
}

function onDocClick(e: MouseEvent) {
  if (!expanded.value || !rootEl.value) return
  const target = e.target
  if (target instanceof Node && rootEl.value.contains(target)) return
  if (!localSearchQuery.value.trim()) {
    expanded.value = false
  }
}

watch(debouncedQuery, value => {
  discoveryStore.setSearchQuery(value)
})

onMounted(() => {
  document.addEventListener('click', onDocClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
})
</script>
