<template>
  <section class="space-y-4 rounded-xl bg-surface p-4">
    <h2 class="text-lg font-semibold text-text">Theorycraft Spells</h2>

    <p v-if="spells.length === 0" class="border-border/60 text-muted rounded-lg border p-3 text-sm">
      Aucune description de sort disponible pour ce champion.
    </p>

    <div v-for="spell in spells" :key="spell.id" class="border-border/60 rounded-lg border p-3">
      <h3 class="mb-2 font-semibold text-text">{{ spell.slot }} — {{ spell.name }}</h3>

      <!-- eslint-disable vue/no-v-html -->
      <dl v-if="spell.headerStats?.length" class="mb-3 grid gap-1 text-xs sm:grid-cols-2">
        <div v-for="stat in spell.headerStats" :key="stat.key" class="flex gap-2">
          <dt class="text-muted shrink-0 font-semibold uppercase tracking-wide">
            {{ stat.label }}:
          </dt>
          <dd class="text-text" v-html="stat.valueHtml ?? stat.valueText" />
        </div>
      </dl>

      <div
        v-if="spell.summaryHtml"
        class="tooltip-spell-description tooltip-game-description text-muted mb-2 text-sm"
        v-html="spell.summaryHtml"
      />

      <div
        v-if="spell.descriptionHtml"
        class="tooltip-spell-description tooltip-game-description text-sm"
        v-html="spell.descriptionHtml"
      />

      <div
        v-for="(detail, index) in spell.detailedTexts ?? []"
        :key="`${spell.id}-detail-${index}`"
        class="tooltip-spell-description tooltip-game-description border-border/40 mt-3 border-t pt-3 text-sm"
        v-html="detail"
      />

      <div
        v-for="tick in spell.tickStats ?? []"
        :key="tick.key"
        class="border-border/40 mt-3 border-t pt-3"
      >
        <div class="flex flex-wrap items-baseline gap-2 text-xs">
          <span class="text-muted font-semibold uppercase tracking-wide">{{ tick.label }}:</span>
          <span
            class="tooltip-spell-description tooltip-game-description text-sm"
            v-html="
              activeTickView(spell.id, tick.key) === 'total'
                ? tick.totalHtml
                : (tick.perTickHtml ?? tick.totalHtml)
            "
          />
          <button
            v-if="tick.perTickHtml"
            type="button"
            class="text-xs text-accent hover:underline"
            @click="toggleTickView(spell.id, tick.key)"
          >
            {{ activeTickView(spell.id, tick.key) === 'total' ? 'Par tick' : 'Total' }}
          </button>
        </div>
      </div>
      <!-- eslint-enable vue/no-v-html -->
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'

interface SpellHeaderStat {
  key: string
  label: string
  valueText: string
  valueHtml?: string
}

interface SpellTickStat {
  key: string
  label: string
  totalText: string
  totalHtml: string
  perTickText?: string
  perTickHtml?: string
}

interface TheorycraftSpellSummary {
  id: string
  slot: string
  name: string
  summaryHtml?: string
  descriptionHtml?: string
  descriptionText?: string
  detailedTexts?: string[]
  headerStats?: SpellHeaderStat[]
  tickStats?: SpellTickStat[]
}

const props = defineProps<{
  champion: Record<string, unknown> | null
}>()

const tickViewByKey = reactive<Record<string, 'total' | 'tick'>>({})

function tickViewKey(spellId: string, tickKey: string): string {
  return `${spellId}:${tickKey}`
}

function activeTickView(spellId: string, tickKey: string): 'total' | 'tick' {
  return tickViewByKey[tickViewKey(spellId, tickKey)] ?? 'total'
}

function toggleTickView(spellId: string, tickKey: string): void {
  const key = tickViewKey(spellId, tickKey)
  tickViewByKey[key] = activeTickView(spellId, tickKey) === 'total' ? 'tick' : 'total'
}

const spells = computed<TheorycraftSpellSummary[]>(() => {
  const list = Array.isArray(props.champion?.spells) ? props.champion?.spells : []
  return list
    .map(spell => {
      const row = spell as TheorycraftSpellSummary
      return {
        id: String(row.id ?? ''),
        slot: String(row.slot ?? ''),
        name: String(row.name ?? ''),
        summaryHtml: row.summaryHtml,
        descriptionHtml: String(
          row.descriptionHtml ??
            row.descriptionParsed ??
            row.descriptionText ??
            row.parsedText ??
            ''
        ),
        descriptionParsed: row.descriptionParsed ?? row.descriptionHtml,
        descriptionText: row.descriptionText ?? row.parsedText,
        parsedText: row.parsedText ?? row.descriptionText,
        detailedTexts: Array.isArray(row.detailedTexts) ? row.detailedTexts : [],
        headerStats: Array.isArray(row.headerStats) ? row.headerStats : [],
        tickStats: Array.isArray(row.tickStats) ? row.tickStats : [],
      }
    })
    .filter(
      spell =>
        spell.descriptionHtml.length > 0 ||
        (spell.detailedTexts?.length ?? 0) > 0 ||
        (spell.headerStats?.length ?? 0) > 0
    )
})
</script>
