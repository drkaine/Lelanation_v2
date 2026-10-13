/** Structure des pages confidentialité / mentions légales « gaming » (prototype sur /test). */

export type LegalBlock =
  | { kind: 'p'; text: string; html?: boolean }
  | { kind: 'h3'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'link'; label: string; href: string }

export type LegalSection = { key: string; icon: string; blocks: LegalBlock[] }

export type LegalDoc = 'privacy' | 'legal'

const p = (text: string, html = false): LegalBlock => ({ kind: 'p', text, html })

export const LEGAL_DOCS: Record<LegalDoc, LegalSection[]> = {
  privacy: [
    {
      key: 'dataCollected',
      icon: 'mdi:database-eye-outline',
      blocks: [p('privacy.dataCollected.p1'), p('privacy.dataCollected.p2')],
    },
    {
      key: 'cookies',
      icon: 'mdi:cookie-outline',
      blocks: [
        { kind: 'h3', text: 'privacy.cookies.essential.title' },
        p('privacy.cookies.essential.p1', true),
        {
          kind: 'list',
          items: [1, 2, 3, 4].map(i => `privacy.cookies.essential.li${i}`),
        },
        p('privacy.cookies.essential.p2'),
        { kind: 'h3', text: 'privacy.cookies.nonEssential.title' },
        p('privacy.cookies.nonEssential.p1', true),
        p('privacy.cookies.nonEssential.p2'),
        { kind: 'h3', text: 'privacy.cookies.manage.title' },
        p('privacy.cookies.manage.p1'),
        { kind: 'list', items: [1, 2, 3].map(i => `privacy.cookies.manage.li${i}`) },
      ],
    },
    {
      key: 'shareBuilds',
      icon: 'mdi:share-variant-outline',
      blocks: [p('privacy.shareBuilds.p1'), p('privacy.shareBuilds.p2')],
    },
    {
      key: 'thirdParty',
      icon: 'mdi:api',
      blocks: [p('privacy.thirdParty.p1'), p('privacy.thirdParty.p2')],
    },
    {
      key: 'analytics',
      icon: 'mdi:chart-line',
      blocks: [p('privacy.analytics.p1', true), p('privacy.analytics.p2')],
    },
    {
      key: 'rights',
      icon: 'mdi:scale-balance',
      blocks: [
        p('privacy.rights.intro'),
        {
          kind: 'list',
          items: ['access', 'rectification', 'erasure', 'portability'].map(
            k => `privacy.rights.${k}`
          ),
        },
        p('privacy.rights.p2'),
      ],
    },
    { key: 'contact', icon: 'mdi:email-outline', blocks: [p('privacy.contact.text')] },
  ],
  legal: [
    { key: 'siteInfo', icon: 'mdi:web', blocks: [p('legal.siteInfo.intro', true)] },
    {
      key: 'riotData',
      icon: 'mdi:shield-sword-outline',
      blocks: [
        p('legal.riotData.disclaimer'),
        p('legal.riotData.p1', true),
        p('legal.riotData.p2', true),
        p('legal.riotData.p3', true),
        p('legal.riotData.p4'),
        { kind: 'link', label: 'legal.riotData.riotLegalUrl', href: 'legal.riotData.riotLegalUrl' },
      ],
    },
    {
      key: 'lelariva',
      icon: 'mdi:account-star-outline',
      blocks: [1, 2, 3].map(i => p(`legal.lelariva.p${i}`, true)),
    },
    {
      key: 'ip',
      icon: 'mdi:copyright',
      blocks: [p('legal.ip.p1', true), p('legal.ip.p2', true)],
    },
    {
      key: 'liability',
      icon: 'mdi:alert-circle-outline',
      blocks: [p('legal.liability.p1', true), p('legal.liability.p2', true)],
    },
    { key: 'analytics', icon: 'mdi:chart-line', blocks: [p('legal.analytics.p1', true)] },
    { key: 'contact', icon: 'mdi:email-outline', blocks: [p('legal.contact.text')] },
  ],
}

export function legalSectionAnchor(key: string): string {
  return `sec-${key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`
}

export type LegalTocEntry = { index: string; anchor: string; titleKey: string }

export function legalToc(doc: LegalDoc): LegalTocEntry[] {
  return LEGAL_DOCS[doc].map((section, i) => ({
    index: String(i + 1).padStart(2, '0'),
    anchor: legalSectionAnchor(section.key),
    titleKey: `${doc}.${section.key}.title`,
  }))
}

/** Téléchargements des `days` derniers jours (aujourd'hui inclus, dates UTC). */
export function recentDownloadCount(
  daily: Record<string, number>,
  days: number,
  today: Date = new Date()
): number {
  let total = 0
  for (let i = 0; i < days; i++) {
    const day = new Date(today.getTime() - i * 86_400_000).toISOString().slice(0, 10)
    total += daily[day] ?? 0
  }
  return total
}
