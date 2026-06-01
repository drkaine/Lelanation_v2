export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor(sortedAsc.length * p)));
  return sortedAsc[idx] ?? 0;
}

export function percentileOf(values: number[], p: number): number {
  if (values.length === 0) return 0;
  return percentile([...values].sort((a, b) => a - b), p);
}

/** Two-pointer max events per 120s window; events sorted newest-first from buffer. */
export function peakEventsPer120s(events: Array<{ ts: number }>): number {
  if (events.length === 0) return 0;
  const asc = [...events].sort((a, b) => a.ts - b.ts);
  let peak = 0;
  let left = 0;
  for (let right = 0; right < asc.length; right += 1) {
    while (asc[right]!.ts - asc[left]!.ts > 120_000) {
      left += 1;
    }
    peak = Math.max(peak, right - left + 1);
  }
  return peak;
}

/** Average count over sliding 120s windows anchored at each event. */
export function avgEventsPer120s(events: Array<{ ts: number }>): number {
  if (events.length === 0) return 0;
  const asc = [...events].sort((a, b) => a.ts - b.ts);
  const counts: number[] = [];
  let left = 0;
  for (let right = 0; right < asc.length; right += 1) {
    while (asc[right]!.ts - asc[left]!.ts > 120_000) {
      left += 1;
    }
    counts.push(right - left + 1);
  }
  return mean(counts);
}
