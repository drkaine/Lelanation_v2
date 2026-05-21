import type { HydrationJobData } from "../dto/match.dto.js";
import { bullmqJobId } from "./bullmq-job-id.js";
import { hydrationQueue } from "./index.js";

function isDuplicateHydrationJobError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("cannot be replaced") ||
    message.includes("Job already exists") ||
    message.includes("already exists")
  );
}

/** N'enfile pas si le job existe déjà (waiting/active/waiting-children/delayed). */
export async function enqueueHydrationMatchIfAbsent(
  matchId: string,
  region: string,
  puuid: string,
): Promise<boolean> {
  const jobId = bullmqJobId("hydrate", matchId);
  const existing = await hydrationQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state === "failed") {
      await existing.remove().catch(() => undefined);
    } else {
      return false;
    }
  }

  try {
    await hydrationQueue.add(
      "hydrate-match",
      { matchId, region, puuid } satisfies HydrationJobData,
      { jobId },
    );
    return true;
  } catch (error) {
    if (isDuplicateHydrationJobError(error)) {
      return false;
    }
    throw error;
  }
}
