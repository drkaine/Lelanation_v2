import type { ResolvedSince } from './SinceTimestampResolver.js';

let latest: ResolvedSince | null = null;

export function setLatestResolvedSince(resolved: ResolvedSince): void {
  latest = resolved;
}

export function getLatestResolvedSince(): ResolvedSince | null {
  return latest;
}
