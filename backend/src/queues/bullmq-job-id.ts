/**
 * BullMQ v4+ : les custom `jobId` ne peuvent pas contenir `:`.
 * Normalise chaque segment et joint avec `_`.
 */
export function bullmqJobId(...segments: Array<string | number>): string {
  return segments
    .map((segment) =>
      String(segment)
        .trim()
        .replace(/:/g, "_"),
    )
    .join("_");
}
