import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../src/routes/userAuth.js', () => ({
  readBearerToken: (req: { header: (n: string) => string | undefined }) => {
    const [scheme, token] = (req.header('authorization') ?? '').split(' ')
    return scheme === 'Bearer' && token ? token : null
  },
  resolveUser: async (req: { header: (n: string) => string | undefined }) => {
    const token = (req.header('authorization') ?? '').split(' ')[1]
    if (token === 'admin-token') return { id: 1, role: 'admin' }
    if (token === 'lelariva-token') return { id: 2, role: 'lelariva' }
    if (token === 'member-token') return { id: 3, role: 'member' }
    return null
  },
}))

import { isGestionPath, requireAdminOrGestion } from '../../../../src/utils/adminAuth.js'

async function run(path: string, authorization: string) {
  const req = {
    ip: '203.0.113.20',
    path,
    socket: { remoteAddress: '203.0.113.20' },
    headers: { authorization },
    header: (name: string) => (name.toLowerCase() === 'authorization' ? authorization : undefined),
  }
  const res = {
    statusCode: 200,
    locals: {} as Record<string, unknown>,
    setHeader: () => res,
    status(code: number) {
      res.statusCode = code
      return res
    },
    json: () => res,
  }
  let passed = false
  let index = 0
  const next = async (): Promise<void> => {
    const handler = requireAdminOrGestion[index++]
    if (!handler) {
      passed = true
      return
    }
    await handler(req as never, res as never, (() => void next()) as never)
  }
  await next()
  await new Promise((r) => setTimeout(r, 0))
  return { passed, status: res.statusCode }
}

describe('gate admin : onglets Gestion ouverts à lelariva', () => {
  it('chemins des onglets Gestion', () => {
    for (const p of ['/poller-settings', '/otp-settings', '/balance-rules', '/cron', '/youtube/trigger', '/youtube/channels']) {
      expect(isGestionPath(p), p).toBe(true)
    }
    expect(isGestionPath('/riot-apikey')).toBe(false)
    expect(isGestionPath('/balance-rules/../riot-apikey')).toBe(false)
  })

  it('lelariva : passe sur un chemin Gestion, 403 ailleurs', async () => {
    expect((await run('/balance-rules', 'Bearer lelariva-token')).passed).toBe(true)
    const other = await run('/riot-apikey', 'Bearer lelariva-token')
    expect(other).toEqual({ passed: false, status: 403 })
  })

  it('admin : passe partout ; membre : 403 même sur un chemin Gestion', async () => {
    expect((await run('/riot-apikey', 'Bearer admin-token')).passed).toBe(true)
    expect(await run('/balance-rules', 'Bearer member-token')).toEqual({ passed: false, status: 403 })
  })
})
