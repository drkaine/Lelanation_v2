import { pollerLogger } from './logger.js';
import { PollSession } from './PollSession.js';
import { PollerEventBus } from './PollerEventBus.js';
import { mergePollConfig, type Player, type PollConfig, type SessionStats, type SessionStatus } from './types.js';

export class PollerEngine {
  private static instance: PollerEngine | null = null;

  private readonly eventBus = new PollerEventBus();
  private readonly sessions = new Map<string, PollSession>();

  private constructor() {}

  static getInstance(): PollerEngine {
    if (!PollerEngine.instance) {
      PollerEngine.instance = new PollerEngine();
    }
    return PollerEngine.instance;
  }

  static async resetInstance(): Promise<void> {
    if (!PollerEngine.instance) return;
    await PollerEngine.instance.shutdown();
    PollerEngine.instance = null;
  }

  async poll(
    players: Player[],
    options?: Partial<PollConfig>,
  ): Promise<{ sessionId: string; stats: SessionStats }> {
    const session = new PollSession(players, options, this.eventBus);
    this.sessions.set(session.sessionId, session);

    pollerLogger.info(
      {
        component: 'PollerEngine',
        sessionId: session.sessionId,
        players: players.map((p) => ({ puuid: p.puuid, platform: p.platform })),
        config: mergePollConfig(options),
      },
      'poll started',
    );

    try {
      const stats = await session.run();
      return { sessionId: session.sessionId, stats };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pollerLogger.error(
        { component: 'PollerEngine', sessionId: session.sessionId, error: message },
        'poll failed unexpectedly',
      );
      return {
        sessionId: session.sessionId,
        stats: session.getStats(),
      };
    } finally {
      this.sessions.delete(session.sessionId);
    }
  }

  cancelSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    session?.cancel();
  }

  getSessionStatus(sessionId: string): SessionStatus | null {
    return this.sessions.get(sessionId)?.getStatus() ?? null;
  }

  getEventBus(): PollerEventBus {
    return this.eventBus;
  }

  async shutdown(): Promise<void> {
    for (const session of this.sessions.values()) {
      session.cancel();
    }
    this.sessions.clear();
  }
}
