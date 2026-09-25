import { beforeEach, describe, expect, test, vi } from 'vitest';

const markSuccess = vi.fn(async () => undefined);
const markFailure = vi.fn(async () => undefined);
const sendAlert = vi.fn(async () => undefined);

vi.mock('../../../../src/services/CronStatusService.js', () => ({
  CronStatusService: class {
    markStart = vi.fn(async () => undefined);
    markSuccess = markSuccess;
    markFailure = markFailure;
  },
}));
vi.mock('../../../../src/services/DiscordService.js', () => ({
  DiscordService: class {
    sendAlert = sendAlert;
    sendInfo = vi.fn(async () => undefined);
  },
}));
vi.mock('../../../../src/utils/cronLogger.js', () => ({
  createCronLogger: () => ({ info: vi.fn(async () => undefined), warn: vi.fn(async () => undefined), error: vi.fn(async () => undefined) }),
}));
vi.mock('../../../../src/services/diskSpaceEmergencyCleanup.js', () => ({
  DISK_EMERGENCY_CLEANUP_THRESHOLD: 95,
  shouldRunDiskEmergencyCleanup: () => false,
  runDiskEmergencyCleanup: vi.fn(),
}));
vi.mock('../../../../src/services/diskSpaceMonitor.js', () => ({
  formatBytes: (b: number) => `${b}B`,
  saveDiskAlertState: vi.fn(async () => undefined),
  checkDiskSpaceAlert: async () => ({
    snapshot: { mountPath: '/', usagePercent: 75, usedBytes: 75, freeBytes: 25, totalBytes: 100 },
    shouldAlert: true,
    alertThreshold: 75,
    previousThreshold: 70,
    state: { lastCleanupAtThreshold: 0 },
  }),
}));

const { runDiskSpaceAlertOnce } = await import('../../../../src/cron/diskSpaceAlert.js');

describe('runDiskSpaceAlertOnce', () => {
  beforeEach(() => vi.clearAllMocks());

  test('threshold_crossed_alerts_discord_but_cron_run_is_success', async () => {
    const r = await runDiskSpaceAlertOnce();
    expect(sendAlert).toHaveBeenCalledOnce();
    expect(r.alerted).toBe(true);
    expect(markFailure).not.toHaveBeenCalled();
    expect(markSuccess).toHaveBeenCalledWith('diskSpaceAlert');
  });
});
