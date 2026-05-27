const PLATFORM_TO_REGIONAL: Record<string, string> = {
  euw1: 'europe',
  eun1: 'europe',
  tr1: 'europe',
  ru: 'europe',
  na1: 'americas',
  br1: 'americas',
  la1: 'americas',
  la2: 'americas',
  kr: 'asia',
  jp1: 'asia',
  oc1: 'sea',
}

export function platformToRegionalHost(region: string): string {
  const normalized = String(region ?? '')
    .trim()
    .toLowerCase()
  return PLATFORM_TO_REGIONAL[normalized] ?? 'europe'
}
