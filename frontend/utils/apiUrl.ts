import { useRuntimeConfig } from '#app'

const DEFAULT_API_BASE = 'http://localhost:4001'

export function apiUrl(path: string): string {
  const cfg = useRuntimeConfig()
  const base = (cfg.public.apiBase as string | undefined) || DEFAULT_API_BASE
  return base.replace(/\/$/, '') + path
}
