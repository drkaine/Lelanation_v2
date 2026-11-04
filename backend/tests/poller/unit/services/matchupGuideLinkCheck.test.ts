import { describe, expect, test } from 'vitest'
import {
  checkMatchupGuideLinks,
  classifyLinkProbe,
  linkProbeUrl,
} from '../../../../src/services/MatchupGuideLinkCheckService.js'

describe('linkProbeUrl', () => {
  test('YouTube : passe par oEmbed (une vidéo supprimée renvoie 200 sur la page)', () => {
    expect(linkProbeUrl('https://www.youtube.com/watch?v=abc123&t=4')).toEqual({
      kind: 'youtube',
      url: 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=abc123'),
    })
    expect(linkProbeUrl('https://youtu.be/abc123').kind).toBe('youtube')
  })

  test('autre lien : la page elle-même', () => {
    expect(linkProbeUrl('https://www.mobafire.com/x')).toEqual({ kind: 'page', url: 'https://www.mobafire.com/x' })
  })
})

describe('classifyLinkProbe', () => {
  test('404 et 410 = mort', () => {
    expect(classifyLinkProbe({ status: 404 }, 'page')).toBe('dead')
    expect(classifyLinkProbe({ status: 410 }, 'page')).toBe('dead')
  })
  test('domaine inexistant = mort', () => {
    expect(classifyLinkProbe({ errorCode: 'ENOTFOUND' }, 'page')).toBe('dead')
  })
  test('oEmbed 400/404 = vidéo supprimée', () => {
    expect(classifyLinkProbe({ status: 400 }, 'youtube')).toBe('dead')
    expect(classifyLinkProbe({ status: 404 }, 'youtube')).toBe('dead')
  })
  test('2xx/3xx = vivant', () => {
    expect(classifyLinkProbe({ status: 200 }, 'page')).toBe('alive')
  })
  test('anti-bot, 5xx, timeout = inconnu (jamais supprimé)', () => {
    expect(classifyLinkProbe({ status: 403 }, 'page')).toBe('unknown')
    expect(classifyLinkProbe({ status: 429 }, 'page')).toBe('unknown')
    expect(classifyLinkProbe({ status: 503 }, 'page')).toBe('unknown')
    expect(classifyLinkProbe({ status: 401 }, 'youtube')).toBe('unknown')
    expect(classifyLinkProbe({ errorCode: 'TIMEOUT' }, 'page')).toBe('unknown')
  })
})

describe('checkMatchupGuideLinks', () => {
  test('un lien est mort seulement si les deux essais le disent', async () => {
    const calls: Record<string, number> = {}
    const answers: Record<string, number[]> = {
      'https://a.test/': [404, 404],
      'https://flaky.test/': [404, 200],
      'https://ok.test/': [200],
      'https://bot.test/': [403],
    }
    const probe = async (url: string) => {
      const i = (calls[url] = (calls[url] ?? 0) + 1) - 1
      return { status: answers[url]![i]! }
    }
    const res = await checkMatchupGuideLinks(Object.keys(answers), { probe, retryDelayMs: 0 })
    expect(res.dead).toEqual(['https://a.test/'])
    expect(res.unknown).toEqual(['https://bot.test/'])
    expect(res.checked).toBe(4)
  })
})
