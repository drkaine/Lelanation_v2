export type ObjectiveDistributions = {
  byWin: Record<string, number>
  byLoss: Record<string, number>
}

function field(source: unknown, key: string): unknown {
  if (!source || typeof source !== 'object') return undefined
  return Object.entries(source).find(([k]) => k === key)?.[1]
}

function numberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'number') out[k] = v
  }
  return out
}

/** Win/loss count histograms of one objective from the overview-teams API payload. */
export function objectiveDistributions(
  objectives: unknown,
  key: string
): ObjectiveDistributions | null {
  const objective = field(objectives, key)
  if (field(objective, 'distributionByWin') === undefined) return null
  return {
    byWin: numberRecord(field(objective, 'distributionByWin')),
    byLoss: numberRecord(field(objective, 'distributionByLoss')),
  }
}
