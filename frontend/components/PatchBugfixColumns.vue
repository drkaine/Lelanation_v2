<template>
  <div :class="['patch-bugfix-columns', columnsClass]">
    <article v-for="item in items" :key="item.id" class="patch-bugfix-item mb-3 break-inside-avoid">
      <div
        class="flex h-full gap-2.5 rounded-lg border border-primary/15 bg-panel-elevated/25 p-3 shadow-sm"
      >
        <Icon name="mdi:bug" class="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <p class="min-w-0 text-sm leading-snug text-text/85">
          <template v-if="!item.linkUrl">{{ item.text }}</template>
          <template v-else>
            {{ splitBugfixLinkText(item).before
            }}<a
              :href="item.linkUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="font-medium text-accent underline hover:text-accent/80"
              >{{ item.linkLabel || item.linkUrl }}</a
            >{{ splitBugfixLinkText(item).after }}
          </template>
        </p>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { splitBugfixLinkText, type PatchBugfixItem } from '~/utils/patchBugfixItems'

withDefaults(
  defineProps<{
    items: PatchBugfixItem[]
    columnsClass?: string
  }>(),
  {
    columnsClass: 'columns-1 gap-x-6 sm:columns-2 lg:columns-3 2xl:columns-4',
  }
)
</script>
