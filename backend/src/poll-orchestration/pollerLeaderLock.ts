export const POLLER_LEADER_LOCK_KEY = "poller:leader";
export const POLLER_LEADER_LOCK_TTL_SEC = 120;

/** Returns true if the PID still exists (EPERM counts as alive). */
export function isLeaderProcessAlive(pidRaw: string | null | undefined): boolean {
  if (!pidRaw) return false;
  const pid = Number(pidRaw);
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code =
      error instanceof Error && "code" in error ? String((error as NodeJS.ErrnoException).code) : "";
    return code === "EPERM";
  }
}
