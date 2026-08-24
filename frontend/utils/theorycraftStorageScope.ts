let currentScope = 'builder:default'

export function setTheorycraftStorageScope(scope: string): void {
  const trimmed = scope.trim()
  currentScope = trimmed || 'builder:default'
}

export function getTheorycraftStorageScope(): string {
  return currentScope
}

export function scopedTheorycraftStorageKey(baseKey: string): string {
  return `${baseKey}__${currentScope}`
}

export function theorycraftVsScope(sessionId: string, side: 'ally' | 'enemy'): string {
  return `vs:${sessionId}:${side}`
}

export function theorycraftDetailScope(buildId: string, side: 'ally' | 'enemy'): string {
  return `detail:${buildId}:${side}`
}
