import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
vi.mock('../../../../src/db/query.js', () => ({
  queryRawUnsafe: (text: string) => queryMock(text),
  isDatabaseConfigured: () => true,
}));

const { getAvailableRegions, resetAvailableRegionsCache } = await import(
  '../../../../src/services/StatsAvailableRegionsService.js'
);

describe('getAvailableRegions', () => {
  beforeEach(() => {
    queryMock.mockReset();
    resetAvailableRegionsCache();
  });

  it('régions de l’enum ayant au moins un match, ordre de l’enum', async () => {
    queryMock.mockResolvedValueOnce([{ region: 'EUW1' }, { region: 'KR' }]);
    expect(await getAvailableRegions()).toEqual(['EUW1', 'KR']);
    const [sql] = queryMock.mock.calls[0];
    expect(sql).toContain('enum_range(NULL::lol_region)');
    expect(sql).toContain('EXISTS');
    expect(sql).not.toContain('m.region IN');
  });

  it('mis en cache', async () => {
    queryMock.mockResolvedValue([{ region: 'EUW1' }]);
    await getAvailableRegions();
    await getAvailableRegions();
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('erreur DB : [] sans cache', async () => {
    queryMock.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce([{ region: 'NA1' }]);
    expect(await getAvailableRegions()).toEqual([]);
    expect(await getAvailableRegions()).toEqual(['NA1']);
  });
});
