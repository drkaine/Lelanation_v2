import type { SessionPoolStatus } from './SessionPool.js';

let getter: (() => SessionPoolStatus) | null = null;

export function setSessionPoolStatusGetter(fn: () => SessionPoolStatus): void {
  getter = fn;
}

export function getSessionPoolStatus(): SessionPoolStatus | null {
  return getter?.() ?? null;
}

export function clearSessionPoolStatusGetter(): void {
  getter = null;
}
