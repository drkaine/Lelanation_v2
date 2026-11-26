import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlMock = vi.fn();

interface Fragment {
  text: string;
  values: unknown[];
}

// Requête paresseuse comme postgres.js : un fragment imbriqué n'est jamais exécuté,
// seule la requête attendue (`await`) atteint sqlMock, avec le texte des fragments inliné.
vi.mock('../../../../src/db/client.js', () => {
  const isFragment = (v: unknown): v is Fragment =>
    typeof v === 'object' && v !== null && 'text' in v && 'values' in v;
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? '';
    const flat: unknown[] = [];
    values.forEach((v, i) => {
      if (isFragment(v)) {
        text += v.text;
        flat.push(...v.values);
      } else {
        text += '?';
        flat.push(v);
      }
      text += strings[i + 1] ?? '';
    });
    return {
      text,
      values: flat,
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(sqlMock(text, flat)).then(resolve, reject),
    };
  };
  sql.array = (values: unknown[]) => values;
  return { sql };
});

vi.mock('../../../../src/observability/poller-metrics/timedDbOp.js', () => ({
  timedDbOp: (_op: string, fn: () => unknown) => fn(),
}));

const { PlayerDiscovery } = await import('../../../../src/poll-orchestration/PlayerDiscovery.js');

const row = (puuid: string, partners: string[] = []) => ({ puuid, region: 'EUW1', partners });

