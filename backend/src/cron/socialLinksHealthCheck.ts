import cron from 'node-cron'
import { DiscordService } from '../services/DiscordService.js'
import { CronStatusService } from '../services/CronStatusService.js'
import { createCronLogger } from '../utils/cronLogger.js'

type SocialLinkType = 'discord-invite' | 'generic'

interface SocialLink {
  name: string
  url: string
  type: SocialLinkType
}

interface LinkCheckResult {
  link: SocialLink
  ok: boolean
  reason?: string
  statusCode?: number
}

const HOME_SOCIAL_LINKS: SocialLink[] = [
  { name: 'Discord', url: 'https://discord.gg/RrXCpsFGrw', type: 'discord-invite' },
  { name: 'Instagram', url: 'https://www.instagram.com/lelariva_fr/', type: 'generic' },
  { name: 'Facebook', url: 'https://www.facebook.com/lelariva/', type: 'generic' },
  { name: 'Patreon', url: 'https://www.patreon.com/c/Lelariva', type: 'generic' },
  { name: 'YouTube', url: 'https://www.youtube.com/@Lelariva_LoL/featured', type: 'generic' },
  { name: 'Twitch', url: 'https://www.twitch.tv/lelariva', type: 'generic' },
  { name: 'X', url: 'https://x.com/Lelariva_fr', type: 'generic' },
  { name: 'TikTok', url: 'https://www.tiktok.com/@lelariva_fr', type: 'generic' },
  { name: 'Website', url: 'https://www.lelariva.fr/', type: 'generic' }
]

export function extractDiscordInviteCode(inviteUrl: string): string | null {
  try {
    const parsed = new URL(inviteUrl)
    const host = parsed.hostname.toLowerCase()
    if (!host.includes('discord.gg') && !host.includes('discord.com')) return null
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (parts.length === 0) return null
    if (parts[0] === 'invite' && parts.length >= 2) return parts[1]
    return parts[0]
  } catch {
    return null
  }
}

async function checkDiscordInvite(link: SocialLink): Promise<LinkCheckResult> {
  const inviteCode = extractDiscordInviteCode(link.url)
  if (!inviteCode) {
    return { link, ok: false, reason: 'discord invite code not found' }
  }

  try {
    const response = await fetch(`https://discord.com/api/v10/invites/${inviteCode}?with_counts=true`, {
      method: 'GET',
      headers: { 'User-Agent': 'LelanationBot/1.0 (+https://lelanation.fr)' },
      redirect: 'follow'
    })

    if (response.ok) return { link, ok: true, statusCode: response.status }

    let reason = `http ${response.status}`
    try {
      const body = (await response.json()) as { message?: string }
      if (body.message) reason = `${reason}: ${body.message}`
    } catch {
      // Ignore parse errors, status is enough.
    }
    return { link, ok: false, reason, statusCode: response.status }
  } catch (error) {
    return {
      link,
      ok: false,
      reason: error instanceof Error ? error.message : String(error)
    }
  }
}

async function checkGenericLink(link: SocialLink): Promise<LinkCheckResult> {
  try {
    const response = await fetch(link.url, {
      method: 'GET',
      headers: { 'User-Agent': 'LelanationBot/1.0 (+https://lelanation.fr)' },
      redirect: 'follow'
    })

    if (response.ok) return { link, ok: true, statusCode: response.status }
    return { link, ok: false, reason: `http ${response.status}`, statusCode: response.status }
  } catch (error) {
    return {
      link,
      ok: false,
      reason: error instanceof Error ? error.message : String(error)
    }
  }
}

async function checkLink(link: SocialLink): Promise<LinkCheckResult> {
  if (link.type === 'discord-invite') return checkDiscordInvite(link)
  return checkGenericLink(link)
}

export async function runSocialLinksHealthCheckOnce(): Promise<{
  ok: boolean
  checked: number
  failed: number
}> {
  const log = createCronLogger('socialLinksHealthCheck')
  const discordService = new DiscordService()
  const cronStatus = new CronStatusService()

  await cronStatus.markStart('socialLinksHealthCheck')
  await log.info('START social links health check')

  const results = await Promise.all(HOME_SOCIAL_LINKS.map((link) => checkLink(link)))
  const failed = results.filter((result) => !result.ok)

  if (failed.length > 0) {
    await cronStatus.markFailure(
      'socialLinksHealthCheck',
      new Error(`Broken social links detected: ${failed.length}`)
    )
    await log.warn('Broken social links detected', {
      failed: failed.length,
      links: failed.map((f) => `${f.link.name} (${f.reason ?? 'unknown'})`).join(' | ')
    })

    await discordService.sendAlert(
      '🚨 Social link health check failed',
      'Un ou plusieurs liens sociaux de la home sont invalides (Discord prioritaire).',
      undefined,
      {
        failedCount: failed.length,
        links: failed.map((f) => `${f.link.name}: ${f.link.url} (${f.reason ?? 'unknown'})`).join('\n'),
        checkedAt: new Date().toISOString()
      }
    )
  } else {
    await cronStatus.markSuccess('socialLinksHealthCheck')
    await log.info('All social links are healthy', { checked: results.length })
  }

  return {
    ok: failed.length === 0,
    checked: results.length,
    failed: failed.length
  }
}

export function setupSocialLinksHealthCheck(): void {
  if (process.env.SOCIAL_LINKS_HEALTHCHECK_DISABLED === '1') {
    return
  }

  const schedule = process.env.SOCIAL_LINKS_HEALTHCHECK_CRON ?? '0 */6 * * *'
  cron.schedule(schedule, () => void runSocialLinksHealthCheckOnce(), {
    timezone: 'Etc/UTC'
  })
}
