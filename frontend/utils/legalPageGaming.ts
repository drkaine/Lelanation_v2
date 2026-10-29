/** Structure des pages confidentialité / mentions légales « gaming » (prototype sur /test). */

export type LegalBlock =
  | { kind: 'p'; text: string; html?: boolean }
  | { kind: 'h3'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'link'; label: string; href: string }
  /** Texte suivi de l'adresse e-mail de contact (runtimeConfig.public.contactEmail). */
  | { kind: 'contact'; text: string }

export type LegalSection = { key: string; icon: string; blocks: LegalBlock[] }

export type LegalDoc = 'privacy' | 'legal'

/** Date de dernière modification des textes : à mettre à jour à chaque changement. */
export const LEGAL_LAST_UPDATE = '2026-10-29'

const p = (text: string, html = false): LegalBlock => ({ kind: 'p', text, html })
const list = (prefix: string, keys: string[]): LegalBlock => ({
  kind: 'list',
  items: keys.map(k => `${prefix}.${k}`),
})

export const LEGAL_DOCS: Record<LegalDoc, LegalSection[]> = {
  privacy: [
    {
      key: 'controller',
      icon: 'mdi:account-lock-outline',
      blocks: [p('privacy.controller.p1'), { kind: 'contact', text: 'privacy.controller.contact' }],
    },
    {
      key: 'dataCollected',
      icon: 'mdi:database-eye-outline',
      blocks: [
        p('privacy.dataCollected.p1', true),
        list('privacy.dataCollected', ['local', 'builds', 'contactForm', 'technical']),
        p('privacy.dataCollected.p2'),
      ],
    },
    {
      key: 'cookies',
      icon: 'mdi:cookie-outline',
      blocks: [
        { kind: 'h3', text: 'privacy.cookies.essential.title' },
        p('privacy.cookies.essential.p1', true),
        list('privacy.cookies.essential', ['li1', 'li2', 'li3', 'li4']),
        p('privacy.cookies.essential.p2'),
        { kind: 'h3', text: 'privacy.cookies.nonEssential.title' },
        p('privacy.cookies.nonEssential.p1', true),
        { kind: 'h3', text: 'privacy.cookies.manage.title' },
        p('privacy.cookies.manage.p1', true),
      ],
    },
    {
      key: 'analytics',
      icon: 'mdi:chart-line',
      blocks: [
        p('privacy.analytics.p1', true),
        list('privacy.analytics', ['li1', 'li2', 'li3', 'li4']),
        p('privacy.analytics.p2'),
      ],
    },
    {
      key: 'riotData',
      icon: 'mdi:shield-sword-outline',
      blocks: [
        p('privacy.riotData.p1', true),
        p('privacy.riotData.p2', true),
        p('privacy.riotData.p3'),
        p('privacy.riotData.p4'),
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
      blocks: [
        p('privacy.thirdParty.p1', true),
        p('privacy.thirdParty.p2', true),
        p('privacy.thirdParty.p3'),
      ],
    },
    {
      key: 'recipients',
      icon: 'mdi:server-network',
      blocks: [
        p('privacy.recipients.p1'),
        list('privacy.recipients', ['ovh', 'discord']),
        p('privacy.recipients.p2'),
      ],
    },
    {
      key: 'retention',
      icon: 'mdi:timer-sand',
      blocks: [
        list('privacy.retention', ['local', 'builds', 'contact', 'logs', 'analytics', 'riot']),
      ],
    },
    {
      key: 'rights',
      icon: 'mdi:scale-balance',
      blocks: [
        p('privacy.rights.intro'),
        list('privacy.rights', [
          'access',
          'rectification',
          'erasure',
          'opposition',
          'limitation',
          'portability',
        ]),
        p('privacy.rights.p2'),
        p('privacy.rights.cnil', true),
      ],
    },
    {
      key: 'contact',
      icon: 'mdi:email-outline',
      blocks: [{ kind: 'contact', text: 'privacy.contact.text' }],
    },
  ],
  legal: [
    {
      key: 'editor',
      icon: 'mdi:account-outline',
      blocks: [p('legal.editor.p1', true), p('legal.editor.p2'), p('legal.editor.p3')],
    },
    {
      key: 'host',
      icon: 'mdi:server',
      blocks: [p('legal.host.p1', true), p('legal.host.p2')],
    },
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
    {
      key: 'contact',
      icon: 'mdi:email-outline',
      blocks: [{ kind: 'contact', text: 'legal.contact.text' }],
    },
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
