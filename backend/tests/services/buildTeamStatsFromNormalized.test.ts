import { describe, expect, it } from "vitest";
import { buildTeamStatsFromNormalized } from "../src/services/buildTeamStatsFromNormalized.js";

describe("buildTeamStatsFromNormalized", () => {
  it("maps team row kills, first flags, drakes and souls into objectives", () => {
    const stats = buildTeamStatsFromNormalized(
      {
        riot_match_id: "EUW1_1",
        patch: "16.13",
        region: "EUW",
        early_surrender: false,
        surrender: false,
      },
      [
        {
          team_id: 100,
          win: true,
          first_blood: true,
          baron_first: true,
          baron_kills: 1,
          dragon_kills: 3,
          fire_drake_kills: 2,
          have_soul: true,
          soul_type: "fire",
          elder_drake_kills: 1,
        },
        {
          team_id: 200,
          win: false,
          tower_first: true,
          tower_kills: 5,
          water_drake_kills: 1,
        },
      ],
      "GOLD",
    );

    const types = stats.objectives.map((o) => `${o.team}:${o.type}:${o.count}:${o.outcome}`);
    expect(types).toContain("100:baronFirst:1:win");
    expect(types).toContain("100:baron:1:win");
    expect(types).toContain("100:fire_drake:2:win");
    expect(types).toContain("100:fire_soul:1:win");
    expect(types).toContain("100:elder:1:win");
    expect(types).toContain("100:firstBlood:1:win");
    expect(types).toContain("200:towerFirst:1:loss");
    expect(types).toContain("200:water_drake:1:loss");
  });
});
