import { describe, expect, it } from 'vitest';
import { snapshotFilterSql } from '../../../../src/stats/snapshotFilterSql.js';
import { runWithStatsRegion } from '../../../../src/stats/statsRegion.js';

describe('snapshotFilterSql : filtre OTP sur les snapshots journaliers', () => {
  it('all : aucune condition otp', () => {
    runWithStatsRegion(null, () => {
      expect(snapshotFilterSql({ alias: 's' })).not.toContain('otp');
    }, 'all');
  });
  it('only / exclude : condition sur s.otp', () => {
    runWithStatsRegion(null, () => {
      expect(snapshotFilterSql({ alias: 's' })).toContain('s.otp = true');
    }, 'only');
    runWithStatsRegion(null, () => {
      expect(snapshotFilterSql({ alias: 'i' })).toContain('i.otp = false');
    }, 'exclude');
  });
});
