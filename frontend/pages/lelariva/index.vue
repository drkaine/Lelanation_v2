<template>
  <div class="lelariva-registry min-h-screen w-full min-w-0 px-2 py-4 text-text sm:px-3">
    <div class="flex w-full min-w-0 flex-col gap-4">
      <header class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm leading-snug">
        <span class="min-w-0 text-text/70">
          Clés extraites de
          <code class="text-xs">match-id.json</code> et <code class="text-xs">timeline.json</code>.
          Cliquez sur une cellule de revue pour faire défiler : Je ne sais pas → Oui → Non.
        </span>
        <span v-if="registry" class="shrink-0 whitespace-nowrap text-xs text-text/50">
          {{ registry.rows.length }} clés · généré le {{ formatGeneratedAt(registry.generatedAt) }}
          <template v-if="registry.lastFixtureDiff">
            · patch {{ registry.lastFixtureDiff.patch }} (<span class="text-amber-400"
              >+{{ registry.lastFixtureDiff.addedCount }}</span
            >/<span class="text-red-400">−{{ registry.lastFixtureDiff.removedCount }}</span
            >)
          </template>
        </span>
      </header>

      <div v-if="pending" class="ui-build-card-surface rounded-xl p-6 text-sm text-text/70">
        Chargement…
      </div>
      <div
        v-else-if="error"
        class="ui-build-card-surface rounded-xl border border-error/40 p-4 text-sm text-error"
      >
        {{ error }}
      </div>

      <template v-else-if="registry">
        <div class="flex flex-wrap items-end gap-3">
          <label class="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs">
            <span class="font-medium text-text/80">Filtrer</span>
            <input
              v-model="searchQuery"
              type="search"
              placeholder="Chemin, clé, description…"
              class="rounded border border-primary/40 bg-background px-2 py-1.5 text-sm text-text"
            />
          </label>
          <label class="flex flex-col gap-1 text-xs">
            <span class="font-medium text-text/80">Source</span>
            <select
              v-model="sourceFilter"
              class="rounded border border-primary/40 bg-background px-2 py-1.5 text-sm text-text"
            >
              <option value="">Toutes</option>
              <option value="match">Match</option>
              <option value="timeline">Timeline</option>
            </select>
          </label>
          <label class="flex flex-col gap-1 text-xs">
            <span class="font-medium text-text/80">Changements</span>
            <select
              v-model="changeFilter"
              class="rounded border border-primary/40 bg-background px-2 py-1.5 text-sm text-text"
            >
              <option value="">Tous</option>
              <option value="new">Nouveaux</option>
              <option value="obsoleted">Obsoletes</option>
            </select>
          </label>
          <form class="flex items-end gap-2" @submit.prevent="addColumn">
            <label class="flex flex-col gap-1 text-xs">
              <span class="font-medium text-text/80">Nouvelle colonne</span>
              <input
                v-model="newColumnName"
                type="text"
                placeholder="Nom reviewer"
                class="w-40 rounded border border-primary/40 bg-background px-2 py-1.5 text-sm text-text"
              />
            </label>
            <button
              type="submit"
              class="ui-build-card-button px-3 py-1.5 text-xs font-semibold"
              :disabled="!newColumnName.trim() || addingColumn"
            >
              Ajouter
            </button>
          </form>
          <label
            v-if="hiddenRowsCount > 0"
            class="flex items-center gap-2 self-end pb-1.5 text-xs text-text/80"
          >
            <input v-model="showHiddenRows" type="checkbox" class="rounded border-primary/40" />
            <span>Afficher les lignes cachées ({{ hiddenRowsCount }})</span>
          </label>
          <button
            v-if="hiddenRowsCount > 0"
            type="button"
            class="self-end pb-1 text-xs text-text/70 underline hover:text-text"
            @click="unhideAllRows"
          >
            Tout réafficher
          </button>
        </div>

        <div class="ui-build-card-surface w-full min-w-0 overflow-x-auto rounded-xl">
          <table class="lelariva-registry-table w-full text-left text-xs">
            <thead>
              <tr class="border-b border-primary/30 text-text/70">
                <th class="sticky left-0 z-10 bg-blue-500 px-2 py-2 font-semibold">Source</th>
                <th class="px-2 py-2 font-semibold">Chemin</th>
                <th class="px-2 py-2 font-semibold">Clé</th>
                <th class="px-2 py-2 font-semibold">Description</th>
                <th class="px-2 py-2 font-semibold">Type</th>
                <th class="px-2 py-2 font-semibold">En DB</th>
                <th class="px-2 py-2 font-semibold">Exemple</th>
                <th class="px-2 py-2 font-semibold">Min</th>
                <th class="px-2 py-2 font-semibold">Max</th>
                <th
                  class="w-10 px-1 py-2 font-semibold"
                  title="Masquer la ligne (sauvegardé dans le navigateur)"
                >
                  <span class="sr-only">Masquer</span>
                </th>
                <th
                  v-for="col in registry.reviewColumns"
                  :key="'head-' + col"
                  class="px-2 py-2 font-semibold capitalize"
                >
                  {{ col }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in filteredRows"
                :key="row.id"
                class="registry-row border-b border-primary/15 hover:bg-primary/5"
                :class="[rowClass(row), isRowHidden(row.id) ? 'registry-row--hidden' : '']"
              >
                <td
                  class="sticky left-0 z-[1] px-2 py-1.5 font-medium capitalize"
                  :class="rowSourceCellClass(row)"
                >
                  <span v-if="row.changeStatus === 'new'" class="registry-badge registry-badge--new"
                    >NEW</span
                  >
                  {{ row.source }}
                </td>
                <td class="break-all px-2 py-1.5 font-mono text-[11px]" :title="row.path">
                  {{ row.path }}
                </td>
                <td class="px-2 py-1.5 font-mono text-[11px]">{{ row.key }}</td>
                <td class="px-2 py-1.5 leading-snug" :class="rowDescriptionClass(row)">
                  {{ row.description }}
                </td>
                <td class="whitespace-nowrap px-2 py-1.5 capitalize">{{ row.valueType }}</td>
                <td class="px-2 py-1.5 text-center">
                  <span
                    class="inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold"
                    :class="row.inDb ? 'bg-info/20 text-info' : 'bg-primary/10 text-text/40'"
                    :title="row.inDb ? 'Colonne présente en base' : 'Absent de la base'"
                  >
                    {{ row.inDb ? '✓' : '✗' }}
                  </span>
                </td>
                <td
                  class="break-all px-2 py-1.5 font-mono text-[11px] text-text/75"
                  :title="row.sampleValue ?? ''"
                >
                  {{ row.sampleValue ?? '—' }}
                </td>
                <td class="px-2 py-1.5 tabular-nums">{{ formatNum(row.dbMin) }}</td>
                <td class="px-2 py-1.5 tabular-nums">{{ formatNum(row.dbMax) }}</td>
                <td class="px-1 py-1 text-center">
                  <button
                    v-if="!isRowHidden(row.id)"
                    type="button"
                    class="row-hide-btn"
                    title="Masquer cette ligne"
                    @click="hideRow(row.id)"
                  >
                    ×
                  </button>
                  <button
                    v-else
                    type="button"
                    class="row-unhide-btn"
                    title="Réafficher cette ligne"
                    @click="unhideRow(row.id)"
                  >
                    ↩
                  </button>
                </td>
                <td
                  v-for="col in registry.reviewColumns"
                  :key="row.id + '-' + col"
                  class="px-1 py-1"
                >
                  <button
                    type="button"
                    class="review-cell w-full min-w-[6.5rem] rounded px-1.5 py-1 text-center text-[11px] font-medium transition"
                    :class="reviewCellClass(row.reviews[col])"
                    :disabled="savingKey === row.id + ':' + col"
                    :title="`Cliquer pour changer (${col})`"
                    @click="cycleReview(row, col)"
                  >
                    {{ reviewLabel(row.reviews[col]) }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-xs text-text/50">
          {{ filteredRows.length }} lignes affichées
          <template v-if="hiddenRowsCount > 0 && !showHiddenRows">
            · {{ hiddenRowsCount }} masquée(s) localement
          </template>
        </p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiUrl } from '~/utils/apiUrl'

const HIDDEN_ROWS_STORAGE_KEY = 'lelariva.registry.hiddenRowIds'

type ReviewValue = 'oui' | 'non' | 'unknown'
type FieldChangeStatus = 'new' | 'obsoleted'

type RegistryRow = {
  id: string
  source: 'match' | 'timeline'
  path: string
  key: string
  description: string
  valueType: string
  sampleValue: string | null
  inDb: boolean
  dbMin: number | null
  dbMax: number | null
  reviews: Record<string, ReviewValue>
  changeStatus?: FieldChangeStatus | null
  changeDetectedAt?: string | null
}

type FieldRegistry = {
  version: 1
  generatedAt: string
  reviewColumns: string[]
  rows: RegistryRow[]
  lastFixtureDiff?: {
    patch: string
    matchId?: string
    refreshedAt: string
    addedCount: number
    removedCount: number
    added: string[]
    removed: string[]
  }
}

const pending = ref(true)
const error = ref('')
const registry = ref<FieldRegistry | null>(null)
const searchQuery = ref('')
const sourceFilter = ref<'match' | 'timeline' | ''>('')
const changeFilter = ref<'new' | 'obsoleted' | ''>('')
const newColumnName = ref('')
const addingColumn = ref(false)
const savingKey = ref('')
const hiddenRowIds = ref<Set<string>>(new Set())
const showHiddenRows = ref(false)

const hiddenRowsCount = computed(() => hiddenRowIds.value.size)

const filteredRows = computed(() => {
  const rows = registry.value?.rows ?? []
  const q = searchQuery.value.trim().toLowerCase()
  return rows.filter(row => {
    const hidden = hiddenRowIds.value.has(row.id)
    if (hidden && !showHiddenRows.value) return false
    if (sourceFilter.value && row.source !== sourceFilter.value) return false
    if (changeFilter.value && row.changeStatus !== changeFilter.value) return false
    if (!q) return true
    return (
      row.path.toLowerCase().includes(q) ||
      row.key.toLowerCase().includes(q) ||
      row.description.toLowerCase().includes(q)
    )
  })
})

function loadHiddenRows(): void {
  if (!import.meta.client) return
  try {
    const raw = localStorage.getItem(HIDDEN_ROWS_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return
    hiddenRowIds.value = new Set(
      parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  } catch {
    // ignore malformed localStorage
  }
}

function saveHiddenRows(): void {
  if (!import.meta.client) return
  try {
    localStorage.setItem(HIDDEN_ROWS_STORAGE_KEY, JSON.stringify([...hiddenRowIds.value]))
  } catch {
    // ignore quota / private mode
  }
}

function isRowHidden(rowId: string): boolean {
  return hiddenRowIds.value.has(rowId)
}

function hideRow(rowId: string): void {
  hiddenRowIds.value = new Set([...hiddenRowIds.value, rowId])
  saveHiddenRows()
}

function unhideRow(rowId: string): void {
  const next = new Set(hiddenRowIds.value)
  next.delete(rowId)
  hiddenRowIds.value = next
  saveHiddenRows()
}

function unhideAllRows(): void {
  hiddenRowIds.value = new Set()
  showHiddenRows.value = false
  saveHiddenRows()
}

function rowClass(row: RegistryRow): string {
  if (row.changeStatus === 'obsoleted') return 'registry-row--obsoleted'
  if (row.changeStatus === 'new') return 'registry-row--new'
  return ''
}

function rowSourceCellClass(row: RegistryRow): string {
  if (row.changeStatus === 'obsoleted')
    return 'registry-source-cell registry-source-cell--obsoleted'
  if (row.changeStatus === 'new') return 'registry-source-cell registry-source-cell--new'
  return 'registry-source-cell registry-source-cell--default'
}

function rowDescriptionClass(row: RegistryRow): string {
  if (row.changeStatus === 'obsoleted') return 'registry-description--obsoleted'
  return ''
}

function reviewLabel(value: ReviewValue | undefined): string {
  if (value === 'oui') return 'Oui'
  if (value === 'non') return 'Non'
  return 'Je ne sais pas'
}

function reviewCellClass(value: ReviewValue | undefined): string {
  if (value === 'oui') return 'review-cell--yes'
  if (value === 'non') return 'review-cell--no'
  return 'review-cell--unknown'
}

function formatNum(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return String(value)
}

function formatGeneratedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR')
  } catch {
    return iso
  }
}

async function loadRegistry(): Promise<void> {
  pending.value = true
  error.value = ''
  try {
    const res = await fetch(apiUrl('/api/lelariva/field-registry'))
    if (!res.ok) throw new Error(String(res.status))
    registry.value = (await res.json()) as FieldRegistry
  } catch {
    error.value = 'Impossible de charger le registre.'
    registry.value = null
  } finally {
    pending.value = false
  }
}

async function cycleReview(row: RegistryRow, column: string): Promise<void> {
  if (!registry.value) return
  const key = `${row.id}:${column}`
  savingKey.value = key
  try {
    const res = await fetch(apiUrl('/api/lelariva/field-registry/review'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowId: row.id, column }),
    })
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as { value: ReviewValue }
    row.reviews[column] = data.value
  } catch {
    error.value = 'Échec de la sauvegarde.'
  } finally {
    savingKey.value = ''
  }
}

