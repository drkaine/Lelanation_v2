<template>
  <div class="overflow-x-auto rounded border border-primary/20">
    <table class="min-w-full text-left text-sm">
      <thead class="bg-background/50 text-xs uppercase text-text/60">
        <tr>
          <th class="px-3 py-2">{{ t('admin.stats.colPeriod') }}</th>
          <th class="px-3 py-2">{{ t('admin.stats.colNewPlayers') }}</th>
          <th class="px-3 py-2">{{ t('admin.stats.colPlayersWithMatches') }}</th>
          <th class="px-3 py-2">{{ t('admin.stats.colMatches') }}</th>
          <th class="px-3 py-2">{{ t('admin.stats.colMatchesPerPlayer') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!buckets.length">
          <td colspan="5" class="px-3 py-4 text-center text-text/60">
            {{ t('admin.stats.empty') }}
          </td>
        </tr>
        <tr
          v-for="bucket in displayBuckets"
          :key="bucket.bucket"
          class="border-t border-primary/10"
        >
          <td class="whitespace-nowrap px-3 py-2">{{ formatBucket(bucket.bucket) }}</td>
          <td class="px-3 py-2">{{ bucket.newPlayers }}</td>
          <td class="px-3 py-2">{{ bucket.playersWithMatches }}</td>
          <td class="px-3 py-2">{{ bucket.matchesIngested }}</td>
          <td class="px-3 py-2">{{ formatOptional(bucket.matchesPerPlayer) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type CollectTimeseriesBucket = {
  bucket: string
  newPlayers: number
  playersWithMatches: number
  matchesIngested: number
  matchesPerPlayer: number | null
}

const props = defineProps<{
  buckets: CollectTimeseriesBucket[]
  granularity: 'hour' | 'day'
}>()

const { t } = useI18n()

const displayBuckets = computed(() => [...props.buckets].reverse())

function formatBucket(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  if (props.granularity === 'day') {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

function formatOptional(value: number | null): string {
  return value == null ? '—' : value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}
</script>
