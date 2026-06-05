<template>
  <article
    class="patch-summary-card group flex h-full flex-col overflow-hidden rounded-xl border bg-surface/60 transition-all hover:-translate-y-0.5 hover:shadow-lg"
    :class="borderClass"
  >
    <div class="relative flex items-center justify-center px-4 py-4" :class="headerClass">
      <img
        v-if="entity.image_url"
        :src="entity.image_url"
        :alt="displayName"
        class="h-14 w-14 rounded-lg object-cover shadow ring-2 ring-background/30"
        loading="lazy"
      />
      <div
        v-else
        class="flex h-14 w-14 items-center justify-center rounded-lg bg-background/50 text-sm font-bold text-text/40"
      >
        {{ initials }}
      </div>
      <span
        class="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
        :class="badgeClass"
      >
        {{ typeLabel }}
      </span>
    </div>

    <div class="flex flex-1 flex-col gap-2 border-t border-primary/15 p-3">
      <h3 class="text-sm font-bold leading-tight text-text">{{ displayName }}</h3>
      <p class="line-clamp-2 flex-1 text-xs leading-relaxed text-text/70">
        {{ primaryChangeText }}
      </p>
      <p v-if="entity.changes.length > 1" class="text-[10px] font-medium text-text/45">
        +{{ entity.changes.length - 1 }} {{ moreChangesLabel }}
      </p>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { PatchChangeType, PatchEntity } from '~/stores/PatchNotesStore'

const props = defineProps<{
  entity: PatchEntity
  lang: 'fr' | 'en'
  moreChangesLabel?: string
}>()

const displayName = computed(() =>
  props.lang === 'fr' ? props.entity.name_fr : props.entity.name_en
)

const initials = computed(() => displayName.value.slice(0, 2).toUpperCase())

const primaryChangeText = computed(() => {
  const change = props.entity.changes[0]
  if (!change) return ''
  const desc = props.lang === 'fr' ? change.description_fr : change.description_en
  if (desc) return desc
  return `${change.stat}: ${change.old_value} → ${change.new_value}`
})

const typeLabel = computed(() => {
  const labels: Record<PatchChangeType, string> = {
    buff: 'Buff',
    nerf: 'Nerf',
    adjust: 'Adjust',
    rework: 'Rework',
  }
  return labels[props.entity.global_type] ?? props.entity.global_type
})

const badgeClass = computed(
  () =>
    ({
      buff: 'bg-[#3B6D11] text-white',
      nerf: 'bg-[#A32D2D] text-white',
      adjust: 'bg-[#854F0B] text-white',
      rework: 'bg-primary text-white',
    })[props.entity.global_type] ?? 'bg-surface text-text/70'
)

const borderClass = computed(
  () =>
    ({
      buff: 'border-[#3B6D11]/35 hover:border-[#3B6D11]/70',
      nerf: 'border-[#A32D2D]/35 hover:border-[#A32D2D]/70',
      adjust: 'border-[#854F0B]/35 hover:border-[#854F0B]/70',
      rework: 'border-primary/35 hover:border-primary/70',
    })[props.entity.global_type] ?? 'border-primary/25'
)

const headerClass = computed(
  () =>
    ({
      buff: 'bg-[#3B6D11]/10',
      nerf: 'bg-[#A32D2D]/10',
      adjust: 'bg-[#854F0B]/10',
      rework: 'bg-primary/10',
    })[props.entity.global_type] ?? 'bg-background/40'
)
</script>
