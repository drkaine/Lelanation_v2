<template>
  <button
    type="button"
    class="patch-version-card group flex w-full flex-col overflow-hidden rounded-xl border-2 text-left transition-all"
    :class="
      selected
        ? 'border-accent bg-accent/10 shadow-lg shadow-accent/10'
        : 'border-primary/30 bg-surface/50 hover:border-accent/60 hover:bg-surface'
    "
    @click="$emit('select', version)"
  >
    <div
      class="flex items-center justify-between gap-2 border-b border-primary/20 px-4 py-3"
      :class="selected ? 'bg-accent/15' : 'bg-primary/10'"
    >
      <span class="text-xl font-bold tabular-nums text-text-accent">Patch {{ version }}</span>
      <span
        v-if="isLatest"
        class="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-background"
      >
        {{ latestLabel }}
      </span>
    </div>
    <div class="flex flex-1 flex-col gap-2 p-4">
      <p v-if="date" class="text-xs text-text/60">{{ date }}</p>
      <p v-if="summary" class="line-clamp-3 text-sm leading-relaxed text-text/80">
        {{ summary }}
      </p>
      <div v-if="counts" class="mt-auto flex flex-wrap gap-1.5 pt-2">
        <span
          v-for="chip in countChips"
          :key="chip.key"
          class="rounded-md border border-primary/20 bg-background/50 px-2 py-0.5 text-[10px] font-medium text-text/70"
        >
          {{ chip.label }} {{ chip.value }}
        </span>
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{
  version: string
  date?: string
  summary?: string
  isLatest?: boolean
  selected?: boolean
  latestLabel?: string
  counts?: {
    champions: number
    items: number
    runes: number
    skins: number
  }
}>()

defineEmits<{ select: [version: string] }>()

const countChips = computed(() => {
  if (!props.counts) return []
  return [
    { key: 'champions', label: 'Champ.', value: props.counts.champions },
    { key: 'items', label: 'Items', value: props.counts.items },
    { key: 'runes', label: 'Runes', value: props.counts.runes },
    { key: 'skins', label: 'Skins', value: props.counts.skins },
  ].filter(c => c.value > 0)
})
</script>
