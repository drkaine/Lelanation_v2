<template>
  <article
    class="patch-entity-card flex h-full flex-col overflow-hidden rounded-xl border-2 bg-surface/50 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
    :class="borderClass"
  >
    <div class="relative flex items-center justify-center border-b px-4 py-5" :class="headerClass">
      <img
        v-if="entity.image_url"
        :src="entity.image_url"
        :alt="displayName"
        class="h-16 w-16 rounded-lg object-cover shadow-md ring-2 ring-background/40"
        loading="lazy"
      />
      <div
        v-else
        class="flex h-16 w-16 items-center justify-center rounded-lg bg-background/60 text-lg font-bold text-text/50"
      >
        {{ initials }}
      </div>
      <span
        class="absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
        :class="badgeClass"
      >
        {{ typeLabel }}
      </span>
    </div>

    <div class="flex flex-1 flex-col p-4">
      <h3 class="text-center text-base font-bold text-text">{{ displayName }}</h3>
      <p class="mt-0.5 text-center text-[10px] text-text/45">#{{ entity.ddragon_id }}</p>

      <ul class="mt-3 flex flex-1 flex-col gap-2">
        <li
          v-for="(change, idx) in entity.changes"
          :key="`${entity.slug}-${idx}`"
          class="rounded-lg border border-primary/15 bg-background/35 p-2.5"
        >
          <p class="text-xs font-semibold text-text/90">{{ change.stat }}</p>
          <div class="mt-1.5 flex flex-wrap items-center justify-center gap-1.5 text-xs">
            <span
              class="rounded bg-error/15 px-1.5 py-0.5 font-mono text-error line-through decoration-error/60"
            >
              {{ change.old_value }}
            </span>
            <span class="text-text/35" aria-hidden="true">→</span>
            <span
              class="rounded px-1.5 py-0.5 font-mono font-semibold"
              :class="changeValueClass(change.type)"
            >
              {{ change.new_value }}
            </span>
          </div>
          <p class="mt-1.5 text-center text-[11px] leading-snug text-text/65">
            {{ lang === 'fr' ? change.description_fr : change.description_en }}
          </p>
        </li>
      </ul>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { PatchChangeType, PatchEntity } from '~/stores/PatchNotesStore'

const props = defineProps<{
  entity: PatchEntity
  lang: 'fr' | 'en'
}>()

const displayName = computed(() =>
  props.lang === 'fr' ? props.entity.name_fr : props.entity.name_en
)

const initials = computed(() => displayName.value.slice(0, 2).toUpperCase())

const typeLabel = computed(() => {
  const labels: Record<PatchChangeType, string> = {
    buff: 'Buff',
    nerf: 'Nerf',
    adjust: 'Ajust.',
    rework: 'Rework',
  }
  return labels[props.entity.global_type] ?? props.entity.global_type
})

const badgeClass = computed(() => {
  const map: Record<PatchChangeType, string> = {
    buff: 'bg-[#3B6D11] text-white',
    nerf: 'bg-[#A32D2D] text-white',
    adjust: 'bg-[#854F0B] text-white',
    rework: 'bg-primary text-white',
  }
  return map[props.entity.global_type] ?? 'bg-surface text-text/70'
})

const borderClass = computed(() => {
  const map: Record<PatchChangeType, string> = {
    buff: 'border-[#3B6D11]/50 hover:border-[#3B6D11]',
    nerf: 'border-[#A32D2D]/50 hover:border-[#A32D2D]',
    adjust: 'border-[#854F0B]/50 hover:border-[#854F0B]',
    rework: 'border-primary/50 hover:border-primary',
  }
  return map[props.entity.global_type] ?? 'border-primary/25'
})

const headerClass = computed(() => {
  const map: Record<PatchChangeType, string> = {
    buff: 'border-[#3B6D11]/20 bg-[#3B6D11]/8',
    nerf: 'border-[#A32D2D]/20 bg-[#A32D2D]/8',
    adjust: 'border-[#854F0B]/20 bg-[#854F0B]/8',
    rework: 'border-primary/20 bg-primary/8',
  }
  return map[props.entity.global_type] ?? 'border-primary/15 bg-background/40'
})

function changeValueClass(type: PatchChangeType): string {
  if (type === 'buff') return 'bg-[#3B6D11]/20 text-[#7ec850]'
  if (type === 'nerf') return 'bg-[#A32D2D]/20 text-[#f08080]'
  return 'bg-primary/15 text-text'
}
</script>
