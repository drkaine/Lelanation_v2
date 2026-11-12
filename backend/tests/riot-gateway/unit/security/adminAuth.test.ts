import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../src/routes/userAuth.js', () => ({
  readBearerToken: (req: { header: (n: string) => string | undefined }) => {
    const [scheme, token] = (req.header('authorization') ?? '').split(' ')
    return scheme === 'Bearer' && token ? token : null
  },
  resolveUser: async (req: { header: (n: string) => string | undefined }) => {
    const token = (req.header('authorization') ?? '').split(' ')[1]
    if (token === 'admin-token') return { id: 1, role: 'admin' }
    if (token === 'member-token') return { id: 2, role: 'member' }
    return null
  },
}))

import { requireAdmin } from '../../../../src/utils/adminAuth.js'

function fakeReq(authorization?: string, ip = '203.0.113.9') {
  return {
    ip,
    socket: { remoteAddress: ip },
    headers: authorization ? { authorization } : {},
    header: (name: string) => (name.toLowerCase() === 'authorization' ? authorization : undefined),
  }
}

function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    locals: {} as Record<string, unknown>,
    setHeader: () => res,
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(body: unknown) {
      res.body = body
      return res
    },
  }
  return res
}

async function run(authorization?: string, ip?: string) {
  const req = fakeReq(authorization, ip)
  const res = fakeRes()
  let passed = false
  let index = 0
  const next = async (): Promise<void> => {
    const handler = requireAdmin[index++]
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

const basic = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ADMIN_USER_NAME', 'boss')
    vi.stubEnv('ADMIN_PASSWORD', 'hunter2-long')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('request_is_rejected_when_no_credentials_are_sent', async () => {
    expect(await run(undefined, '203.0.113.1')).toEqual({ passed: false, status: 401 })
  })

  it('request_passes_when_basic_credentials_match', async () => {
    expect((await run(basic('boss', 'hunter2-long'), '203.0.113.2')).passed).toBe(true)
  })

  it('request_is_rejected_when_basic_password_is_wrong', async () => {
    expect(await run(basic('boss', 'nope'), '203.0.113.3')).toEqual({ passed: false, status: 401 })
  })

  it('request_passes_when_session_user_is_admin', async () => {
    expect((await run('Bearer admin-token', '203.0.113.4')).passed).toBe(true)
  })

  it('request_is_forbidden_when_session_user_is_not_admin', async () => {
    expect(await run('Bearer member-token', '203.0.113.5')).toEqual({ passed: false, status: 403 })
  })

  it('admin_api_is_disabled_when_credentials_are_not_configured', async () => {
    vi.stubEnv('ADMIN_USER_NAME', '')
    vi.stubEnv('ADMIN_USERNAME', '')
    vi.stubEnv('ADMIN_PASSWORD', '')
    expect(await run(undefined, '203.0.113.6')).toEqual({ passed: false, status: 503 })
  })
})
