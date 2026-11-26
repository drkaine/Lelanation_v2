import { describe, expect, it } from 'vitest';
import { applyOtpFlags, isOtpPlayer, otpFlagsSql } from '../../../../src/services/OtpFlagService.js';

const settings = { thresholdPct: 70, minGames: 10 };

describe('isOtpPlayer', () => {
  it('OTP : >= seuil sur un champion et >= minGames', () => {
    expect(isOtpPlayer({ games: 10, topChampionGames: 7 }, settings)).toBe(true);
  });
  it('sous le seuil : pas OTP', () => {
    expect(isOtpPlayer({ games: 10, topChampionGames: 6 }, settings)).toBe(false);
  });
  it('trop peu de parties : pas OTP même à 100 %', () => {
    expect(isOtpPlayer({ games: 9, topChampionGames: 9 }, settings)).toBe(false);
  });
});

describe('otpFlagsSql : recalcul en une requête, sans nommer les joueurs', () => {
  it('seuil en float8 et minGames passés en paramètres', () => {
    const { text, values } = otpFlagsSql(settings);
    expect(text).toContain('INSERT INTO otp_players');
    expect(text).toContain('::float8');
    expect(text).not.toMatch(/game_name|summoner_name|riot_id/i);
    expect(values).toEqual([0.7, 10]);
  });
});

const participant = (puuid: string, teamId: 100 | 200) => ({ puuid, teamId, otp: false });

describe('applyOtpFlags : participant = son flag ; équipe/match = au moins un OTP', () => {
  it('marque les participants et les équipes', () => {
    const payload = {
      participants: [participant('a', 100), participant('b', 100), participant('c', 200)],
      teamStats: { otp: false, otpTeam100: false, otpTeam200: false },
    };
    applyOtpFlags(payload, new Set(['b']));
    expect(payload.participants.map((p) => p.otp)).toEqual([false, true, false]);
    expect(payload.teamStats).toEqual({ otp: true, otpTeam100: true, otpTeam200: false });
  });
  it('aucun OTP : tout à false', () => {
    const payload = { participants: [participant('a', 200)], teamStats: { otp: true, otpTeam100: true, otpTeam200: true } };
    applyOtpFlags(payload, new Set());
    expect(payload.teamStats).toEqual({ otp: false, otpTeam100: false, otpTeam200: false });
  });
});
