import { describe, expect, it } from "vitest";
import { laneEventColumns } from "../../../../src/services/laneEventColumns.js";

describe("laneEventColumns (insert unique des participants)", () => {
  const counts = {
    participantId: 3,
    killByDive: 1,
    deathByDive: 2,
    killByGank: 3,
    deathByGank: 4,
    killByRoam: 5,
    deathByRoam: 6,
    killOnObjective: 7,
    deathOnObjective: 8,
  };

  it("mappe les compteurs vers les colonnes participants", () => {
    expect(laneEventColumns(new Map([[3, counts]]), 3)).toEqual({
      kill_by_dive: 1,
      death_by_dive: 2,
      kill_by_gank: 3,
      death_by_gank: 4,
      kill_by_roaming: 5,
      death_by_roaming: 6,
      kill_on_objective: 7,
      death_on_objective: 8,
    });
  });

  it("participant sans compteurs → aucune colonne (défaut DB)", () => {
    expect(laneEventColumns(new Map([[3, counts]]), 4)).toEqual({});
  });
});
