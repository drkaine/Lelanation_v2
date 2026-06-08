<template>
  <div
    class="overflow-hidden rounded-xl border border-primary/20 bg-surface shadow-sm transition-shadow hover:shadow-md"
  >
    <!-- Entity Header -->
    <div class="flex items-center gap-3 border-b border-primary/10 bg-primary/5 p-4">
      <!-- Icon/Image -->
      <div
        class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-background text-2xl"
      >
        <img
          v-if="entityImageUrl"
          :src="entityImageUrl"
          :alt="entity.name"
          class="h-full w-full rounded-lg object-cover"
          @error="onImageError"
        />
        <span v-else>{{ categoryIcon }}</span>
      </div>

      <!-- Title and Subcategory -->
      <div class="min-w-0 flex-1">
        <h3 class="truncate text-base font-semibold text-text">
          {{ entity.name }}
        </h3>
        <p v-if="entity.subCategory" class="truncate text-xs text-text/60">
          {{ entity.subCategory }}
        </p>
      </div>
    </div>

    <!-- Changes List -->
    <div class="p-4">
      <ul class="space-y-2">
        <li
          v-for="(change, index) in entity.changes"
          :key="index"
          class="flex items-start gap-2 text-sm"
        >
          <!-- Change Type Indicator -->
          <span
            :class="[
              'shrink-0 rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide',
              typeClasses[change.type],
            ]"
          >
            {{ typeLabels[change.type] }}
          </span>

          <!-- Change Content -->
          <div class="flex-1">
            <span class="font-medium text-text">{{ change.stat }}</span>
            <div class="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-text/70">
              <span v-if="shouldShowBefore(change)" class="line-through decoration-red-500/50">{{
                change.before
              }}</span>
              <span v-if="shouldShowBefore(change) && shouldShowAfter(change)" class="text-text/40"
                >→</span
              >
              <span
                v-if="shouldShowAfter(change)"
                :class="{
                  'font-medium text-green-400': change.type === 'buff',
                  'font-medium text-red-400': change.type === 'nerf',
                }"
                >{{ change.after }}</span
              >
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { PatchEntity, ChangeType } from '~/stores/PatchNotesStore'

const props = defineProps<{
  entity: PatchEntity
}>()

const { t } = useI18n()
const imageError = ref(false)

const typeClasses: Record<ChangeType, string> = {
  buff: 'bg-green-500/20 text-green-400',
  nerf: 'bg-red-500/20 text-red-400',
  adjustment: 'bg-yellow-500/20 text-yellow-400',
  new: 'bg-blue-500/20 text-blue-400',
  removed: 'bg-gray-500/20 text-gray-400',
  text: 'bg-purple-500/20 text-purple-400',
}

const typeLabels: Record<ChangeType, string> = {
  buff: t('patchNotesPage.changeTypes.buff'),
  nerf: t('patchNotesPage.changeTypes.nerf'),
  adjustment: t('patchNotesPage.changeTypes.adjustment'),
  new: t('patchNotesPage.changeTypes.new'),
  removed: t('patchNotesPage.changeTypes.removed'),
  text: t('patchNotesPage.changeTypes.text'),
}

const categoryIcon = computed(() => {
  switch (props.entity.category) {
    case 'champion':
      return '🏆'
    case 'item':
      return '🛡️'
    case 'rune':
      return '✨'
    case 'system':
      return '⚙️'
    default:
      return '📝'
  }
})

const entityImageUrl = computed(() => {
  if (imageError.value) return null
  if (props.entity.imageUrl) {
    return props.entity.imageUrl
  }
  return null
})

function onImageError() {
  imageError.value = true
}

function shouldShowBefore(change: { before: string; type: ChangeType }): boolean {
  // Don't show before for new additions
  if (change.type === 'new') return false
  // Don't show if before is a placeholder
  if (change.before.startsWith('(') && change.before.endsWith(')')) return false
  return Boolean(change.before)
}

function shouldShowAfter(change: { after: string; type: ChangeType }): boolean {
  // Don't show after for removed items
  if (change.type === 'removed') return false
  return Boolean(change.after)
}
</script>
