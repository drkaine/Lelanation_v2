import { promises as fs } from 'fs'
import { join } from 'path'

export type ReviewValue = 'oui' | 'non' | 'unknown'

export type FieldChangeStatus = 'new' | 'obsoleted'

export type FieldRegistryRow = {
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

export type FieldRegistry = {
  version: 1
  generatedAt: string
  reviewColumns: string[]
  rows: FieldRegistryRow[]
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

const REGISTRY_PATH = join(process.cwd(), 'data', 'api-riot', 'field-registry.json')

const REVIEW_CYCLE: ReviewValue[] = ['unknown', 'oui', 'non']

function nextReviewValue(current: ReviewValue): ReviewValue {
  const idx = REVIEW_CYCLE.indexOf(current)
  if (idx < 0) return 'oui'
  return REVIEW_CYCLE[(idx + 1) % REVIEW_CYCLE.length]
}

function slugColumnName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
  return slug || `col_${Date.now()}`
}

export async function readFieldRegistry(): Promise<FieldRegistry> {
  const raw = await fs.readFile(REGISTRY_PATH, 'utf-8')
  const parsed = JSON.parse(raw) as FieldRegistry & {
    rows: Array<FieldRegistryRow & { dbTable?: string | null; dbColumn?: string | null }>
  }
  for (const row of parsed.rows) {
    if (typeof row.inDb !== 'boolean') {
      row.inDb = Boolean(row.dbTable && row.dbColumn)
      delete row.dbTable
      delete row.dbColumn
    }
  }
  return parsed
}

async function writeFieldRegistry(registry: FieldRegistry): Promise<void> {
  await fs.writeFile(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`, 'utf-8')
}

export async function cycleFieldReview(
  rowId: string,
  column: string,
): Promise<{ value: ReviewValue; registry: FieldRegistry }> {
  const registry = await readFieldRegistry()
  if (!registry.reviewColumns.includes(column)) {
    throw new Error('UNKNOWN_COLUMN')
  }
  const row = registry.rows.find((r) => r.id === rowId)
  if (!row) {
    throw new Error('UNKNOWN_ROW')
  }
  const current = row.reviews[column] ?? 'unknown'
  const value = nextReviewValue(current)
  row.reviews[column] = value
  await writeFieldRegistry(registry)
  return { value, registry }
}

export async function addReviewColumn(name: string): Promise<FieldRegistry> {
  const registry = await readFieldRegistry()
  const slug = slugColumnName(name)
  if (registry.reviewColumns.includes(slug)) {
    throw new Error('COLUMN_EXISTS')
  }
  registry.reviewColumns.push(slug)
  for (const row of registry.rows) {
    row.reviews[slug] = 'unknown'
  }
  await writeFieldRegistry(registry)
  return registry
}

export function reviewLabel(value: ReviewValue): string {
  if (value === 'oui') return 'Oui'
  if (value === 'non') return 'Non'
  return 'Je ne sais pas'
}
