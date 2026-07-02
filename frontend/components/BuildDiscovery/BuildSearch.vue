<template>
  <div
    ref="rootEl"
    class="build-search flex shrink-0 transition-[width] duration-200 ease-out"
    :class="expanded ? 'w-full sm:w-56 md:w-64 lg:w-72' : 'w-auto'"
  >
    <button
      v-show="!expanded"
      type="button"
      class="ui-build-card-button search-toggle inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center"
      :aria-label="t('buildDiscovery.searchPlaceholder')"
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
        :placeholder="t('buildDiscovery.searchPlaceholder')"
        class="w-full rounded-lg border border-primary/50 bg-background/25 px-3 py-2 pl-9 text-sm text-text placeholder:text-text/50 focus:border-accent focus:outline-none"
        :aria-label="t('buildDiscovery.searchPlaceholder')"
        :aria-expanded="true"
        @input="handleSearch"
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
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useDebounce } from '~/composables/useDebounce'

const { t } = useI18n()
const discoveryStore = useBuildDiscoveryStore()

const rootEl = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const expanded = ref(Boolean(discoveryStore.searchQuery.trim()))

const localSearchQuery = ref(discoveryStore.searchQuery)
const debouncedQuery = useDebounce(localSearchQuery, 300)

const handleSearch = () => {
  // Search is handled by debounced watcher
}

function expand() {
  expanded.value = true
}

function onDocClick(e: MouseEvent) {
  if (!expanded.value || !rootEl.value) return
  const t = e.target
  if (t instanceof Node && rootEl.value.contains(t)) return
  expanded.value = false
}

watch(debouncedQuery, newQuery => {
  discoveryStore.setSearchQuery(newQuery)
})

watch(expanded, isExp => {
  if (isExp) {
    nextTick(() => inputRef.value?.focus())
  }
})

watch(
  () => discoveryStore.searchQuery,
  q => {
    if (q !== localSearchQuery.value) localSearchQuery.value = q
    if (q.trim()) expanded.value = true
  }
)

onMounted(() => {
  document.addEventListener('click', onDocClick, true)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick, true)
})
</script>
