import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const spawnMock = vi.fn(() => ({ unref: vi.fn() }));
vi.mock('child_process', () => ({ spawn: spawnMock }));
vi.mock('../../../../src/utils/cronLogger.js', () => ({
  createCronLogger: () => ({ info: vi.fn(), error: vi.fn() }),
}));

const { runPollerSettingsSwitchOnce } = await import('../../../../src/cron/pollerSettingsSwitch.js');
const { pollerSettingsView, updatePollerSettings } = await import(
  '../../../../src/services/PollerSettingsAdminService.js'
);

describe('runPollerSettingsSwitchOnce (00 h)', () => {
  afterEach(() => {
    delete process.env.POLLER_SETTINGS_FILE;
    spawnMock.mockClear();
  });

  it('applique les réglages en attente et redémarre le poller seul', async () => {
    const f = join(mkdtempSync(join(tmpdir(), 'pss-')), 'p.json');
    process.env.POLLER_SETTINGS_FILE = f;
    updatePollerSettings(f, { platforms: ['kr'], tierWeights: { GOLD: 100 } });
    await runPollerSettingsSwitchOnce();
    expect(pollerSettingsView(f, ['euw1']).settings.platforms).toEqual(['kr']);
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(spawnMock.mock.calls[0])).toContain('make pm2-restart-poller');
  });

  it('rien en attente : pas de redémarrage', async () => {
    process.env.POLLER_SETTINGS_FILE = join(mkdtempSync(join(tmpdir(), 'pss-')), 'p.json');
    await runPollerSettingsSwitchOnce();
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