describe('PlayerDiscovery.fetchNextBatch', () => {
  beforeEach(() => sqlMock.mockReset());

  it('une seule requête : les cibles du balayage du jour pas encore pollées', async () => {
    const polled = new Date('2026-11-24T10:00:00Z');
    sqlMock.mockResolvedValueOnce([{ ...row('t1'), last_polled_at: polled }, row('t2'), row('t3')]);
    const batch = await new PlayerDiscovery(undefined, () => '2026-11-25').fetchNextBatch(2);
    expect(batch).toEqual([
      { puuid: 't1', region: 'euw1', lastPolledAt: polled },
      { puuid: 't2', region: 'euw1', lastPolledAt: null },
    ]);
    expect(sqlMock).toHaveBeenCalledTimes(1);
    const [query, values] = sqlMock.mock.calls[0];
    expect(query).toContain('FROM poll_targets t');
    expect(query).toContain('p.last_polled_at,');
    expect(query).toContain('t.day = ?::date');
    expect(query).toMatch(/p\.last_polled_at IS NULL OR p\.last_polled_at < \?::date/);
    expect(values).toContain('2026-11-25');
    expect(values).toContainEqual(['EUW1', 'KR']);
    expect(values).toContain(4);
  });

  it('autant de joueurs par tier : tri tour à tour sur les tiers, plus de last_seen ni next_poll_at', async () => {
    sqlMock.mockResolvedValue([]);
    await new PlayerDiscovery().fetchNextBatch(4);
    const [query] = sqlMock.mock.calls[0];
    expect(query).toContain('ROW_NUMBER() OVER (PARTITION BY t.region, t.rank_tier ORDER BY t.puuid)');
    expect(query).not.toContain('last_seen');
    expect(query).not.toContain('next_poll_at');
  });

  it('répartition par tier et par région : tour divisé par le poids de la région, tiers à 0 exclus', async () => {
    sqlMock.mockResolvedValue([]);
    const byPlatform: Record<string, Record<string, number>> = { euw1: { GOLD: 75, IRON: 25 }, kr: { IRON: 100 } };
    await new PlayerDiscovery(() => ['euw1', 'kr'], undefined, (p) => byPlatform[p] ?? {}).fetchNextBatch(4);
    const [query, values] = sqlMock.mock.calls[0];
    expect(query).toMatch(
      /JOIN unnest\(\?::text\[\], \?::text\[\], \?::float8\[\]\) AS w\(region, tier, weight\)/,
    );
    expect(query).toContain('w.region = t.region::text AND w.tier = t.rank_tier::text');
    expect(query).toContain('w.weight > 0');
    expect(query).toContain('ORDER BY t.puuid) / w.weight AS turn');
    expect(values).toContainEqual(['EUW1', 'EUW1', 'KR']);
    expect(values).toContainEqual(['GOLD', 'IRON', 'IRON']);
    expect(values).toContainEqual([75, 25, 100]);
  });

  it('régions en alternance : à tour égal, départage par région (pas une région après l’autre)', async () => {
    sqlMock.mockResolvedValue([]);
    await new PlayerDiscovery().fetchNextBatch(4);
    const [query] = sqlMock.mock.calls[0];
    expect(query).toMatch(/ORDER BY turn, region\s/);
  });

  it('exclut les joueurs dont un duo a été pollé aujourd’hui', async () => {
    sqlMock.mockResolvedValue([]);
    await new PlayerDiscovery().fetchNextBatch(4);
    const [query] = sqlMock.mock.calls[0];
    expect(query).toContain('player_duos');
    expect(query).toContain('last_polled_at >= CURRENT_DATE');
  });

  it('filtre duo sans OR : un index par sens de paire', async () => {
    sqlMock.mockResolvedValue([]);
    await new PlayerDiscovery().fetchNextBatch(4);
    for (const [query] of sqlMock.mock.calls) {
      expect(query).toContain('JOIN players q ON q.puuid = d.puuid_b');
      expect(query).toContain('JOIN players q ON q.puuid = d.puuid_a');
    }
  });

  it('ne met pas deux partenaires de duo dans le même jour, même sur deux lots', async () => {
    const discovery = new PlayerDiscovery();
    sqlMock.mockResolvedValue([]);
    sqlMock.mockResolvedValueOnce([row('a', ['b']), row('b', ['a'])]);
    expect((await discovery.fetchNextBatch(4)).map((p) => p.puuid)).toEqual(['a']);
    sqlMock.mockResolvedValueOnce([row('b', ['a']), row('c')]);
    expect((await discovery.fetchNextBatch(4)).map((p) => p.puuid)).toEqual(['c']);
  });

  it('ne cherche que les plateformes actives (hors balayage) ; aucune = pas de requête', async () => {
    sqlMock.mockResolvedValue([]);
    let active = ['kr'];
    const discovery = new PlayerDiscovery(() => active);
    await discovery.fetchNextBatch(4);
    expect(sqlMock.mock.calls[0][1]).toContainEqual(['KR']);
    const calls = sqlMock.mock.calls.length;
    active = [];
    expect(await discovery.fetchNextBatch(4)).toEqual([]);
    expect(sqlMock).toHaveBeenCalledTimes(calls);
  });

  it('joueurs en file pas encore pollés exclus des lots suivants, jusqu’à leur poll', async () => {
    const discovery = new PlayerDiscovery(() => ['euw1']);
    sqlMock.mockResolvedValueOnce([row('a')]);
    await discovery.fetchNextBatch(4);
    sqlMock.mockResolvedValue([]);
    await discovery.fetchNextBatch(4);
    const [query, values] = sqlMock.mock.calls[1];
    expect(query).toContain('NOT (p.puuid = ANY(?::text[]))');
    expect(values).toContainEqual(['a']);
    await discovery.updateLastSeen('a');
    await discovery.fetchNextBatch(4);
    expect(sqlMock.mock.calls.at(-1)?.[1]).toContainEqual([]);
  });

  it('plateforme sans cible restante : signalée épuisée et repli sur les joueurs les moins récemment pollés', async () => {
    const discovery = new PlayerDiscovery(undefined, () => '2026-11-25');
    sqlMock.mockResolvedValueOnce([row('t1')]).mockResolvedValueOnce([{ puuid: 'k1', region: 'KR', partners: [] }]);
    const batch = await discovery.fetchNextBatch(4);
    expect(batch.map((p) => p.puuid)).toEqual(['t1', 'k1']);
    expect(discovery.exhaustedPlatforms()).toEqual(['kr']);
    const [query, values] = sqlMock.mock.calls[1];
    expect(query).not.toContain('poll_targets');
    expect(query).toContain('ORDER BY p.last_seen ASC NULLS FIRST');
    expect(query).toContain('NOT (p.puuid = ANY(?::text[]))');
    expect(values).toContainEqual(['KR']);
    expect(values).toContainEqual(['t1']);
    expect(values).toContain(3);
    discovery.clearExhausted('kr');
    expect(discovery.exhaustedPlatforms()).toEqual([]);
  });

  it('cibles en nombre suffisant : pas de repli, rien d’épuisé', async () => {
    const discovery = new PlayerDiscovery(() => ['euw1']);
    sqlMock.mockResolvedValueOnce([row('a'), row('b'), row('c'), row('d')]);
    await discovery.fetchNextBatch(2);
    expect(sqlMock).toHaveBeenCalledTimes(1);
    expect(discovery.exhaustedPlatforms()).toEqual([]);
  });

  it('updateLastSeen marque aussi last_polled_at', async () => {
    sqlMock.mockResolvedValue([]);
    await new PlayerDiscovery().updateLastSeen('p1');
    expect(sqlMock.mock.calls[0][0]).toContain('last_polled_at = NOW()');
  });

  it('updateLastSeen avec rythme : games_per_day et next_poll_at = maintenant + délai', async () => {
    sqlMock.mockResolvedValue([]);
    await new PlayerDiscovery().updateLastSeen('p1', 10);
    const [text, values] = sqlMock.mock.calls[0];
    expect(text).toContain('games_per_day = ?');
    expect(text).toContain('next_poll_at = NOW() + ?');
    expect(values).toContain(10);
    expect(values).toContain(0.5);
  });

});
