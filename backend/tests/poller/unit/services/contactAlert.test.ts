import { describe, expect, it } from 'vitest'
import { buildContactAlertEmbed } from '../../../../src/services/DiscordService.js'

describe('buildContactAlertEmbed', () => {
  it('announces a contact request without any personal data', () => {
    const embed = buildContactAlertEmbed('bug', '2026-10-29T10:00:00.000Z')
    expect(embed).toEqual({
      title: '📬 Nouvelle demande de contact - bug',
      description: 'Message enregistré sur le serveur (data/contact.json).',
      color: 0x5865f2,
      timestamp: '2026-10-29T10:00:00.000Z',
      footer: { text: 'Lelanation Contact' },
    })
  })
})