async function addColumn(): Promise<void> {
  const name = newColumnName.value.trim()
  if (!name || !registry.value) return
  addingColumn.value = true
  error.value = ''
  try {
    const res = await fetch(apiUrl('/api/lelariva/field-registry/columns'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as { reviewColumns: string[] }
    const added = data.reviewColumns.at(-1)
    if (added) {
      for (const row of registry.value.rows) {
        row.reviews[added] = 'unknown'
      }
      registry.value.reviewColumns = [...data.reviewColumns]
    }
    newColumnName.value = ''
  } catch {
    error.value = 'Impossible d’ajouter la colonne.'
  } finally {
    addingColumn.value = false
  }
}

onMounted(() => {
  loadHiddenRows()
  loadRegistry()
})

useHead({
  title: 'Registre API Riot — Lelariva',
})
</script>

<style scoped>
.lelariva-registry {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
}

.lelariva-registry-table {
  width: 100%;
  table-layout: auto;
}

.lelariva-registry-table th,
.lelariva-registry-table td {
  vertical-align: top;
}

.review-cell {
  border: 1px solid rgb(var(--rgb-accent) / 0.35);
  background: rgb(var(--rgb-background) / 0.35);
  cursor: pointer;
}

.review-cell:disabled {
  opacity: 0.6;
  cursor: wait;
}

.review-cell--unknown {
  color: rgb(var(--rgb-text) / 0.65);
}

.review-cell--yes {
  border-color: rgb(var(--rgb-info) / 0.7);
  background: rgb(var(--rgb-info) / 0.18);
  color: rgb(var(--rgb-primary-light) / 1);
}

.review-cell--no {
  border-color: rgb(var(--rgb-error) / 0.7);
  background: rgb(var(--rgb-error) / 0.18);
  color: rgb(var(--rgb-text) / 1);
}

.registry-row--obsoleted {
  background: rgb(220 38 38 / 0.12);
}

.registry-row--obsoleted:hover {
  background: rgb(220 38 38 / 0.18);
}

.registry-row--new {
  background: rgb(234 179 8 / 0.14);
}

.registry-row--new:hover {
  background: rgb(234 179 8 / 0.22);
}

.registry-source-cell {
  position: relative;
}

.registry-source-cell--default {
  background: rgb(59 130 246 / 0.95);
}

.registry-source-cell--obsoleted {
  background: rgb(185 28 28 / 0.95);
  color: rgb(254 226 226 / 1);
}

.registry-source-cell--new {
  background: rgb(180 130 8 / 0.98);
  color: rgb(254 249 195 / 1);
}

.registry-description--obsoleted {
  color: rgb(254 202 202 / 1);
  font-style: italic;
}

.registry-badge {
  display: inline-block;
  margin-right: 0.35rem;
  border-radius: 0.2rem;
  padding: 0.05rem 0.35rem;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.06em;
  vertical-align: middle;
}

.registry-badge--new {
  border: 1px solid rgb(250 204 21 / 0.9);
  background: rgb(250 204 21 / 0.95);
  color: rgb(66 32 6 / 1);
}

.registry-row--hidden {
  opacity: 0.55;
}

.row-hide-btn,
.row-unhide-btn {
  display: inline-flex;
  height: 1.5rem;
  width: 1.5rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  border: 1px solid rgb(var(--rgb-accent) / 0.35);
  background: rgb(var(--rgb-background) / 0.35);
  color: rgb(var(--rgb-text) / 0.65);
  cursor: pointer;
  font-size: 0.85rem;
  line-height: 1;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}

.row-hide-btn:hover {
  border-color: rgb(var(--rgb-error) / 0.6);
  background: rgb(var(--rgb-error) / 0.15);
  color: rgb(var(--rgb-text) / 1);
}

.row-unhide-btn:hover {
  border-color: rgb(var(--rgb-info) / 0.6);
  background: rgb(var(--rgb-info) / 0.15);
  color: rgb(var(--rgb-text) / 1);
}
</style>
