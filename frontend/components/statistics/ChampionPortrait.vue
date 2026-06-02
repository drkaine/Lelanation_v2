<script setup lang="ts">
import { computed, ref } from 'vue'
import { championFallbackColor, championInitials } from '~/utils/championDisplay'

const props = withDefaults(
  defineProps<{
    src?: string | null
    alt?: string
    championId?: string | number
    championName?: string
    size?: number
    rounded?: 'none' | 'sm' | 'full'
  }>(),
  { size: 32, rounded: 'none', alt: '', src: null, championId: undefined, championName: '' }
)

const loaded = ref(false)
const failed = ref(false)

const initials = computed(() =>
  championInitials(props.championName || props.alt || '', props.championId)
)
const fallbackBg = computed(() =>
  championFallbackColor(props.championId ?? props.championName ?? props.alt ?? 0)
)
const sizePx = computed(() => `${props.size}px`)

function onLoad(): void {
  loaded.value = true
}
function onError(): void {
  failed.value = true
}
</script>

<template>
  <span
    class="champion-portrait relative inline-flex shrink-0 overflow-hidden border border-black/60 bg-text-secondary/25"
    :class="{
      'rounded-sm': rounded === 'sm',
      'rounded-full': rounded === 'full',
    }"
    :style="{ width: sizePx, height: sizePx, minWidth: sizePx, minHeight: sizePx }"
  >
    <span
      v-if="src && !failed && !loaded"
      class="absolute inset-0 animate-pulse bg-text-secondary/30"
      aria-hidden="true"
    />
    <img
      v-if="src && !failed"
      :src="src"
      :alt="alt"
      loading="lazy"
      decoding="async"
      class="h-full w-full object-cover"
      :class="loaded ? 'opacity-100' : 'opacity-0'"
      @load="onLoad"
      @error="onError"
    />
    <span
      v-else
      class="flex h-full w-full items-center justify-center text-[10px] font-bold uppercase leading-none text-white"
      :style="{
        backgroundColor: fallbackBg,
        fontSize: size >= 56 ? '14px' : size >= 40 ? '12px' : '10px',
      }"
    >
      {{ initials }}
    </span>
  </span>
</template>
