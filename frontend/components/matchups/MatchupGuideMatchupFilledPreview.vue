<template>
  <div class="matchup-filled-preview">
    <p v-if="filledRows.length === 0" class="matchup-filled-preview__empty">
      {{ t('matchupGuideCreate.previewEmpty') }}
    </p>
    <dl v-else class="matchup-filled-preview__list">
      <div v-for="row in filledRows" :key="row.key" class="matchup-filled-preview__row">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MatchupEntry } from '@lelanation/shared-types'
import { useBuildStore } from '~/stores/BuildStore'
import {
  formatBuildVariantsCell,
  formatPhaseTags,
  formatPowerSpikeCell,
} from '~/utils/matchupEntryUtils'
import {
  matchupEntryHasAdvice,
  matchupEntryHasBuildPick,
  matchupEntryHasDifficulty,
} from '~/utils/matchupGuideCreateSteps'

const props = defineProps<{
  entry: MatchupEntry
}>()

const { t } = useI18n()
const buildStore = useBuildStore()

type PreviewRow = { key: string; label: string; value: string }

const filledRows = computed((): PreviewRow[] => {
  const entry = props.entry
  const rows: PreviewRow[] = []

  if (matchupEntryHasDifficulty(entry)) {
    rows.push({
      key: 'difficulty',
      label: t('matchupGuideCreate.fieldDifficulty'),
      value: formatDifficulty(entry),
    })
  }

  if (entry.outcomeKind) {
    rows.push({
      key: 'outcome',
      label: t('matchupGuideCreate.fieldOutcome'),
      value: formatOutcome(entry),
    })
  }

  if (matchupEntryHasBuildPick(entry)) {
    rows.push({
      key: 'build',
      label: t('matchupGuideCreate.fieldBuildVariant'),
      value: formatBuildVariantsCell(entry, buildStore.currentBuild, t),
    })
  } else if (entry.itemPath?.trim()) {
    rows.push({
      key: 'itemPath',
      label: t('matchupGuideCreate.fieldBuildVariant'),
      value: entry.itemPath.trim(),
    })
  }

  const powerSpike = formatPowerSpikeCell(entry)
  if (powerSpike !== '—') {
    rows.push({
      key: 'powerSpike',
      label: t('matchupGuideCreate.fieldPowerSpike'),
      value: powerSpike,
    })
  }

  for (const phase of ['early', 'mid', 'late'] as const) {
    const notes = entry[phase]
    const tags = formatPhaseTags(notes?.tags, t)
    const text = notes?.notes?.trim()
    if (!tags && !text) continue
    rows.push({
      key: phase,
      label: t(`matchupGuideCreate.phase.${phase}`),
      value: [tags, text].filter(Boolean).join(' — '),
    })
  }

  if (matchupEntryHasAdvice(entry)) {
    rows.push({
      key: 'comments',
      label: t('matchupGuideCreate.fieldComments'),
      value: entry.comments!.trim(),
    })
  }

  if (entry.runes?.trim()) {
    rows.push({
      key: 'runes',
      label: t('matchupGuideCreate.fieldRunes'),
      value: entry.runes.trim(),
    })
  }

  return rows
})

function formatDifficulty(entry: MatchupEntry): string {
  if (entry.difficultyMode === 'score' && entry.difficultyScore) {
    return `${entry.difficultyScore}/10`
  }
  if (entry.difficultyBand) {
    return t(`matchupGuideCreate.difficultyBand.${entry.difficultyBand}`)
  }
  return entry.difficulty?.trim() || '—'
}

function formatOutcome(entry: MatchupEntry): string {
  if (!entry.outcomeKind) return '—'
  let label = t(`matchupGuideCreate.outcomeKind.${entry.outcomeKind}`)
  if (entry.outcomeKind === 'skill' && entry.skillFavor) {
    label += ` (${t(`matchupGuideCreate.skillFavor.${entry.skillFavor}`)})`
  }
  return label
}
</script>

<style scoped>
.matchup-filled-preview__empty {
  margin: 0;
  padding: 1rem 0.5rem;
  text-align: center;
  font-size: 0.82rem;
  color: rgb(var(--rgb-text) / 0.6);
}

.matchup-filled-preview__list {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

@media (min-width: 768px) {
  .matchup-filled-preview__list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem 1.25rem;
  }
}

.matchup-filled-preview__row {
  display: grid;
  gap: 0.15rem;
}

.matchup-filled-preview__row dt {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: rgb(var(--rgb-text) / 0.65);
}

.matchup-filled-preview__row dd {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.45;
  color: rgb(var(--rgb-text));
  white-space: pre-wrap;
}
</style>
