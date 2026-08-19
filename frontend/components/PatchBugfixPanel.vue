<template>
  <div class="w-full space-y-6">
    <section
      v-for="section in sections"
      :key="section.modeId"
      class="min-w-0"
      :aria-labelledby="section.title ? `patch-bugfix-mode-${section.modeId}` : undefined"
    >
      <h3
        v-if="section.title"
        :id="`patch-bugfix-mode-${section.modeId}`"
        class="mb-4 border-b border-primary/15 pb-2 text-sm font-semibold uppercase tracking-wide text-accent"
      >
        {{ section.title }}
        <span class="ml-2 text-xs font-normal normal-case tracking-normal text-text/50">
          ({{ section.items.length }})
        </span>
      </h3>
      <PatchBugfixColumns :items="section.items" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { PatchEntity, EntityCategory } from '~/stores/PatchNotesStore'
import { groupBugfixItemsByMode, flattenBugfixItems } from '~/utils/patchBugfixItems'
import PatchBugfixColumns from '~/components/PatchBugfixColumns.vue'

const props = withDefaults(
  defineProps<{
    entities: PatchEntity[]
    groupByMode?: boolean
  }>(),
  {
    groupByMode: true,
  }
)

const { t } = useI18n()

const PATCH_MODE_I18N_KEYS: Record<EntityCategory, string> = {
  champion: 'patchNotesPage.categories.champions',
  item: 'patchNotesPage.categories.items',
  rune: 'patchNotesPage.categories.runes',
  system: 'patchNotesPage.categories.systems',
  classic: 'patchNotesPage.categories.classic',
  aram: 'patchNotesPage.categories.aram',
  'aram-chaos': 'patchNotesPage.categories.aramChaos',
  arena: 'patchNotesPage.categories.arena',
  bugfix: 'patchNotesPage.categories.bugfix',
}

const sections = computed(() => {
  if (!props.groupByMode) {
    const items = flattenBugfixItems(props.entities)
    if (items.length === 0) return []
    return [{ modeId: 'bugfix' as const, title: '', items }]
  }
  return groupBugfixItemsByMode(props.entities, modeId => t(PATCH_MODE_I18N_KEYS[modeId]))
})
</script>
