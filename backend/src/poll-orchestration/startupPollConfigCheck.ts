import type { PollConfig } from '../poller/types.js';

type LoggerLike = {
  info: (payload: Record<string, unknown>, message: string) => void;
  error: (payload: Record<string, unknown>, message: string) => void;
};

export function assertPollConfigFiltersWired(
  pollConfig: Partial<PollConfig>,
  log: LoggerLike,
  exitFn: (code: number) => never = process.exit,
): void {
  const matchFilterWired = typeof pollConfig.matchFilter === 'function';
  const rankFilterWired = typeof pollConfig.rankFilter === 'function';
  log.info(
    {
      component: 'main',
      matchFilterWired,
      rankFilterWired,
      resolveParticipantRanks: pollConfig.resolveParticipantRanks,
    },
    'poll config filters - startup check',
  );
  if (matchFilterWired && rankFilterWired) {
    return;
  }
  log.error(
    {
      component: 'main',
      matchFilterWired,
      rankFilterWired,
    },
    'poll config filters missing - exiting',
  );
  exitFn(1);
}
