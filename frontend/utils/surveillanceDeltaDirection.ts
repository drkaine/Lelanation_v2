/** @deprecated Ancien format global — migré vers DeltaDirectionFlags par métrique. */
export type SurveillanceDeltaDirection = 'both' | 'increase' | 'decrease'

export interface DeltaDirectionFlags {
  increase: boolean
  decrease: boolean
}

export function defaultDeltaDirectionFlags(): DeltaDirectionFlags {
  return { increase: true, decrease: true }
}

export function flagsFromLegacyDirection(
  direction: SurveillanceDeltaDirection
): DeltaDirectionFlags {
  if (direction === 'increase') return { increase: true, decrease: false }
  if (direction === 'decrease') return { increase: false, decrease: true }
  return { increase: true, decrease: true }
}

export function normalizeSurveillanceDeltaDirection(value: unknown): SurveillanceDeltaDirection {
  if (value === 'increase' || value === 'up') return 'increase'
  if (value === 'decrease' || value === 'down') return 'decrease'
  return 'both'
}

export function normalizeDeltaDirectionFlags(
  value: unknown,
  legacyFallback?: SurveillanceDeltaDirection
): DeltaDirectionFlags {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Partial<DeltaDirectionFlags>
    const increase = record.increase !== false
    const decrease = record.decrease !== false
    if (!increase && !decrease) return defaultDeltaDirectionFlags()
    return { increase, decrease }
  }
  if (typeof value === 'string') {
    return flagsFromLegacyDirection(normalizeSurveillanceDeltaDirection(value))
  }
  if (legacyFallback) return flagsFromLegacyDirection(legacyFallback)
  return defaultDeltaDirectionFlags()
}

export function passesDeltaDirectionFlags(diff: number, flags: DeltaDirectionFlags): boolean {
  if (diff > 0) return flags.increase
  if (diff < 0) return flags.decrease
  return false
}

/** @deprecated */
export function passesDeltaDirection(diff: number, direction: SurveillanceDeltaDirection): boolean {
  return passesDeltaDirectionFlags(diff, flagsFromLegacyDirection(direction))
}

export function demoReferenceForDeltaFlags(
  current: number,
  delta: number,
  flags: DeltaDirectionFlags
): number {
  if (flags.decrease && !flags.increase) {
    return Math.max(0, Math.min(100, current + delta + 1))
  }
  return Math.max(0, Math.min(100, current - delta - 1))
}

/** @deprecated */
export function demoReferenceForDeltaDirection(
  current: number,
  delta: number,
  direction: SurveillanceDeltaDirection
): number {
  return demoReferenceForDeltaFlags(current, delta, flagsFromLegacyDirection(direction))
}

export function toggleDeltaDirectionFlag(
  flags: DeltaDirectionFlags,
  key: keyof DeltaDirectionFlags
): DeltaDirectionFlags {
  const next = { ...flags, [key]: !flags[key] }
  if (!next.increase && !next.decrease) {
    return { ...flags, [key]: true }
  }
  return next
}
