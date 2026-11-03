import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { frontendDeployLockPath } from '../../../src/services/StaticAssetsService.js'

describe('frontendDeployLockPath', () => {
  it('même verrou que scripts/deploy-frontend.sh (frontend/.deploy-frontend.lock)', () => {
    expect(frontendDeployLockPath('/app/frontend/public')).toBe(
      join('/app/frontend', '.deploy-frontend.lock')
    )
  })
})
