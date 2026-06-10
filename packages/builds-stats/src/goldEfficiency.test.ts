import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateGoldValue,
  calculateItemGoldEfficiency,
  calculateItemGoldValue,
  calculateItemGoldValueFromItem,
  itemStatsToGoldValueStats,
} from "./goldEfficiency.js";

describe("goldEfficiency wiki reference prices", () => {
  it("Long Sword: 10 AD @ 350g = 100% efficiency", () => {
    const value = calculateGoldValue({ attackDamage: 10 });
    assert.equal(value, 350);
    const eff = calculateItemGoldEfficiency({
      gold: { total: 350, base: 350, sell: 245, purchasable: true },
      stats: { FlatPhysicalDamageMod: 10 },
    });
    assert.equal(eff, 100);
  });

  it("Amplifying Tome: 20 AP @ 400g = 100% efficiency", () => {
    const value = calculateGoldValue({ abilityPower: 20 });
    assert.equal(value, 400);
  });

  it("Dagger: 10% AS @ 250g = 100% efficiency", () => {
    const value = calculateItemGoldValue({ PercentAttackSpeedMod: 10 });
    assert.equal(value, 250);
  });

  it("normalizes decimal attack speed (0.1 = 10%)", () => {
    const fromDecimal = calculateItemGoldValue({ PercentAttackSpeedMod: 0.1 });
    const fromPercent = calculateItemGoldValue({ PercentAttackSpeedMod: 10 });
    assert.equal(fromDecimal, fromPercent);
    assert.equal(fromDecimal, 250);
  });

  it("Serrated Dirk: 20 AD + 10 lethality @ 1000g = 100% efficiency", () => {
    const stats = {
      FlatPhysicalDamageMod: 20,
      FlatLethality: 10,
    };
    const value = calculateItemGoldValue(stats);
    assert.equal(value, 1000);
    const eff = calculateItemGoldEfficiency({
      gold: { total: 1000, base: 1000, sell: 700, purchasable: true },
      stats,
    });
    assert.equal(eff, 100);
  });

  it("includes secondary stats (life steal, tenacity, heal/shield)", () => {
    const stats = itemStatsToGoldValueStats({
      PercentLifeStealMod: 7,
      PercentTenacity: 30,
      PercentHealShieldPower: 8,
    });
    assert.equal(stats.lifeSteal, 7);
    assert.equal(stats.tenacity, 30);
    assert.equal(stats.healShieldPower, 8);
    const value = calculateGoldValue(stats);
    assert.equal(value, Math.round(7 * 53.55 + 30 * 10.333334 + 8 * 50));
  });

  it("Cloak of Agility: 15% crit @ 600g = 100% efficiency", () => {
    const fromPercent = calculateItemGoldValue({ FlatCritChanceMod: 15 });
    const fromDecimal = calculateItemGoldValue({ FlatCritChanceMod: 0.15 });
    assert.equal(fromPercent, 600);
    assert.equal(fromDecimal, 600);
  });

  it("Rejuvenation Bead / Faerie Charm regen uses percent base regen mod", () => {
    const hp = calculateItemGoldValue({ PercentHPRegenMod: 100 });
    const mp = calculateItemGoldValue({ PercentMPRegenMod: 50 });
    assert.equal(hp, 300);
    assert.equal(mp, 200);
  });

  it("World Atlas: enriches missing regen stats (wiki 255g, 63.75%)", () => {
    const atlas = {
      id: "3865",
      stats: { FlatHPPoolMod: 30 },
      tags: ["GoldPer"],
      effect: { Effect1Amount: "3" },
      gold: { total: 400, base: 400, sell: 160, purchasable: true },
    };
    const value = calculateItemGoldValueFromItem(atlas);
    assert.equal(value, 255);
    const eff = calculateItemGoldEfficiency(atlas);
    assert.ok(eff != null && Math.abs(eff - 63.75) < 0.01);
  });

  it("parses EN Base Health Regen from description", () => {
    const value = calculateItemGoldValueFromItem({
      id: "9999",
      description:
        "<mainText><stats><attention>25%</attention> Base Health Regen</stats></mainText>",
      stats: {},
    });
    assert.equal(value, 75);
  });
});
