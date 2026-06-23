import { describe, expect, test } from "vitest";
import { normalizeCampName } from "../../../src/constants/mapSpatial.js";
import { extractJunglePath, toJungleCampHistoryDoc } from "../../../src/parsers/junglePathExtract.js";

describe("mapSpatial", () => {
  test("normalizeCampName strips side suffix", () => {
    expect(normalizeCampName("red_buff_blue")).toBe("red_buff");
  });
});

describe("extractJunglePath", () => {
  test("builds path from camps before 6 minutes", () => {
    const result = extractJunglePath([
      { camp_type: "red", timestamp_ms: 90_000 },
      { camp_type: "krugs", timestamp_ms: 150_000 },
      { camp_type: "raptors", timestamp_ms: 220_000 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.pathSequence).toEqual(["red_buff", "krugs", "raptors"]);
    expect(result!.clearTimeMs).toBe(220_000);
    expect(result!.pathHash).toHaveLength(32);
  });

  test("ignores camps after 6 minutes", () => {
    const result = extractJunglePath([
      { camp_type: "blue", timestamp_ms: 100_000 },
      { camp_type: "gromp", timestamp_ms: 400_000 },
    ]);
    expect(result?.pathSequence).toEqual(["blue_buff"]);
  });

  test("excludes epic monsters from neutral path", () => {
    const result = extractJunglePath([
      { camp_type: "red", timestamp_ms: 90_000 },
      { camp_type: "dragon", timestamp_ms: 150_000 },
      { camp_type: "krugs", timestamp_ms: 200_000 },
    ]);
    expect(result?.pathSequence).toEqual(["red_buff", "krugs"]);
  });

  test("parses JSON string camp history from jsonb", () => {
    const raw =
      '[{"camp_type":"blue","timestamp_ms":80000},{"camp_type":"gromp","timestamp_ms":140000}]';
    const result = extractJunglePath(raw);
    expect(result?.pathSequence).toEqual(["blue_buff", "gromp"]);
  });

  test("toJungleCampHistoryDoc embeds camps and early_path for jungler", () => {
    const doc = toJungleCampHistoryDoc(
      [
        { camp_type: "red", timestamp_ms: 90_000 },
        { camp_type: "krugs", timestamp_ms: 150_000 },
      ],
      true,
    );
    expect(doc.camps).toHaveLength(2);
    expect(doc.early_path?.path_sequence).toEqual(["red_buff", "krugs"]);
    expect(doc.early_path?.path_hash).toHaveLength(32);
    expect(extractJunglePath(doc)?.pathHash).toBe(doc.early_path?.path_hash);
  });
});
