import type { RiotRegion } from './types.js'

export type RiotHttpResponse<T> = {
  data: T
  headers: Headers
  status: number
}

export class RiotHttpClient {
  constructor(private apiKey: string) {}

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey
  }

  async fetch<T>(
    region: RiotRegion,
    path: string,
    params: Record<string, string>
  ): Promise<RiotHttpResponse<T>> {
    const base = `https://${region}.api.riotgames.com`
    const url = new URL(path, base)
    for (const [key, value] of Object.entries(params)) {
      if (value == null) continue
      url.searchParams.set(key, value)
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Riot-Token': this.apiKey,
        Accept: 'application/json',
      },
    })

    let data: unknown = null
    const raw = await response.text()
    if (raw.length > 0) {
      try {
        data = JSON.parse(raw)
      } catch {
        data = raw
      }
    }

    return {
      data: data as T,
      headers: response.headers,
      status: response.status,
    }
  }
}
