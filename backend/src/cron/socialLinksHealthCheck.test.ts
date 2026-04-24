import test from 'node:test'
import assert from 'node:assert/strict'
import { extractDiscordInviteCode } from './socialLinksHealthCheck.js'

test('extractDiscordInviteCode extracts from discord.gg URL', () => {
  assert.equal(
    extractDiscordInviteCode('https://discord.gg/mTEwNBETb'),
    'mTEwNBETb'
  )
})

test('extractDiscordInviteCode extracts from discord.com/invite URL', () => {
  assert.equal(
    extractDiscordInviteCode('https://discord.com/invite/abc123'),
    'abc123'
  )
})

test('extractDiscordInviteCode returns null for non-discord URL', () => {
  assert.equal(extractDiscordInviteCode('https://example.com/invite/abc'), null)
})

test('extractDiscordInviteCode returns null for invalid URL', () => {
  assert.equal(extractDiscordInviteCode('not-an-url'), null)
})
