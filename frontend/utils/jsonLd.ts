export function absoluteUrl(siteUrl: string, path: string): string {
  const base = siteUrl.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

export function webSiteJsonLd(siteUrl: string, siteName = 'Lelanation'): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: absoluteUrl(siteUrl, '/'),
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${absoluteUrl(siteUrl, '/builds/discover')}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function organizationJsonLd(siteUrl: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Lelanation',
    url: absoluteUrl(siteUrl, '/'),
    sameAs: [
      'https://www.youtube.com/@lelariva',
      'https://www.twitch.tv/lelariva',
      'https://discord.gg/lelariva',
    ],
  }
}

export function itemListJsonLd(
  siteUrl: string,
  options: {
    name: string
    description?: string
    path: string
    items: Array<{ name: string; url: string; position?: number }>
  }
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: options.name,
    ...(options.description ? { description: options.description } : {}),
    url: absoluteUrl(siteUrl, options.path),
    itemListElement: options.items.slice(0, 50).map((item, index) => ({
      '@type': 'ListItem',
      position: item.position ?? index + 1,
      name: item.name,
      url: item.url.startsWith('http') ? item.url : absoluteUrl(siteUrl, item.url),
    })),
  }
}

export function videoObjectNode(video: {
  name: string
  description?: string
  thumbnailUrl: string
  uploadDate?: string
  url: string
  duration?: string
}): Record<string, unknown> {
  const description =
    video.description && video.description.length > 500
      ? `${video.description.slice(0, 497)}...`
      : video.description
  return {
    '@type': 'VideoObject',
    name: video.name,
    ...(description ? { description } : {}),
    thumbnailUrl: video.thumbnailUrl,
    ...(video.uploadDate ? { uploadDate: video.uploadDate } : {}),
    ...(video.duration ? { duration: video.duration } : {}),
    embedUrl: video.url,
    contentUrl: video.url,
  }
}

export function videoObjectJsonLd(video: {
  name: string
  description?: string
  thumbnailUrl: string
  uploadDate?: string
  url: string
  duration?: string
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    ...videoObjectNode(video),
  }
}

export function graphJsonLd(nodes: Record<string, unknown>[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes,
  }
}

export function articleJsonLd(options: {
  siteUrl: string
  path: string
  headline: string
  description?: string
  datePublished?: string
  dateModified?: string
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: options.headline,
    ...(options.description ? { description: options.description } : {}),
    ...(options.datePublished ? { datePublished: options.datePublished } : {}),
    ...(options.dateModified ? { dateModified: options.dateModified } : {}),
    mainEntityOfPage: absoluteUrl(options.siteUrl, options.path),
    publisher: {
      '@type': 'Organization',
      name: 'Lelanation',
      url: absoluteUrl(options.siteUrl, '/'),
    },
  }
}

export function breadcrumbJsonLd(
  siteUrl: string,
  items: Array<{ name: string; path: string }>
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(siteUrl, item.path),
    })),
  }
}
